import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  abonos,
  areas,
  changeLog,
  cohorts,
  dealActividades,
  deals,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { editarDeal } from "@/lib/deals/editar-deal";
import { registrarAbono } from "@/lib/deals/abonos";
import { cambiarCohorte } from "@/lib/deals/estudiante";
import { descuentoDeDeal } from "@/lib/queries/saldo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let areaId: string;
let closerId: string;
let secuencia = 0;

const actor = () => ({ userId: closerId, rol: "closer" as const });

async function lead() {
  secuencia += 1;
  const [fila] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: `persona-${secuencia}@correo.co` })
    .returning();
  return fila;
}

async function dealDirecto(
  etapa: typeof deals.$inferInsert.etapa = "atendido",
  extra: Partial<typeof deals.$inferInsert> = {},
) {
  const persona = await lead();
  const [deal] = await db
    .insert(deals)
    .values({
      leadId: persona.id,
      programId,
      cohortId,
      ownerUserId: closerId,
      areaDeclaradaId: areaId,
      etapa,
      ...extra,
    })
    .returning();
  return deal;
}

async function capturar(p: Promise<unknown>) {
  try {
    await p;
    throw new Error("La operación debía fallar.");
  } catch (error) {
    return error as { status?: number; message: string };
  }
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  secuencia = 0;
  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "ticket-134", nombre: "Ticket 134", ticketUsd: "999" })
    .returning();
  programId = programa.id;
  const [cohorte] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C2",
      metaCupos: 30,
      precioUsd: "797",
      fechaInicioClases: "2026-11-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-31",
      estado: "activo",
    })
    .returning();
  cohortId = cohorte.id;
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  areaId = area.id;
  const [closer] = await db
    .insert(users)
    .values({ email: "closer-134@retia.co", rol: "closer", closerId: "Closer 134" })
    .returning();
  closerId = closer.id;
});

afterEach(async () => cerrar());

