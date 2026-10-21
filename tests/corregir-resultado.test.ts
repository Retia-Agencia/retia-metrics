import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { corregirResultado } from "@/lib/deals/llamadas";
import { ErrorDeApp } from "@/lib/errors";
import { agrupar as agruparCitas } from "@/lib/queries/hechos/cita";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let cohortId: string;
let closer: string;
let otroCloser: string;
let developer: string;
let motivoReagenda: string;
let secuencia = 0;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));

beforeEach(async () => {
  await vaciar();
  secuencia = 0;
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = programa.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId,
    codigo: "C1",
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioClases: "2026-10-30",
    fechaCierreVentas: "2026-10-29",
  }).returning();
  cohortId = cohorte.id;
  [closer, otroCloser, developer] = (await db.insert(users).values([
    { email: "maru@retia.test", rol: "closer" },
    { email: "otro@retia.test", rol: "closer" },
    { email: "dev@retia.test", rol: "developer" },
  ]).returning()).map((usuario) => usuario.id);
  const [motivo] = await db.insert(motivos).values({ nombre: "No asistió", tipo: "reagenda" }).returning();
  motivoReagenda = motivo.id;
});

afterAll(async () => cerrar());

const actor = (userId = closer, rol: "closer" | "developer" = "closer") => ({
  userId,
  rol,
  operaComoCloser: false,
});

async function crearCaso(
  etapa: EtapaDeal,
  resultado: "agendada" | "reagendada" | "show" | "no_show" | "cancelada",
  opciones: { pendiente?: "reagenda" | null; ownerUserId?: string; anulada?: boolean } = {},
) {
  secuencia += 1;
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: `persona-${secuencia}@retia.test`,
  }).returning();
  const [deal] = await db.insert(deals).values({
    leadId: lead.id,
    programId,
    cohortId,
    etapa,
    pendiente: opciones.pendiente ?? null,
    ownerUserId: opciones.ownerUserId ?? closer,
  }).returning();
  const fechaAgenda = new Date("2026-10-20T14:30:00-05:00");
  const [call] = await db.insert(calls).values({
    dealId: deal.id,
    programId,
    cohortId,
    closerUserId: closer,
    emailLead: lead.emailNormalizado,
    fechaAgenda,
    fechaLlamada: resultado === "show" ? fechaAgenda : null,
    resultado,
    origen: "crm",
    ...(opciones.anulada
      ? { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "Duplicada" }
      : {}),
  }).returning();
  return { deal, call };
}

async function estado(dealId: string, callId: string) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
  const [call] = await db.select().from(calls).where(eq(calls.id, callId));
  const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
  const notas = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
  return { deal, call, historial, notas };
}

async function rechaza(promesa: Promise<unknown>) {
  try {
    await promesa;
    throw new Error("Se esperaba un rechazo");
  } catch (error) {
    expect(error).toBeInstanceOf(ErrorDeApp);
    return error as ErrorDeApp;
  }
}

