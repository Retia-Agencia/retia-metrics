import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { cohorts, dealLineas, deals, leads, plataformasPago, programs, skus, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { anularLinea, asignarLinea, editarValorDeLinea, quitarLinea, recalcularDealPorLineas } from "@/lib/deals/lineas";
import { registrarAbono } from "@/lib/deals/abonos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db, cerrar: () => Promise<void>, vaciar: () => Promise<void>;
let programId: string, closerId: string, plataformaId: string, c1: string, c2: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  [programId] = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tickets-460-464", nombre: "Tickets 460 y 464", ticketUsd: "100" }).returning()).map((x) => x.id);
  [closerId] = (await db.insert(users).values({ email: "closer-464@test.local", rol: "closer", closerId: "C464" }).returning()).map((x) => x.id);
  [plataformaId] = (await db.insert(plataformasPago).values({ nombre: "Banco 464" }).returning()).map((x) => x.id);
  const cohortes = await db.insert(cohorts).values([
    { programId, codigo: "C1", metaCupos: 10, precioUsd: "100" },
    { programId, codigo: "C2", metaCupos: 10, precioUsd: "200" },
  ]).returning();
  c1 = cohortes[0].id; c2 = cohortes[1].id;
});
afterAll(async () => cerrar());

async function sku(codigo: string, cohortId: string, extra: Partial<typeof skus.$inferInsert> = {}) {
  return (await db.insert(skus).values({ programId, nombre: codigo, slug: codigo.toLowerCase(), cohortId, codigo, precioListaUsd: "100", cuentaComoCupo: true, ...extra }).returning())[0];
}
async function lead() {
  return (await db.insert(leads).values({ programId, emailNormalizado: `${crypto.randomUUID()}@test.local`, entrada: "formulario", fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA }).returning())[0];
}

/**
 * Un deal nace con una propuesta por cada SKU predeterminado activo y solo vende la linea que recibe su primer
 * abono (tickets 460 y 464, ADR 0137). Es de base porque las lineas, el valor vendido y la cohorte del deal se
 * recalculan en SQL. El SKU de otro programa lo rechaza la FK compuesta de `deal_lineas` (programa como
 * frontera, AGENTS.md): es el unico test que la ejecuta.
 */
