import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";
import { eq } from "drizzle-orm";
import { calls, dealActividades, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agregarLlamada, reagendarLlamada } from "@/lib/deals/llamadas";
import { registrarLlamadaDeCalendly } from "@/lib/calendly/colgar-llamada";
import { aplicarEventoDeCalendly } from "@/lib/calendly/eventos-de-cita";
import { codigoDeDeal } from "@/lib/calendly/link-de-agenda";
import { reservarCita, type CitaReservada } from "@/lib/calendly/escritura";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const json = (status: number, cuerpo: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });
const actor = (userId: string) => ({ userId, rol: "closer" as const, operaComoCloser: false });
const cita = (uuid: string): CitaReservada => ({
  uuidInvitado: uuid,
  uriEvento: `https://api.calendly.com/scheduled_events/${uuid}`,
  fecha: new Date("2026-11-20T15:00:00Z"),
  hostEmail: "nico@calendly.co",
  joinUrl: "https://meet.google.com/nueva",
});

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let dealId: string;
let ownerId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "r-280", nombre: "R 280", ticketUsd: "1000" }).returning();
  programId = p.id;
  await sembrarIntegracion(db, programId, "calendly", { token: "token", claveFirma: "firma" });
  const [u] = await db.insert(users).values({ email: "nico@retia.co", nombre: "Nico", rol: "closer" }).returning();
  ownerId = u.id;
  await db.insert(miembrosPrograma).values({ programId, userId: ownerId, calendlyEmail: "nico@calendly.co", calendlyEventType: "https://api.calendly.com/event_types/E" });
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" }).returning();
  const [d] = await db.insert(deals).values({ programId, leadId: l.id, ownerUserId: ownerId, etapa: "agendado" }).returning();
  dealId = d.id;
});

async function vieja(fechaAgenda: Date) {
  const [call] = await db.insert(calls).values({
    dealId,
    programId,
    emailLead: "ana@correo.co",
    closerUserId: ownerId,
    fechaAgenda,
    resultado: "agendada",
    origen: "calendly",
    huellaFila: "calendly:VIEJA",
  }).returning();
  return call;
}

describe("reagendar contra Calendly", () => {
  it("si la reserva falla no escribe ninguna llamada", async () => {
    await expect(reservarCita("token", {
      eventTypeUri: "https://api.calendly.com/event_types/E",
      startTime: new Date("2026-11-20T15:00:00Z"),
      invitado: { nombre: "Ana", correo: "ana@correo.co" },
      conLocation: true,
      tracking: { utmContent: null },
    }, vi.fn().mockResolvedValue(json(400, { message: "The event is not available" })))).rejects.toThrow("The event is not available");
    expect(await db.select().from(calls)).toHaveLength(0);
  });

  it("deja la vieja reagendada, nota y cancelación pendiente si Calendly falla", async () => {
    const anterior = await vieja(new Date("2026-11-19T15:00:00Z"));
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(200, { resource: { current_organization: "https://api.calendly.com/organizations/O" } }))
      .mockResolvedValueOnce(json(200, { collection: [{ uri: "https://api.calendly.com/scheduled_events/VIEJA", start_time: "2026-11-19T15:00:00Z", event_memberships: [{ user_email: "nico@calendly.co" }] }], pagination: {} }))
      .mockResolvedValueOnce(json(200, { collection: [{ uri: "https://api.calendly.com/scheduled_events/VIEJA/invitees/VIEJA", status: "active" }], pagination: {} }))
      .mockResolvedValueOnce(json(500, { message: "Calendly no disponible" }));
    const resultado = await reagendarLlamada(db, actor(ownerId), { callId: anterior.id, cita: cita("NUEVA") }, undefined, { fetch: fetchImpl, ahora: new Date("2026-11-01T00:00:00Z") });
    const [guardada] = await db.select().from(calls).where(eq(calls.id, anterior.id));
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
    expect(resultado.cancelacionPendiente).toBe(true);
    expect(guardada.resultado).toBe("reagendada");
    expect(notas.some((n) => n.nota?.includes("no se pudo cancelar"))).toBe(true);
  });

  it("no intenta cancelar una cita pasada", async () => {
    const anterior = await vieja(new Date("2026-10-01T15:00:00Z"));
    const fetchImpl = vi.fn();
    const resultado = await reagendarLlamada(db, actor(ownerId), { callId: anterior.id, cita: cita("NUEVA") }, undefined, { fetch: fetchImpl, ahora: new Date("2026-11-01T00:00:00Z") });
    expect(resultado.cancelacionPendiente).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("idempotencia CRM/webhook", () => {
  it("CRM primero: el webhook adopta la huella y guarda el Meet sin duplicar", async () => {
    await db.update(deals).set({ etapa: "potencial" }).where(eq(deals.id, dealId));
    await agregarLlamada(db, actor(ownerId), { dealId, cita: cita("MISMA") });
    await registrarLlamadaDeCalendly(db, programId, {
      uuidInvitado: "MISMA",
      inicio: cita("MISMA").fecha,
      correoInvitado: "ana@correo.co",
      correoHost: "nico@calendly.co",
      linkCalendly: "https://meet.google.com/webhook",
      utmContent: codigoDeDeal(dealId),
    });
    const filas = await db.select().from(calls).where(eq(calls.huellaFila, "calendly:MISMA"));
    expect(filas).toHaveLength(1);
    expect(filas[0].linkCalendly).toBe("https://meet.google.com/webhook");
  });

  it("webhook primero: la reserva del CRM adopta la llamada existente", async () => {
    await db.update(deals).set({ etapa: "potencial" }).where(eq(deals.id, dealId));
    await registrarLlamadaDeCalendly(db, programId, {
      uuidInvitado: "MISMA",
      inicio: cita("MISMA").fecha,
      correoInvitado: "ana@correo.co",
      correoHost: "nico@calendly.co",
      linkCalendly: "https://meet.google.com/webhook",
      utmContent: codigoDeDeal(dealId),
    });
    await agregarLlamada(db, actor(ownerId), { dealId, cita: cita("MISMA") });
    expect(await db.select().from(calls).where(eq(calls.huellaFila, "calendly:MISMA"))).toHaveLength(1);
  });

  it("invitee.canceled no cambia una llamada ya reagendada", async () => {
    const [call] = await db.insert(calls).values({ dealId, programId, resultado: "reagendada", origen: "calendly", huellaFila: "calendly:CANCELADA" }).returning();
    const resultado = await aplicarEventoDeCalendly(db, programId, { tipo: "cancelada", uuidInvitado: "CANCELADA", reagendada: false, claveEvento: "cancelada:1" });
    const [guardada] = await db.select().from(calls).where(eq(calls.id, call.id));
    expect(resultado.tipo).toBe("sin_cambio");
    expect(guardada.resultado).toBe("reagendada");
  });
});
