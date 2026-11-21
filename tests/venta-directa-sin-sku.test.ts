import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { abonos, cohorts, dealActividades, dealLineas, deals, leads, plataformasPago, programs, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { asignarLinea } from "@/lib/deals/lineas";
import { registrarVentaDeLaPasarela } from "@/lib/deals/venta-de-la-pasarela";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { skuVirtualDePrueba } from "./helpers/catalogo-de-prueba";

/**
 * Un cobro real de pasarela nunca se rechaza: la línea sale de una cascada (venta-de-la-pasarela.ts).
 * Un test por rama. ponytail: se retira con el 449 (oferta de Hotmart → SKU).
 */
let db: Db, vaciar: () => Promise<void>, cerrar: () => Promise<void>;
let programId: string, cohortId: string, plataformaId: string, secuencia = 0;

beforeAll(async () => {
  ({ db, vaciar, cerrar } = await crearBaseReutilizable());
  await db.execute(sql.raw("alter type origen_cambio add value if not exists 'hotmart'"));
  await db.execute(sql.raw("alter table abonos add column if not exists referencia_externa text"));
  await db.execute(sql.raw("create unique index if not exists abonos_origen_referencia_externa_idx on abonos (origen, referencia_externa) where referencia_externa is not null"));
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T17:00:00.000Z"));
  await vaciar();
  secuencia += 1;
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: `pasarela-sin-sku-${secuencia}`, nombre: `Pasarela ${secuencia}`, ticketUsd: "149",
  }).returning();
  programId = programa.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId, codigo: "C1", metaCupos: 10, precioUsd: "149",
    fechaInicioClases: "2026-12-01", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-11-30",
  }).returning();
  cohortId = cohorte.id;
  plataformaId = (await db.insert(plataformasPago).values({ nombre: `Hotmart ${secuencia}` }).returning())[0].id;
});
afterEach(() => vi.useRealTimers());
afterAll(async () => cerrar());

async function nuevoDeal(cohort: string | null = null) {
  const [lead] = await db.insert(leads).values({
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `p-${crypto.randomUUID()}@retia.co`,
  }).returning();
  return (await db.insert(deals).values({ programId, leadId: lead.id, cohortId: cohort, etapa: "registrado" }).returning())[0];
}
const cobro = (dealId: string) => ({
  dealId, monto: "149", moneda: "USD" as const, plataformaId, fecha: "2026-11-19",
  origen: "hotmart" as const, referenciaExterna: crypto.randomUUID(),
});
async function skuConCupo(codigo: string, cohort = cohortId) {
  return (await db.insert(skus).values({
    programId, nombre: codigo, slug: codigo.toLowerCase(), cohortId: cohort, codigo, precioListaUsd: "149", cuentaComoCupo: true,
  }).returning())[0];
}
async function lineaDelAbono(dealId: string) {
  const [abono] = await db.select().from(abonos).where(eq(abonos.dealId, dealId));
  const [linea] = await db.select({ linea: dealLineas, sku: skus }).from(dealLineas)
    .innerJoin(skus, eq(skus.id, dealLineas.skuId)).where(eq(dealLineas.id, abono.lineaId));
  return linea;
}
const notas = (dealId: string) => db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));

describe("cobro de pasarela: de qué línea sale", () => {
  it("1. exactamente una línea con cupo: paga esa", async () => {
    const virtual = await skuVirtualDePrueba(db, cohortId);
    const deal = await nuevoDeal(cohortId);
    const propia = await asignarLinea(db, { deal, skuId: virtual.id, actorId: null, etiqueta: "x" });
    await registrarVentaDeLaPasarela(db, cobro(deal.id));
    expect((await lineaDelAbono(deal.id)).linea.id).toBe(propia.id);
    expect(await notas(deal.id)).toHaveLength(0);
  });

  it("2. sin líneas: cae al SKU con cupo del único ciclo que vende hoy", async () => {
    const virtual = await skuVirtualDePrueba(db, cohortId);
    const deal = await nuevoDeal(null);
    await registrarVentaDeLaPasarela(db, cobro(deal.id));
    expect((await lineaDelAbono(deal.id)).sku.id).toBe(virtual.id);
    expect(await notas(deal.id)).toHaveLength(0);
  });

  it("3a. dos líneas con cupo: va a sin_clasificar y deja nota del sistema", async () => {
    const a = await skuConCupo("A-C1"); const b = await skuConCupo("B-C1");
    const deal = await nuevoDeal(cohortId);
    await asignarLinea(db, { deal, skuId: a.id, actorId: null, etiqueta: "x" });
    await asignarLinea(db, { deal, skuId: b.id, actorId: null, etiqueta: "x" });
    await registrarVentaDeLaPasarela(db, cobro(deal.id));
    const { sku } = await lineaDelAbono(deal.id);
    expect(sku.slug).toBe("sin_clasificar");
    const nota = await notas(deal.id);
    expect(nota).toHaveLength(1);
    expect(nota[0]).toMatchObject({ tipo: "nota", userId: null });
  });

  it("3b. ningún ciclo vende hoy: sin_clasificar en el ciclo más reciente, con nota", async () => {
    await skuVirtualDePrueba(db, cohortId);
    await db.update(cohorts).set({ fechaInicioVentas: "2026-01-01", fechaCierreVentas: "2026-01-31" }).where(eq(cohorts.id, cohortId));
    const deal = await nuevoDeal(null);
    await registrarVentaDeLaPasarela(db, cobro(deal.id));
    const { sku } = await lineaDelAbono(deal.id);
    expect(sku.slug).toBe("sin_clasificar");
    expect(sku.cohortId).toBe(cohortId);
    expect(await notas(deal.id)).toHaveLength(1);
  });

  it("3c. el ciclo que vende hoy tiene 2 SKUs con cupo y el deal no tiene líneas: sin_clasificar, no se elige al azar", async () => {
    await skuConCupo("A-C1"); await skuConCupo("B-C1");
    const deal = await nuevoDeal(null);
    await registrarVentaDeLaPasarela(db, cobro(deal.id));
    expect((await lineaDelAbono(deal.id)).sku.slug).toBe("sin_clasificar");
    expect(await notas(deal.id)).toHaveLength(1);
  });
});
