import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { anotar } from "@/lib/deals/anotar";
import { pasarDealsEsperandoCorte } from "@/lib/deals/pasar-esperando-corte";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { changeLog, cohorts, dealActividades, dealEtapaHistorial, deals, leads, motivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionCheck } from "@/lib/db/errores";
import { ErrorDeApp } from "@/lib/errors";
import { ventasPorCohorte } from "@/lib/queries/dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let origenId: string;
let destinoId: string;
let closerId: string;
let motivoPerdidoId: string;
let secuencia = 0;

const actor = () => ({ userId: closerId, rol: "closer" as const, operaComoCloser: false });

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "esperando-corte",
    nombre: "Esperando corte",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const cohortesCreadas = await db.insert(cohorts).values([
    {
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    },
    { programId, codigo: "C2", metaCupos: 10, precioUsd: "1000", estado: "futuro" },
  ]).returning();
  origenId = cohortesCreadas[0].id;
  destinoId = cohortesCreadas[1].id;
  closerId = (await db.insert(users).values({ email: "esperando@retia.co", nombre: "Closer", rol: "closer" }).returning())[0].id;
  motivoPerdidoId = (await db.insert(motivos).values({ nombre: "No sigue", tipo: "perdida" }).returning())[0].id;
});

afterAll(async () => cerrar());

async function nuevoDeal(programa = programId, cohorte = origenId) {
  const [lead] = await db.insert(leads).values({
    programId: programa,
    emailNormalizado: `espera-${secuencia++}@retia.co`,
    nombre: "Lead en espera",
  }).returning();
  return (await db.insert(deals).values({
    programId: programa,
    leadId: lead.id,
    cohortId: cohorte,
    ownerUserId: closerId,
    etapa: "contactado",
  }).returning())[0];
}

async function dejarEsperando(dealId: string, texto = "2027") {
  return anotar(db, actor(), { dealId, proximaCohorte: { textoCorte: texto } });
}

describe("Esperando corte", () => {
  it("guarda pendiente y texto sin cambiar la cohorte, con nota y rastro", async () => {
    const deal = await nuevoDeal();
    await dejarEsperando(deal.id, "  la de enero  ");

    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      cohortId: origenId,
      pendiente: "proxima_cohorte",
      cohorteDestinoId: null,
      cohorteDestinoTexto: "la de enero",
    });
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, deal.id))).toEqual([
      expect.objectContaining({ userId: null, nota: "Esperando corte: la de enero" }),
    ]);
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, deal.id))).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: "cohorteDestinoTexto", valorNuevo: "la de enero" })]),
    );
  });

  it("rechaza texto vacío con 400", async () => {
    const deal = await nuevoDeal();
    const error = await dejarEsperando(deal.id, "   ").catch((e) => e as ErrorDeApp);
    expect(error).toMatchObject({ status: 400, message: "Escribe a qué corte quiere entrar." });
  });

  it("el CHECK real rechaza Próxima Cohorte sin destino ni texto", async () => {
    const deal = await nuevoDeal();
    const error = await db.execute(sql`
      update deals set pendiente = 'proxima_cohorte', cohorte_destino_id = null, cohorte_destino_texto = null
      where id = ${deal.id}
    `).then(() => null, (e: unknown) => e);
    expect(esViolacionCheck(error)).toBe(true);
  });

  it("otro movimiento limpia el texto sin romper el CHECK", async () => {
    const deal = await nuevoDeal();
    await dejarEsperando(deal.id);
    await moverEtapa(db, {
      dealId: deal.id,
      a: "cierre_perdido",
      motivoId: motivoPerdidoId,
      actor: { tipo: "usuario", ...actor() },
    });
    expect((await db.select().from(deals).where(eq(deals.id, deal.id)))[0]).toMatchObject({
      etapa: "cierre_perdido",
      pendiente: null,
      cohorteDestinoTexto: null,
    });
  });

  it("pasa varios en una transacción, limpia la espera y rechaza otro programa", async () => {
    const uno = await nuevoDeal();
    const dos = await nuevoDeal();
    await dejarEsperando(uno.id, "enero");
    await dejarEsperando(dos.id, "2027");
    await pasarDealsEsperandoCorte(db, { dealIds: [uno.id, dos.id], destinoId, actor: { userId: closerId } });
    const movidos = await db.select().from(deals).where(sql`${deals.id} in (${uno.id}, ${dos.id})`);
    expect(movidos).toHaveLength(2);
    expect(movidos.every((d) => d.cohortId === destinoId && d.pendiente === null && d.cohorteDestinoTexto === null)).toBe(true);

    const [ajeno] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "ajeno-espera", nombre: "Ajeno", ticketUsd: "1000" }).returning();
    const [cohorteAjena] = await db.insert(cohorts).values({ programId: ajeno.id, codigo: "A1", metaCupos: 2, precioUsd: "1000", estado: "futuro" }).returning();
    const dealAjeno = await nuevoDeal(ajeno.id, cohorteAjena.id);
    await db.update(deals).set({ pendiente: "proxima_cohorte", cohorteDestinoTexto: "otra" }).where(eq(deals.id, dealAjeno.id));
    const error = await pasarDealsEsperandoCorte(db, {
      dealIds: [dealAjeno.id], destinoId, actor: { userId: closerId },
    }).catch((e) => e as ErrorDeApp);
    expect(error).toMatchObject({ status: 422 });
    expect((await db.select().from(deals).where(eq(deals.id, dealAjeno.id)))[0].cohortId).toBe(cohorteAjena.id);
  });

  it("cuenta la venta en la cohorte de origen mientras espera y en la nueva después", async () => {
    const deal = await nuevoDeal();
    await dejarEsperando(deal.id);
    await db.update(deals).set({ etapa: "ganado_parcial", valorVendidoUsd: "1000" }).where(eq(deals.id, deal.id));
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: "contactado", a: "ganado_parcial" });
    const alcance = { programId, rango: { desde: "2020-01-01", hasta: "2099-12-31" } };
    const antes = await ventasPorCohorte(alcance, db);
    expect(antes.find((fila) => fila.cohorteId === origenId)?.ventas).toBe(1);

    await pasarDealsEsperandoCorte(db, { dealIds: [deal.id], destinoId, actor: { userId: closerId } });
    const despues = await ventasPorCohorte(alcance, db);
    expect(despues.find((fila) => fila.cohorteId === origenId)?.ventas ?? 0).toBe(0);
    expect(despues.find((fila) => fila.cohorteId === destinoId)?.ventas).toBe(1);
  });
});
