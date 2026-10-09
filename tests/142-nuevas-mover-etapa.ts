import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { calls, changeLog, cohorts, dealActividades, dealEtapaHistorial, deals, leads, motivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal, moverEtapa, MovimientoRechazado, type Actor } from "@/lib/deals/mover-etapa";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("contratos nuevos de moverEtapa del ticket 142", () => {
let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closer: string;
let perdida: string;
let retroceso: string;
let recuperacion: string;
let secuencia = 0;
const sistema: Actor = { tipo: "sistema" };
const actor = (): Actor => ({ tipo: "usuario", userId: closer, rol: "closer" });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [u] = await db.insert(users).values({ email: "closer@retia.co", rol: "closer" }).returning();
  closer = u.id;
  [perdida, retroceso, recuperacion] = (await db.insert(motivos).values([
    { nombre: "Perdió", tipo: "perdida" }, { nombre: "Retrocedió", tipo: "retroceso" }, { nombre: "Volvió", tipo: "recuperacion" },
  ]).returning()).map((m) => m.id);
});
afterEach(async () => cerrar());

async function nuevo(etapa: EtapaDeal, pendiente: PendienteDeal | null = null, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `persona-${secuencia++}@retia.co` }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id, programId, etapa, pendiente, ownerUserId: closer,
    valorVendidoUsd: "1000", ...extra,
  }).returning();
  return deal;
}
const fila = async (id: string) => (await db.select().from(deals).where(eq(deals.id, id)))[0];
const historial = (id: string) => db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, id));
async function rechaza(p: Promise<unknown>) {
  try { await p; } catch (e) { return e as MovimientoRechazado; }
  throw new Error("Se esperaba rechazo");
}

describe("estado compuesto e historial", () => {
  it("todo cambio de etapa limpia el pendiente y guarda antes/después", async () => {
    const d = await nuevo("contactado", "seguimiento");
    await db.insert(dealActividades).values({ dealId: d.id, tipo: "contacto", canal: "WhatsApp", userId: closer });
    const hecho = await moverEtapa(db, { dealId: d.id, a: "calificado", actor: actor() });
    expect(hecho).toMatchObject({ de: "contactado", a: "calificado", pendienteDe: "seguimiento", pendienteA: null, transicion: { id: "E3" } });
    expect(await fila(d.id)).toMatchObject({ etapa: "calificado", pendiente: null });
    expect(await historial(d.id)).toMatchObject([{ pendienteDe: "seguimiento", pendienteA: null }]);
  });

  it("E9 solo devuelve Atendido a Agendado si había pendiente", async () => {
    const sin = await nuevo("atendido");
    await db.insert(calls).values({ dealId: sin.id, programId, resultado: "agendada", origen: "crm", fechaAgenda: new Date() });
    expect((await rechaza(moverEtapa(db, { dealId: sin.id, a: "agendado", actor: actor() }))).status).toBe(409);

    const con = await nuevo("atendido", "reagenda");
    await db.insert(calls).values({ dealId: con.id, programId, resultado: "agendada", origen: "crm", fechaAgenda: new Date() });
    await moverEtapa(db, { dealId: con.id, a: "agendado", actor: actor() });
    expect(await fila(con.id)).toMatchObject({ etapa: "agendado", pendiente: null });
  });

  it("RETRO decide el destino por el historial y fuerza Seguimiento", async () => {
    const d = await nuevo("compromiso_verbal", null, { fechaSeguimiento: "2026-10-20" });
    await db.insert(dealEtapaHistorial).values({ dealId: d.id, de: "calificado", a: "compromiso_verbal" });
    const error = await rechaza(moverEtapa(db, { dealId: d.id, a: "atendido", actor: actor(), motivoId: retroceso }));
    expect(error.status).toBe(409);
    await moverEtapa(db, { dealId: d.id, a: "calificado", actor: actor(), motivoId: retroceso });
    expect(await fila(d.id)).toMatchObject({ etapa: "calificado", pendiente: "seguimiento" });
  });

  it("dos movimientos dentro de una transacción quedan ordenados por clock_timestamp", async () => {
    const d = await nuevo("registrado");
    await db.insert(dealActividades).values({ dealId: d.id, tipo: "contacto", canal: "WhatsApp", userId: closer });
    await moverEtapa(db, { dealId: d.id, a: "en_gestion", actor: sistema });
    await moverEtapa(db, { dealId: d.id, a: "contactado", actor: sistema });
    const h = await historial(d.id);
    expect(h.map((x) => x.a)).toEqual(["en_gestion", "contactado"]);
    expect(h[1].fecha.getTime()).toBeGreaterThanOrEqual(h[0].fecha.getTime());
  });
});

