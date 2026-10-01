import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { textoComisionPrograma } from "@/components/dashboard-programa";
import { editarPrograma } from "@/lib/catalogo/programas";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { editarDeal } from "@/lib/deals/editar-deal";
import { esViolacionCheck } from "@/lib/db/errores";
import {
  abonos,
  areas,
  changeLog,
  deals,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { comisionDeDeal } from "@/lib/queries/comision";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let gerente: string;
let closer: string;
let areaId: string;
let secuencia = 0;

const HOY = "2026-10-01";
const sistema = { tipo: "sistema" } as const;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "1000.00" })
    .returning();
  programId = p.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [u] = await db
    .insert(users)
    .values({ email: "ana@retiagrowth.com", rol: "closer", closerId: "Ana" })
    .returning();
  closer = u.id;
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  areaId = area.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function dealAtendido(valorVendidoUsd: string | null = "1000") {
  const [lead] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: `lead-${++secuencia}@correo.co` })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({
      leadId: lead.id,
      programId,
      etapa: "atendido",
      ownerUserId: closer,
      areaDeclaradaId: areaId,
      valorVendidoUsd,
    })
    .returning();
  return deal.id;
}

async function vender(porcentaje: string | null, valor = "1000") {
  await db.update(programs).set({ comisionPorcentaje: porcentaje }).where(eq(programs.id, programId));
  const dealId = await dealAtendido(valor);
  await db
    .insert(abonos)
    .values({ dealId, programId, fecha: HOY, monto: "500", comprobanteUrl: "https://drive.google.com/abono" });
  await moverEtapa(db, { dealId, a: "abonado", actor: sistema });
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
  return deal;
}

const vista = () => armarVistaDelDashboard({ programId, hoy: HOY, preset: "hoy" }, db);

describe("comisionDeDeal", () => {
  it("calcula porcentaje y redondea a centavos; un dato ausente es null", () => {
    expect(comisionDeDeal("797", "10.04")).toBe(80.02);
    expect(comisionDeDeal("1500", "6.67")).toBe(100.05);
    expect(comisionDeDeal(null, "10")).toBeNull();
    expect(comisionDeDeal("1000", null)).toBeNull();
  });
});

describe("porcentaje congelado al vender", () => {
  it("una venta conserva el porcentaje anterior y una nueva toma el vigente", async () => {
    const primera = await vender("10.04");
    expect(primera.comisionPorcentaje).toBe("10.04");

    await db.update(programs).set({ comisionPorcentaje: "6.67" }).where(eq(programs.id, programId));
    const [sinCambiar] = await db.select().from(deals).where(eq(deals.id, primera.id));
    expect(sinCambiar.comisionPorcentaje).toBe("10.04");
    expect(comisionDeDeal(sinCambiar.valorVendidoUsd, sinCambiar.comisionPorcentaje)).toBe(100.4);

    const segunda = await vender("6.67");
    expect(segunda.comisionPorcentaje).toBe("6.67");
    expect((await vista()).comparativo[0]).toMatchObject({ cierres: 2, comisionUsd: 167.1, ventasSinComision: 0 });
  });

  it("salir de venta y volver no pisa el porcentaje congelado", async () => {
    const vendido = await vender("10.04");
    await db.update(programs).set({ comisionPorcentaje: "6.67" }).where(eq(programs.id, programId));
    await db
      .update(abonos)
      .set({ anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "corrección" })
      .where(eq(abonos.dealId, vendido.id));
    await moverEtapa(db, { dealId: vendido.id, a: "atendido", actor: sistema });
    await db
      .insert(abonos)
      .values({
        dealId: vendido.id,
        programId,
        fecha: HOY,
        monto: "500",
        comprobanteUrl: "https://drive.google.com/abono-nuevo",
      });
    await moverEtapa(db, { dealId: vendido.id, a: "abonado", actor: sistema });

    const [deVuelta] = await db.select().from(deals).where(eq(deals.id, vendido.id));
    expect(deVuelta.comisionPorcentaje).toBe("10.04");
  });

  it("corregir el valor vendido recalcula con el mismo porcentaje", async () => {
    const vendido = await vender("10.04", "1000");
    await editarDeal(db, { userId: gerente, rol: "gerente" }, { dealId: vendido.id, valorVendidoUsd: 1200 });

    const fila = (await vista()).comparativo[0];
    expect(fila).toMatchObject({ cierres: 1, comisionUsd: 120.48, ventasSinComision: 0 });
    const [corregido] = await db.select().from(deals).where(eq(deals.id, vendido.id));
    expect(corregido.comisionPorcentaje).toBe("10.04");
  });
});

describe("comision del comparativo", () => {
  it("cuenta los mismos cierres, omite anulados y separa ventas incompletas", async () => {
    const completa = await vender("10");
    const sinPorcentaje = await vender(null);
    const anulada = await vender("10");
    await db
      .update(deals)
      .set({ anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "duplicado" })
      .where(eq(deals.id, anulada.id));

    const fila = (await vista()).comparativo[0];
    expect(fila).toMatchObject({ cierres: 2, comisionUsd: 100, ventasSinComision: 1 });
    expect(comisionDeDeal(completa.valorVendidoUsd, completa.comisionPorcentaje)).toBe(100);
    expect(sinPorcentaje.comisionPorcentaje).toBeNull();
  });

  it("sin porcentaje conserva null, marca la venta y muestra el texto del pie", async () => {
    const deal = await vender(null);
    const v = await vista();
    expect(deal.comisionPorcentaje).toBeNull();
    expect(v.comisionPorcentaje).toBeNull();
    expect(v.comparativo[0]).toMatchObject({ cierres: 1, comisionUsd: 0, ventasSinComision: 1 });
    expect(textoComisionPrograma(v.comisionPorcentaje)).toBe("Comisión: sin porcentaje cargado.");
  });
});

describe("porcentaje editable del programa", () => {
  const entrada = (comisionPorcentaje: string) => ({
    nombre: "Programa A",
    slug: "programa-a",
    ticketUsd: "1000.00",
    formUrl: PROGRAMA_DE_PRUEBA.formUrl,
    comisionPorcentaje,
  });

  it("escribe change_log y convierte vacío en null", async () => {
    await editarPrograma(db, gerente, programId, entrada("10.04"));
    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, programId), eq(changeLog.campo, "comisionPorcentaje")));
    expect(rastro).toHaveLength(1);
    expect(rastro[0].userId).toBe(gerente);

    await editarPrograma(db, gerente, programId, entrada(""));
    const [programa] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(programa.comisionPorcentaje).toBeNull();
  });

  it("rechaza más de dos decimales, más de 100 y el CHECK rechaza negativos", async () => {
    await expect(editarPrograma(db, gerente, programId, entrada("10.041"))).rejects.toMatchObject({ status: 400 });
    await expect(editarPrograma(db, gerente, programId, entrada("100.01"))).rejects.toMatchObject({ status: 400 });
    const negativo = db.update(programs).set({ comisionPorcentaje: "-1" }).where(eq(programs.id, programId));
    await expect(negativo).rejects.toSatisfy(esViolacionCheck);
  });
});