describe("corregirResultado", () => {
  it("show → no_show deja Re-agenda por PR2, rastro y nota, y deja de contar como show", async () => {
    const { deal, call } = await crearCaso("atendido", "show");

    await corregirResultado(db, actor(), {
      callId: call.id,
      resultado: "no_show",
      motivo: "Se marcó por error",
      motivoReagendaId: motivoReagenda,
    });

    const actual = await estado(deal.id, call.id);
    expect(actual.call.resultado).toBe("no_show");
    expect(actual.deal).toMatchObject({ etapa: "atendido", pendiente: "reagenda" });
    expect(actual.historial).toMatchObject([{
      de: "atendido", a: "atendido", pendienteDe: null, pendienteA: "reagenda", motivoId: motivoReagenda, userId: closer,
    }]);
    expect(actual.notas).toMatchObject([{
      tipo: "nota",
      userId: closer,
      nota: "Corrigió el resultado de la llamada del 20 oct 2026, 14:30: Show → No show. Motivo: Se marcó por error",
    }]);
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, call.id))).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: "resultado", valorAnterior: "show", valorNuevo: "no_show", userId: closer })]),
    );
    const cifras = await agruparCitas(db, {
      programId,
      rango: { desde: "2026-10-01", hasta: "2026-10-31" },
      agruparPor: ["ocurrio"],
    });
    expect(cifras.reduce((total, fila) => total + fila.shows, 0)).toBe(0);
  });

  it.each([
    ["atendido", "reagenda"],
    ["agendado", "reagenda"],
    ["agendado", null],
  ] as const)("no_show → show desde %s con pendiente %s pasa a Atendido sin pendiente", async (etapa, pendiente) => {
    const { deal, call } = await crearCaso(etapa, "no_show", { pendiente });

    await corregirResultado(db, actor(), { callId: call.id, resultado: "show", motivo: "Sí asistió" });

    const actual = await estado(deal.id, call.id);
    expect(actual.call.resultado).toBe("show");
    expect(actual.call.fechaLlamada).toEqual(call.fechaAgenda);
    expect(actual.deal).toMatchObject({ etapa: "atendido", pendiente: null });
    expect(actual.historial).toHaveLength(1);
    expect(actual.historial[0].userId).toBeNull();
  });

  it("no_show ↔ cancelada solo cambia el resultado, incluso en una etapa avanzada", async () => {
    const { deal, call } = await crearCaso("cierre_perdido", "no_show");

    await corregirResultado(db, actor(), { callId: call.id, resultado: "cancelada", motivo: "Avisó antes" });
    expect(await estado(deal.id, call.id)).toMatchObject({
      call: { resultado: "cancelada" },
      deal: { etapa: "cierre_perdido", pendiente: null },
      historial: [],
    });

    await corregirResultado(db, actor(), { callId: call.id, resultado: "no_show", motivo: "No avisó" });
    expect(await estado(deal.id, call.id)).toMatchObject({
      call: { resultado: "no_show" },
      deal: { etapa: "cierre_perdido", pendiente: null },
      historial: [],
    });
  });

  it.each(["agendada", "reagendada"] as const)("rechaza una llamada %s sin mover la base", async (resultado) => {
    const { deal, call } = await crearCaso("agendado", resultado);
    const error = await rechaza(corregirResultado(db, actor(), { callId: call.id, resultado: "show", motivo: "Corrección" }));
    expect(error.status).toBe(409);
    expect(await estado(deal.id, call.id)).toMatchObject({ call: { resultado }, historial: [], notas: [] });
  });

  it("rechaza el mismo resultado y el motivo vacío", async () => {
    const { deal, call } = await crearCaso("atendido", "show");
    expect((await rechaza(corregirResultado(db, actor(), { callId: call.id, resultado: "show", motivo: "Igual" }))).status).toBe(409);
    expect((await rechaza(corregirResultado(db, actor(), { callId: call.id, resultado: "no_show", motivo: "  " }))).status).toBe(400);
    expect(await estado(deal.id, call.id)).toMatchObject({ call: { resultado: "show" }, historial: [], notas: [] });
  });

  it("rechaza show → no_show cuando el deal ya avanzó", async () => {
    const { deal, call } = await crearCaso("ganado_completo", "show");
    const error = await rechaza(corregirResultado(db, actor(), {
      callId: call.id, resultado: "no_show", motivo: "No asistió", motivoReagendaId: motivoReagenda,
    }));
    expect(error).toMatchObject({ status: 409, message: "El deal ya avanzó; corrígelo primero desde el deal." });
    expect(await estado(deal.id, call.id)).toMatchObject({ call: { resultado: "show" }, historial: [], notas: [] });
  });

  it("rechaza una llamada anulada y a otro closer sin mover nada", async () => {
    const anulada = await crearCaso("atendido", "show", { anulada: true });
    expect((await rechaza(corregirResultado(db, actor(), {
      callId: anulada.call.id, resultado: "no_show", motivo: "No asistió", motivoReagendaId: motivoReagenda,
    }))).status).toBe(404);
    expect(await estado(anulada.deal.id, anulada.call.id)).toMatchObject({ call: { resultado: "show" }, historial: [], notas: [] });

    const ajena = await crearCaso("atendido", "show", { ownerUserId: otroCloser });
    expect((await rechaza(corregirResultado(db, actor(), {
      callId: ajena.call.id, resultado: "no_show", motivo: "No asistió", motivoReagendaId: motivoReagenda,
    }))).status).toBe(403);
    expect(await estado(ajena.deal.id, ajena.call.id)).toMatchObject({ call: { resultado: "show" }, historial: [], notas: [] });
  });

  it("el developer puede corregir un deal ajeno", async () => {
    const { deal, call } = await crearCaso("atendido", "show", { ownerUserId: otroCloser });
    await corregirResultado(db, actor(developer, "developer"), {
      callId: call.id, resultado: "cancelada", motivo: "Corrección del dueño", motivoReagendaId: motivoReagenda,
    });
    expect(await estado(deal.id, call.id)).toMatchObject({
      call: { resultado: "cancelada" },
      deal: { etapa: "atendido", pendiente: "reagenda" },
    });
  });
});
