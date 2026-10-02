import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { calls, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { agregarLlamada, completarAgendada, marcarFallida } from "@/lib/deals/llamadas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("contratos nuevos de llamadas del ticket 142", () => {
let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closer: string;
let n = 0;
const actor = () => ({ userId: closer, rol: "closer" as const });
beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning())[0].id;
  closer = (await db.insert(users).values({ email: "closer@retia.co", rol: "closer" }).returning())[0].id;
});
afterEach(async () => cerrar());

async function nuevo(etapa: EtapaDeal, pendiente: PendienteDeal | null = null) {
  const lead = (await db.insert(leads).values({ programId, emailNormalizado: `l${n++}@retia.co` }).returning())[0];
  return (await db.insert(deals).values({ leadId: lead.id, programId, etapa, pendiente, ownerUserId: closer }).returning())[0];
}
const estado = async (id: string) => (await db.select().from(deals).where(eq(deals.id, id)))[0];

describe("cita nueva", () => {
  it.each(["potencial", "registrado", "en_gestion", "contactado", "calificado"] as const)("%s pasa a Agendado", async (etapa) => {
    const d = await nuevo(etapa);
    expect((await agregarLlamada(db, actor(), { dealId: d.id, fechaAgenda: new Date() })).movioAAgendado).toBe(true);
    expect(await estado(d.id)).toMatchObject({ etapa: "agendado", pendiente: null });
  });

  it("Agendado con pendiente usa E7 y lo limpia", async () => {
    const d = await nuevo("agendado", "reagenda");
    await agregarLlamada(db, actor(), { dealId: d.id, fechaAgenda: new Date() });
    expect(await estado(d.id)).toMatchObject({ etapa: "agendado", pendiente: null });
    expect(await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, d.id))).toMatchObject([{ de: "agendado", a: "agendado", pendienteDe: "reagenda", pendienteA: null }]);
  });

  it("Atendido con pendiente usa E9; sin pendiente no se mueve", async () => {
    const con = await nuevo("atendido", "seguimiento");
    await agregarLlamada(db, actor(), { dealId: con.id, fechaAgenda: new Date() });
    expect(await estado(con.id)).toMatchObject({ etapa: "agendado", pendiente: null });
    const sin = await nuevo("atendido");
    expect((await agregarLlamada(db, actor(), { dealId: sin.id, fechaAgenda: new Date() })).movioAAgendado).toBe(false);
    expect((await estado(sin.id)).etapa).toBe("atendido");
  });

  it.each(["compromiso_verbal", "ganado_parcial"] as const)("%s nunca se mueve por una cita", async (etapa) => {
    const d = await nuevo(etapa, "seguimiento");
    expect((await agregarLlamada(db, actor(), { dealId: d.id, fechaAgenda: new Date() })).movioAAgendado).toBe(false);
    expect((await estado(d.id)).etapa).toBe(etapa);
  });

  it("completar una agendada también aplica la regla de la cita", async () => {
    const d = await nuevo("atendido", "reagenda");
    const call = (await db.insert(calls).values({ dealId: d.id, programId, resultado: "agendada", origen: "calendly" }).returning())[0];
    await completarAgendada(db, actor(), { callId: call.id, fechaAgenda: new Date() });
    expect(await estado(d.id)).toMatchObject({ etapa: "agendado", pendiente: null });
  });
});

describe("llamada fallida", () => {
  it.each(["no_show", "cancelada"] as const)("%s pone Re-agenda sin cambiar Agendado", async (resultado) => {
    const d = await nuevo("agendado");
    const call = (await db.insert(calls).values({ dealId: d.id, programId, resultado: "agendada", origen: "crm", createdAt: new Date() }).returning())[0];
    const r = await marcarFallida(db, actor(), { callId: call.id, resultado });
    expect(r.etapa).toBe("agendado");
    expect(await estado(d.id)).toMatchObject({ etapa: "agendado", pendiente: "reagenda" });
  });

  it("fuera de Agendado rechaza PR1 y revierte el resultado", async () => {
    const d = await nuevo("atendido");
    const call = (await db.insert(calls).values({ dealId: d.id, programId, resultado: "show", origen: "crm" }).returning())[0];
    await expect(marcarFallida(db, actor(), { callId: call.id, resultado: "no_show" })).rejects.toThrow();
    expect((await db.select().from(calls).where(eq(calls.id, call.id)))[0].resultado).toBe("show");
  });
});
});