describe("ticket 134 — cohorte y descuento", () => {
  it("un deal nuevo nace en la cohorte activa, o sin cohorte cuando no existe una activa", async () => {
    const primera = await lead();
    const conActiva = await abrirDeal(db, {
      leadId: primera.id,
      programId,
      etapa: "en_gestion",
      actor: { tipo: "usuario", ...actor() },
    });
    expect((await db.select().from(deals).where(eq(deals.id, conActiva)))[0].cohortId).toBe(cohortId);

    await db.update(cohorts).set({ estado: "futuro" }).where(eq(cohorts.id, cohortId));
    const segunda = await lead();
    const sinActiva = await abrirDeal(db, {
      leadId: segunda.id,
      programId,
      etapa: "en_gestion",
      actor: { tipo: "usuario", ...actor() },
    });
    expect((await db.select().from(deals).where(eq(deals.id, sinActiva)))[0].cohortId).toBeNull();
  });

  it("ticket 797 menos descuento 100 congela 697 y el precio posterior no mueve la venta", async () => {
    const deal = await dealDirecto();
    await editarDeal(db, actor(), { dealId: deal.id, descuentoUsd: 100 });

    const [congelado] = await db.select().from(deals).where(eq(deals.id, deal.id));
    expect(congelado.valorVendidoUsd).toBe("697.00");
    expect(descuentoDeDeal(797, congelado.valorVendidoUsd)).toEqual({ usd: 100, porcentaje: 100 / 797 });

    await db.update(cohorts).set({ precioUsd: "897" }).where(eq(cohorts.id, cohortId));
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].valorVendidoUsd).toBe("697.00");
  });

  it("el primer abono congela el ticket sin descuento y sin cohorte activa rechaza sin escribir", async () => {
    const conActiva = await dealDirecto("atendido", { cohortId: null, valorVendidoUsd: null });
    await registrarAbono(db, actor(), {
      dealId: conActiva.id,
      fecha: "2026-10-01",
      monto: "100",
      comprobanteUrl: "https://drive.google.com/abono",
    });
    const [congelado] = await db.select().from(deals).where(eq(deals.id, conActiva.id));
    expect(congelado).toMatchObject({ cohortId, valorVendidoUsd: "797.00", etapa: "ganado_parcial" });

    await db.update(cohorts).set({ estado: "futuro" }).where(eq(cohorts.id, cohortId));
    const sinActiva = await dealDirecto("atendido", { cohortId: null, valorVendidoUsd: null });
    const error = await capturar(
      registrarAbono(db, actor(), {
        dealId: sinActiva.id,
        fecha: "2026-10-01",
        monto: "100",
        comprobanteUrl: "https://drive.google.com/abono",
      }),
    );
    expect(error).toMatchObject({
      status: 422,
      message: "La cohorte del deal no tiene precio: asígnale una cohorte antes de vender.",
    });
    expect((await db.select().from(deals).where(eq(deals.id, sinActiva.id)))[0].valorVendidoUsd).toBeNull();
    expect(await db.select().from(abonos).where(eq(abonos.dealId, sinActiva.id))).toHaveLength(0);
  });

  it("rechaza descuento igual al ticket y un total menor que lo abonado, sin mover la fila", async () => {
    const sinVenta = await dealDirecto();
    expect(await capturar(editarDeal(db, actor(), { dealId: sinVenta.id, descuentoUsd: 797 }))).toMatchObject({ status: 422 });

    const vendido = await dealDirecto("ganado_parcial", { valorVendidoUsd: "797" });
    await db.insert(abonos).values({
      dealId: vendido.id,
      programId,
      fecha: "2026-10-01",
      monto: "500",
      comprobanteUrl: "https://drive.google.com/abono",
    });
    const error = await capturar(
      editarDeal(db, actor(), { dealId: vendido.id, descuentoUsd: 400, motivoCambioVenta: "Corrección" }),
    );
    expect(error.message).toContain("USD 397,00");
    expect(error.message).toContain("USD 500,00");
    expect((await db.select().from(deals).where(eq(deals.id, vendido.id)))[0].valorVendidoUsd).toBe("797.00");
  });

  it("una venta exige motivo, deja actividad y reconcilia Abonado ↔ Completo", async () => {
    const abonado = await dealDirecto("ganado_parcial", { valorVendidoUsd: "697" });
    await db.insert(abonos).values({
      dealId: abonado.id,
      programId,
      fecha: "2026-10-01",
      monto: "600",
      comprobanteUrl: "https://drive.google.com/abono",
    });

    const sinMotivo = await capturar(editarDeal(db, actor(), { dealId: abonado.id, descuentoUsd: 197 }));
    expect(sinMotivo).toMatchObject({ status: 422, message: "El motivo es obligatorio para cambiar una venta." });
    expect((await db.select().from(deals).where(eq(deals.id, abonado.id)))[0]).toMatchObject({
      valorVendidoUsd: "697.00",
      etapa: "ganado_parcial",
    });

    await editarDeal(db, actor(), {
      dealId: abonado.id,
      descuentoUsd: 197,
      motivoCambioVenta: "Descuento autorizado por gerencia.",
    });
    expect((await db.select().from(deals).where(eq(deals.id, abonado.id)))[0]).toMatchObject({
      valorVendidoUsd: "600.00",
      etapa: "ganado_completo",
    });
    const actividades = await db.select().from(dealActividades).where(eq(dealActividades.dealId, abonado.id));
    expect(actividades[0].nota).toContain("Cambio de descuento: USD 100,00 → USD 197,00");
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, abonado.id))).toContainEqual(
      expect.objectContaining({ campo: "valorVendidoUsd", valorNuevo: "600" }),
    );

    const completo = await dealDirecto("ganado_completo", { valorVendidoUsd: "697" });
    await db.insert(abonos).values({
      dealId: completo.id,
      programId,
      fecha: "2026-10-01",
      monto: "697",
      comprobanteUrl: "https://drive.google.com/abono-total",
    });
    await editarDeal(db, actor(), {
      dealId: completo.id,
      descuentoUsd: 0,
      motivoCambioVenta: "Se retiró el descuento.",
    });
    expect((await db.select().from(deals).where(eq(deals.id, completo.id)))[0]).toMatchObject({
      valorVendidoUsd: "797.00",
      etapa: "ganado_parcial",
    });
  });

  it("cambiarCohorte funciona fuera de Students, exige motivo y conserva el total vendido", async () => {
    const [futura] = await db
      .insert(cohorts)
      .values({
        programId,
        codigo: "C3",
        metaCupos: 30,
        precioUsd: "897",
        fechaInicioClases: "2027-01-15",
        fechaInicioVentas: "2026-11-01",
        fechaCierreVentas: "2027-01-14",
        estado: "futuro",
      })
      .returning();
    const deal = await dealDirecto("atendido", { valorVendidoUsd: "697" });

    expect(await capturar(cambiarCohorte(db, actor(), { dealId: deal.id, cohortId: futura.id, motivo: "" }))).toMatchObject({
      status: 400,
    });
    await cambiarCohorte(db, actor(), {
      dealId: deal.id,
      cohortId: futura.id,
      motivo: "Empezará con el siguiente grupo.",
    });

    const [cambiado] = await db.select().from(deals).where(eq(deals.id, deal.id));
    expect(cambiado).toMatchObject({ cohortId: futura.id, valorVendidoUsd: "697.00" });
    expect((await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id)))[0].nota).toContain(
      "Cambio de cohorte: C2 → C3.",
    );
  });
});

async function archivosTs(directorio: string): Promise<string[]> {
  const entradas = await readdir(directorio, { withFileTypes: true });
  const archivos = await Promise.all(
    entradas.map((entrada) => {
      const ruta = join(directorio, entrada.name);
      return entrada.isDirectory() ? archivosTs(ruta) : Promise.resolve(entrada.name.endsWith(".ts") || entrada.name.endsWith(".tsx") ? [ruta] : []);
    }),
  );
  return archivos.flat();
}

it("no queda ninguna referencia al catálogo retirado en el código ejecutable", async () => {
  const rutas = (await Promise.all(["lib", "app", "components", "scripts"].map(archivosTs))).flat();
  const hallazgos: string[] = [];
  for (const ruta of rutas) {
    if (/\bproductos\b/.test(await readFile(ruta, "utf8"))) hallazgos.push(ruta);
  }
  expect(hallazgos).toEqual([]);
});