describe("propuestas de SKU y lineas del deal", () => {
  it("nace con una propuesta por cada SKU predeterminado activo y ninguna vende", async () => {
    await sku("B-C2", c2, { predeterminado: true });
    await sku("A-C1", c1, { predeterminado: true });
    const persona = await lead();
    const id = await abrirDeal(db, { leadId: persona.id, programId, etapa: "registrado", actor: { tipo: "sistema" }, ownerUserId: closerId });
    const lineas = await db.select().from(dealLineas).where(eq(dealLineas.dealId, id));
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    expect(lineas).toHaveLength(2);
    expect(deal.valorVendidoUsd).toBeNull();
  });

  it("sin predeterminados nace Sin SKU y con cohort_id nulo", async () => {
    const persona = await lead();
    const id = await abrirDeal(db, { leadId: persona.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
    expect(await db.select().from(dealLineas).where(eq(dealLineas.dealId, id))).toHaveLength(0);
    expect((await db.select().from(deals).where(eq(deals.id, id)))[0].cohortId).toBeNull();
  });

  it("no asigna un predeterminado inactivo", async () => {
    await sku("INACTIVO", c1, { predeterminado: true, activo: false });
    const persona = await lead();
    const id = await abrirDeal(db, { leadId: persona.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
    expect(await db.select().from(dealLineas).where(eq(dealLineas.dealId, id))).toHaveLength(0);
  });

  it("exige elegir línea con dos SKUs y usa automáticamente la única", async () => {
    const a = await sku("A", c1); const b = await sku("B", c2);
    const persona = await lead();
    const [deal] = await db.insert(deals).values({ leadId: persona.id, programId, etapa: "compromiso_verbal", ownerUserId: closerId }).returning();
    await asignarLinea(db, { deal, skuId: a.id, actorId: closerId, etiqueta: "A" });
    await asignarLinea(db, { deal, skuId: b.id, actorId: closerId, etiqueta: "B" });
    const actor = { userId: closerId, rol: "closer" as const, operaComoCloser: false };
    const base = { dealId: deal.id, fecha: "2026-11-20", monto: "10", moneda: "USD" as const, plataformaId, comprobanteUrl: "https://example.test/pago" };
    await expect(registrarAbono(db, actor, base)).rejects.toMatchObject({ status: 422, message: "Elige qué SKU está pagando" });
    await quitarLinea(db, { deal, lineaId: (await db.select().from(dealLineas).where(eq(dealLineas.skuId, b.id)))[0].id, actorId: closerId, etiqueta: "B" });
    await expect(registrarAbono(db, actor, base)).resolves.toMatchObject({ movioElDeal: true });
  });

  it("asigna, edita y quita sin abonos", async () => {
    const a = await sku("EDITABLE", c1); const persona = await lead();
    const [deal] = await db.insert(deals).values({ leadId: persona.id, programId, etapa: "compromiso_verbal", ownerUserId: closerId }).returning();
    const linea = await asignarLinea(db, { deal, skuId: a.id, actorId: closerId, etiqueta: "editable" });
    await editarValorDeLinea(db, { deal, lineaId: linea.id, valorVendidoUsd: 80, actorId: closerId, etiqueta: "editable" });
    expect((await db.select().from(dealLineas).where(eq(dealLineas.id, linea.id)))[0].valorVendidoUsd).toBe("80.00");
    await quitarLinea(db, { deal, lineaId: linea.id, actorId: closerId, etiqueta: "editable" });
    expect((await db.select().from(dealLineas).where(eq(dealLineas.id, linea.id)))[0].anuladaEn).not.toBeNull();
  });

  it("con abonos la línea no se quita: solo se anula; antes del primer abono nada suma y desde él suman todas las líneas (ADR 0137, 27-nov)", async () => {
    const a = await sku("PAGADA", c1); const b = await sku("PROPUESTA", c2);
    const persona = await lead();
    const [deal] = await db.insert(deals).values({ leadId: persona.id, programId, etapa: "compromiso_verbal", ownerUserId: closerId }).returning();
    const la = await asignarLinea(db, { deal, skuId: a.id, actorId: closerId, etiqueta: "A" });
    await asignarLinea(db, { deal, skuId: b.id, actorId: closerId, etiqueta: "B" });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].valorVendidoUsd).toBeNull();
    const actor = { userId: closerId, rol: "closer" as const, operaComoCloser: false };
    await registrarAbono(db, actor, {
      dealId: deal.id, lineaId: la.id, fecha: "2026-11-20", monto: "10", moneda: "USD" as const,
      plataformaId, comprobanteUrl: "https://example.test/pago",
    });
    // Con el primer abono del deal, toda línea vigente vende y suma su valor completo.
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].valorVendidoUsd).toBe("200.00");
    const actual = (await db.select().from(deals).where(eq(deals.id, deal.id)))[0];
    await expect(quitarLinea(db, { deal: actual, lineaId: la.id, actorId: closerId, etiqueta: "A" }))
      .rejects.toMatchObject({ status: 409 });
    await anularLinea(db, { deal: actual, lineaId: la.id, actorId: closerId, etiqueta: "A" });
    expect((await db.select().from(dealLineas).where(eq(dealLineas.id, la.id)))[0].anuladaEn).not.toBeNull();
  });

  it("deriva la cohorte de la vendida más antigua y desempata por N y código", async () => {
    const deC2 = await sku("A-C2", c2); const deC1 = await sku("Z-C1", c1); const persona = await lead();
    const [deal] = await db.insert(deals).values({ leadId: persona.id, programId, etapa: "compromiso_verbal", ownerUserId: closerId }).returning();
    const instante = new Date("2026-11-20T12:00:00Z");
    await asignarLinea(db, { deal, skuId: deC2.id, asignadaEn: instante, actorId: closerId, etiqueta: "C2" });
    await asignarLinea(db, { deal, skuId: deC1.id, asignadaEn: instante, actorId: closerId, etiqueta: "C1" });
    await recalcularDealPorLineas(db, deal.id, { actorId: closerId, etiqueta: "deal" });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0].cohortId).toBe(c1);
  });

  it("rechaza una linea con el SKU de otro programa", async () => {
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-programa-464", nombre: "Otro", ticketUsd: "100" }).returning();
    const [cohorteAjena] = await db.insert(cohorts).values({ programId: otro.id, codigo: "X1", metaCupos: 10, precioUsd: "100" }).returning();
    const ajeno = (await db.insert(skus).values({ programId: otro.id, nombre: "Ajeno", slug: "ajeno", cohortId: cohorteAjena.id, codigo: "AJENO", precioListaUsd: "100", cuentaComoCupo: true }).returning())[0];
    const persona = await lead();
    const [deal] = await db.insert(deals).values({ leadId: persona.id, programId, etapa: "compromiso_verbal", ownerUserId: closerId }).returning();
    await expect(
      db.insert(dealLineas).values({ dealId: deal.id, programId, skuId: ajeno.id, precioListaUsd: "100", valorVendidoUsd: "100" }),
    ).rejects.toThrow();
  });
});
