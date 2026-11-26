import { abonoDePrueba, lineaConCupoDePrueba, skuVirtualDePrueba } from "./helpers/catalogo-de-prueba";
import { afterAll, beforeAll, beforeEach, describe, expect, it, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  changeLog,
  cohorts,
  dealActividades,
  dealLineas,
  deals,
  leads,
  plataformasPago,
  programs,
  skus,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { editarDeal } from "@/lib/deals/editar-deal";
import { registrarAbono } from "@/lib/deals/abonos";
import { cambiarCohorte } from "@/lib/deals/estudiante";
import { descuentoDeDeal } from "@/lib/queries/saldo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

// La cohorte activa se deduce de su ventana y del día de hoy (ADR 0137 punto 5): el test fija
// un día dentro de las ventanas que siembra, en vez de marcar la cohorte activa a mano.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T17:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohortId: string;
let closerId: string;
let plataformaId: string;
let secuencia = 0;

const actor = () => ({ userId: closerId, rol: "closer" as const, operaComoCloser: false });

async function lead() {
  secuencia += 1;
  const [fila] = await db
    .insert(leads)
    .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `persona-${secuencia}@correo.co` })
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

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  secuencia = 0;
  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "ticket-134", nombre: "Ticket 134" })
    .returning();
  programId = programa.id;
  const [cohorte] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C2",
      metaCupos: 30,
      fechaInicioClases: "2026-11-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-31",
    })
    .returning();
  cohortId = cohorte.id;
  await skuVirtualDePrueba(db, cohortId, "797");
  const [closer] = await db
    .insert(users)
    .values({ email: "closer-134@retia.co", rol: "closer", closerId: "Closer 134" })
    .returning();
  closerId = closer.id;
  plataformaId = (await db.insert(plataformasPago).values({ nombre: "Plataforma 134" }).returning())[0].id;
});

afterAll(async () => cerrar());