describe("pendientes y Próxima Cohorte", () => {
  async function cohortes() {
    const base = { programId, metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-30" };
    const [origen, destino] = await db.insert(cohorts).values([
      { ...base, codigo: "O", estado: "activo", fechaInicioVentas: "2026-09-01" },
      { ...base, codigo: "D", estado: "futuro", fechaInicioVentas: "2026-10-01" },
    ]).returning();
    return { origen, destino };
  }

  it("PC pone el pendiente sin cambiar etapa; RET exige contacto desde apertura y muda con rastro", async () => {
    const { origen, destino } = await cohortes();
    const d = await nuevo("calificado", null, { cohortId: origen.id });
    await moverEtapa(db, { dealId: d.id, a: "calificado", pendiente: "proxima_cohorte", actor: actor(), datos: { cohorteDestinoId: destino.id } });
    expect(await fila(d.id)).toMatchObject({ etapa: "calificado", pendiente: "proxima_cohorte", cohortId: origen.id });

    await db.insert(dealActividades).values({ dealId: d.id, tipo: "contacto", canal: "correo", userId: closer, fecha: new Date("2026-09-30T12:00:00-05:00") });
    expect((await rechaza(moverEtapa(db, { dealId: d.id, a: "calificado", pendiente: null, actor: sistema }))).faltantes.map((f) => f.codigo)).toEqual(["contacto"]);
    await db.insert(dealActividades).values({ dealId: d.id, tipo: "contacto", canal: "correo", userId: closer, fecha: new Date("2026-10-01T00:00:00-05:00") });
    await db.delete(changeLog);
    await moverEtapa(db, { dealId: d.id, a: "calificado", pendiente: null, actor: sistema });
    expect(await fila(d.id)).toMatchObject({ pendiente: null, cohortId: destino.id });
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, d.id))).toEqual(expect.arrayContaining([expect.objectContaining({ campo: "cohortId" })]));
  });

  it("Cierre perdido limpia Próxima Cohorte sin mudar la cohorte", async () => {
    const { origen, destino } = await cohortes();
    const d = await nuevo("calificado", "proxima_cohorte", { cohortId: origen.id, cohorteDestinoId: destino.id });
    await moverEtapa(db, { dealId: d.id, a: "cierre_perdido", actor: actor(), motivoId: perdida });
    expect(await fila(d.id)).toMatchObject({ etapa: "cierre_perdido", pendiente: null, cohortId: origen.id });
  });

  it("R a En gestión admite Próxima Cohorte y exige su destino", async () => {
    const { origen, destino } = await cohortes();
    const sin = await nuevo("cierre_perdido", null, { cohortId: origen.id });
    expect((await rechaza(moverEtapa(db, { dealId: sin.id, a: "en_gestion", pendiente: "proxima_cohorte", actor: actor(), motivoId: recuperacion }))).faltantes.map((f) => f.codigo)).toContain("cohorte_destino");
    await moverEtapa(db, { dealId: sin.id, a: "en_gestion", pendiente: "proxima_cohorte", actor: actor(), motivoId: recuperacion, datos: { cohorteDestinoId: destino.id } });
    expect(await fila(sin.id)).toMatchObject({ etapa: "en_gestion", pendiente: "proxima_cohorte" });
  });
});

describe("nacimientos", () => {
  it("el sistema nace en sus cuatro puertas y el usuario solo en En gestión con dueño", async () => {
    for (const etapa of ["potencial", "registrado", "calificado", "agendado"] as const) {
      const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `alta-${secuencia++}@retia.co` }).returning();
      const id = await abrirDeal(db, { leadId: lead.id, programId, etapa, actor: sistema });
      expect(await fila(id)).toMatchObject({ etapa, ownerUserId: null });
    }
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "manual@retia.co" }).returning();
    const id = await abrirDeal(db, { leadId: lead.id, programId, etapa: "en_gestion", actor: actor() });
    expect(await fila(id)).toMatchObject({ etapa: "en_gestion", ownerUserId: closer });
    expect((await historial(id))[0]).toMatchObject({ de: null, a: "en_gestion", pendienteDe: null, pendienteA: null });
  });
});
});
