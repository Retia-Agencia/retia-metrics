import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";
import { eq } from "drizzle-orm";
import { changeLog, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  cancelarCita,
  eventoParaAgendar,
  horasDisponibles,
  reservarCita,
} from "@/lib/calendly/escritura";
import { asignarEventoDeMembresia } from "@/lib/catalogo/usuarios";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const json = (status: number, cuerpo: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let dealId: string;
let ownerId: string;
let membresiaId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "p-280",
    nombre: "P 280",
    ticketUsd: "1000",
    calendlyUrl: "https://calendly.com/retia/round-robin",
  }).returning();
  programId = programa.id;
  await sembrarIntegracion(db, programId, "calendly", { token: "token-280", claveFirma: "firma-280" });
  const [owner] = await db.insert(users).values({ email: "owner@retia.co", nombre: "Nico", rol: "closer" }).returning();
  ownerId = owner.id;
  const [m] = await db.insert(miembrosPrograma).values({
    programId,
    userId: ownerId,
    calendlyEmail: "nico@calendly.co",
    calendlyEventType: "https://api.calendly.com/event_types/PERSONAL",
  }).returning();
  membresiaId = m.id;
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId: ownerId, etapa: "potencial" }).returning();
  dealId = deal.id;
});

describe("eventoParaAgendar", () => {
  it("usa el round robin en setteo y lleva el código del deal", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(200, { resource: { current_organization: "https://api.calendly.com/organizations/O" } }))
      .mockResolvedValueOnce(json(200, { collection: [{ uri: "https://api.calendly.com/event_types/RR", scheduling_url: "https://calendly.com/retia/round-robin" }], pagination: {} }));
    const evento = await eventoParaAgendar(db, dealId, fetchImpl);
    expect(evento).toMatchObject({
      eventTypeUri: "https://api.calendly.com/event_types/RR",
      conLocation: false,
      etiqueta: "Round robin del programa: Calendly asigna el closer",
    });
    expect(evento.tracking.utmContent).toBe(dealId.replaceAll("-", ""));
  });

  it("usa el evento personal del dueño fuera de setteo", async () => {
    await db.update(deals).set({ etapa: "agendado" }).where(eq(deals.id, dealId));
    await expect(eventoParaAgendar(db, dealId)).resolves.toMatchObject({
      eventTypeUri: "https://api.calendly.com/event_types/PERSONAL",
      conLocation: true,
      tracking: { utmContent: null },
      etiqueta: "Agenda de Nico",
    });
  });

  it("rechaza un dueño sin evento personal", async () => {
    await db.update(deals).set({ etapa: "agendado" }).where(eq(deals.id, dealId));
    await db.update(miembrosPrograma).set({ calendlyEventType: null }).where(eq(miembrosPrograma.id, membresiaId));
    const error = await eventoParaAgendar(db, dealId).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error).toMatchObject({ status: 422, message: "Nico no tiene su evento de Calendly configurado en este programa." });
  });

  it.each([0, 2])("rechaza round robin no encontrado o ambiguo (%s coincidencias)", async (cantidad) => {
    const coincidencias = Array.from({ length: cantidad }, (_, i) => ({ uri: `https://api.calendly.com/event_types/R${i}`, scheduling_url: "https://calendly.com/retia/round-robin" }));
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(200, { resource: { current_organization: "https://api.calendly.com/organizations/O" } }))
      .mockResolvedValueOnce(json(200, { collection: coincidencias, pagination: {} }));
    const error = await eventoParaAgendar(db, dealId, fetchImpl).catch((e) => e);
    expect(error).toMatchObject({ status: 422 });
  });
});

describe("API de escritura", () => {
  it("filtra horas disponibles", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { collection: [
      { status: "available", start_time: "2026-10-20T14:00:00Z" },
      { status: "unavailable", start_time: "2026-10-20T15:00:00Z" },
    ] }));
    const horas = await horasDisponibles("token", "evento", new Date("2026-10-20T00:00:00Z"), new Date("2026-10-27T00:00:00Z"), fetchImpl);
    expect(horas.map((h) => h.toISOString())).toEqual(["2026-10-20T14:00:00.000Z"]);
  });

  it("reserva con las seis llaves de tracking y lee el evento", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(201, { resource: { uri: "https://api.calendly.com/invitees/INV", event: "https://api.calendly.com/scheduled_events/EV" } }))
      .mockResolvedValueOnce(json(200, { resource: {
        uri: "https://api.calendly.com/scheduled_events/EV",
        start_time: "2026-10-20T14:00:00Z",
        event_memberships: [{ user_email: "Host@Calendly.co" }],
        location: { join_url: "https://meet.google.com/abc" },
      } }));
    const cita = await reservarCita("token", {
      eventTypeUri: "https://api.calendly.com/event_types/E",
      startTime: new Date("2026-10-20T14:00:00Z"),
      invitado: { nombre: "Ana", correo: "ana@correo.co" },
      conLocation: true,
      tracking: { utmContent: "codigo" },
    }, fetchImpl);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.tracking).toEqual({ utm_source: "crm", utm_medium: "agenda", utm_campaign: null, utm_content: "codigo", utm_term: null, salesforce_uuid: null });
    expect(cita).toMatchObject({ uuidInvitado: "INV", uriEvento: "https://api.calendly.com/scheduled_events/EV", hostEmail: "host@calendly.co", joinUrl: "https://meet.google.com/abc" });
  });

  it.each([
    [403, "Event is already canceled", "ya_cancelada"],
    [400, "Event in the past", "pasada"],
    [201, "", "cancelada"],
  ])("clasifica la cancelación %s", async (status, message, esperado) => {
    await expect(cancelarCita("token", "https://api.calendly.com/scheduled_events/EV", "Cancelada", vi.fn().mockResolvedValue(json(status as number, { message })))).resolves.toBe(esperado);
  });
});

describe("asignarEventoDeMembresia", () => {
  it("valida pertenencia y deja change_log", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json(200, { resource: { current_organization: "https://api.calendly.com/organizations/O" } }))
      .mockResolvedValueOnce(json(200, { collection: [{ user: { uri: "https://api.calendly.com/users/U" } }], pagination: {} }))
      .mockResolvedValueOnce(json(200, { collection: [{ uri: "https://api.calendly.com/event_types/NUEVO", name: "30 minutos", active: true }], pagination: {} }));
    await asignarEventoDeMembresia(db, ownerId, { membresiaId, calendlyEventType: "https://api.calendly.com/event_types/NUEVO" }, { fetch: fetchImpl });
    const [m] = await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.id, membresiaId));
    const rastros = await db.select().from(changeLog).where(eq(changeLog.registroId, membresiaId));
    expect(m.calendlyEventType).toBe("https://api.calendly.com/event_types/NUEVO");
    expect(rastros.some((r) => r.campo === "calendlyEventType")).toBe(true);
  });

  it("impide que otro closer cambie la membresía", async () => {
    const [otro] = await db.insert(users).values({ email: "otro@retia.co", rol: "closer" }).returning();
    await expect(asignarEventoDeMembresia(db, otro.id, { membresiaId, calendlyEventType: null })).rejects.toThrow("Solo puedes cambiar tu propio evento");
  });
});