describe("ticket 134 — cohorte y descuento", () => {
  it("un deal nuevo nace Sin SKU y, con un SKU predeterminado, nace con su línea y su ciclo (ADR 0140, ya no por fecha)", async () => {
    const primera = await lead();
    const sinSku = await abrirDeal(db, {
      leadId: primera.id,
      programId,
      etapa: "en_gestion",
      actor: { tipo: "usuario", ...actor() },
    });
    expect((await db.select().from(deals).where(eq(deals.id, sinSku)))[0].cohortId).toBeNull();

    const sku = await skuVirtualDePrueba(db, cohortId);
    await db.update(skus).set({ predeterminado: true }).where(eq(skus.id, sku.id));
    const segunda = await lead();
    const conSku = await abrirDeal(db, {
      leadId: segunda.id,
      programId,
      etapa: "en_gestion",
      actor: { tipo: "usuario", ...actor() },
    });
    expect((await db.select().from(deals).where(eq(deals.id, conSku)))[0].cohortId).toBe(cohortId);
  });

  it("ticket 797 menos descuento 100 congela 697 y el precio posterior no mueve la venta", async () => {
    const deal = await dealDirecto();
    await editarDeal(db, actor(), { dealId: deal.id, descuentoUsd: 100 });

    const [congelado] = await db.select().from(deals).where(eq(deals.id, deal.id));
    const [linea] = await db.select().from(dealLineas).where(eq(dealLineas.dealId, deal.id));
    // ADR 0137 punto 8: el valor se congela en la línea; el deal aún no vendido queda nulo.
    expect(congelado.valorVendidoUsd).toBeNull();
    expect(linea.valorVendidoUsd).toBe("697.00");
    expect(descuentoDeDeal(linea.precioListaUsd, linea.valorVendidoUsd)).toEqual({ usd: 100, porcentaje: 100 / 797 });

    await db.update(skus).set({ precioListaUsd: "897" }).where(eq(skus.cohortId, cohortId));
    expect((await db.select().from(dealLineas).where(eq(dealLineas.dealId, deal.id)))[0].valorVendidoUsd).toBe("697.00");
  });

  it("el primer abono congela el ticket sin descuento; un deal Sin SKU rechaza sin escribir (ADR 0140)", async () => {
    const conCohorte = await dealDirecto("atendido", { valorVendidoUsd: null });
    await registrarAbono(db, actor(), {
      dealId: conCohorte.id,
      fecha: "2026-10-01",
      monto: "100",
      plataformaId,
      comprobanteUrl: "https://drive.google.com/abono",
    });
    const [congelado] = await db.select().from(deals).where(eq(deals.id, conCohorte.id));
    expect(congelado).toMatchObject({ cohortId, valorVendidoUsd: "797.00", etapa: "ganado_parcial" });

    const sinSku = await dealDirecto("atendido", { cohortId: null, valorVendidoUsd: null });
    const error = await capturar(
      registrarAbono(db, actor(), {
        dealId: sinSku.id,
        fecha: "2026-10-01",
        monto: "100",
        plataformaId,
        comprobanteUrl: "https://drive.google.com/abono",
      }),
    );
    expect(error).toMatchObject({
      status: 409,
      message: "El deal no tiene SKU: asígnale uno antes de registrar el abono",
    });
    expect((await db.select().from(deals).where(eq(deals.id, sinSku.id)))[0].valorVendidoUsd).toBeNull();
    expect(await db.select().from(abonos).where(eq(abonos.dealId, sinSku.id))).toHaveLength(0);
  });

  it("rechaza descuento igual al ticket y un total menor que lo abonado, sin mover la fila", async () => {
    const sinVenta = await dealDirecto();
    expect(await capturar(editarDeal(db, actor(), { dealId: sinVenta.id, descuentoUsd: 797 }))).toMatchObject({ status: 422 });

    const vendido = await dealDirecto("ganado_parcial", { valorVendidoUsd: "797" });
    await abonoDePrueba(db, {
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
    await abonoDePrueba(db, {
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
    const [lineaAbonado] = await db.select().from(dealLineas).where(eq(dealLineas.dealId, abonado.id));
    // ADR 0137 punto 8: el rastro del descuento pertenece a la línea vendida.
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, lineaAbonado.id))).toContainEqual(
      expect.objectContaining({ campo: "valorVendidoUsd", valorNuevo: "600" }),
    );

    const completo = await dealDirecto("ganado_completo", { valorVendidoUsd: "697" });
    await abonoDePrueba(db, {
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

  it("cambiarCohorte funciona fuera de Students hacia una cohorte vendiendo, exige motivo y conserva el total vendido", async () => {
    // Hoy dentro de la ventana de C3, que es la que vende.
    vi.setSystemTime(new Date("2026-11-15T17:00:00.000Z"));
    const [futura] = await db
      .insert(cohorts)
      .values({
        programId,
        codigo: "C3",
        metaCupos: 30,
        fechaInicioClases: "2027-01-15",
        fechaInicioVentas: "2026-11-01",
        fechaCierreVentas: "2999-12-31",
      })
      .returning();
    await skuVirtualDePrueba(db, futura.id, "897");
    const deal = await dealDirecto("atendido", { valorVendidoUsd: "697" });
    await lineaConCupoDePrueba(db, deal.id);

    expect(await capturar(cambiarCohorte(db, actor(), { dealId: deal.id, cohortId: futura.id, motivo: "" }))).toMatchObject({
      status: 400,
    });
    await cambiarCohorte(db, actor(), {
      dealId: deal.id,
      cohortId: futura.id,
      motivo: "Empezará con el siguiente grupo.",
    });

    const [cambiado] = await db.select().from(deals).where(eq(deals.id, deal.id));
    const [lineaCambiada] = await db.select().from(dealLineas).where(eq(dealLineas.dealId, deal.id));
    // ADR 0137 punto 8: la cohorte cambia sin alterar el valor de la línea propuesta.
    expect(cambiado).toMatchObject({ cohortId: futura.id, valorVendidoUsd: null });
    expect(lineaCambiada.valorVendidoUsd).toBe("697.00");
    expect((await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id)))[0].nota).toContain(
      "Cambio de cohorte: C2 → C3.",
    );
  });
});
