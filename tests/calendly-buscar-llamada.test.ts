import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { calls, dealActividades, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { buscarLlamadaDelDeal, linkDeAgendaDelEnvio } from "@/lib/calendly/buscar-llamada";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * "Buscar llamada" (ticket 096): vuelve a preguntarle a Calendly por la cita de un deal.
 * Contra PGlite y por el camino real del 052 (`aplicarReglaDeDeal`); solo la API de
 * Calendly es de mentira, inyectada por `fetch`.
 */

const UUID = "a1b2c3d4-0000-4000-8000-00000000abcd";
const LINK = `https://calendly.com/d/abc-123/entrevista/invitees/${UUID}`;
const INICIO = "2026-10-02T15:00:00.000Z";
const EVENTO = "https://api.calendly.com/scheduled_events/evento-1";

function calendly(estado: "active" | "canceled") {
  return vi.fn(async (url: string) => {
    const json = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo });
    if (url.endsWith("/users/me")) {
      return json({ resource: { current_organization: "https://api.calendly.com/organizations/o" } });
    }
    if (url.includes("/scheduled_events?")) {
      return json({ collection: [{ uri: EVENTO, start_time: INICIO, status: estado }], pagination: {} });
    }
    if (url.startsWith(`${EVENTO}/invitees`)) {
      return json({ collection: [{ uri: `${EVENTO}/invitees/${UUID}`, status: "active" }], pagination: {} });
    }
    throw new Error(`URL inesperada ${url}`);
  });
}

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let leadId: string;
let dealId: string;
let developer: string;
let closerAjeno: string;

async function envio(respuestas: Record<string, string>, token = "tok-1") {
  const [fuente] = await db.select().from(sources).where(eq(sources.programId, programId));
  await db.insert(submissions).values({
    leadId,
    sourceId: fuente.id,
    token,
    fechaEnvio: new Date("2026-09-28T15:00:00Z"),
    estadoHoja: "con_calendly",
    respuestas,
  });
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" })
    .returning();
  programId = p.id;
  await db.insert(sources).values({
    programId,
    nombre: "Typeform",
    tipo: "webhook",
    proveedor: "typeform",
    secretoWebhook: "s",
    activo: true,
    mapeoColumnas: { agenda: "Agenda aquí tu entrevista" },
  });
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" })
    .returning();
  leadId = l.id;
  dealId = await abrirDeal(db, { leadId, programId, etapa: "registrado", actor: { tipo: "sistema" } });
  const [d] = await db.insert(users).values({ email: "dev@retiagrowth.com", rol: "developer" }).returning();
  developer = d.id;
  const [c] = await db.insert(users).values({ email: "otra@retiagrowth.com", rol: "closer" }).returning();
  closerAjeno = c.id;
});

afterEach(async () => {
  await cerrar();
});

const DEV = () => ({ userId: developer, rol: "developer" as const });

describe("buscarLlamadaDelDeal", () => {
  it("cita vigente: el deal pasa a Agendado con su llamada; otro clic no la duplica", async () => {
    await envio({ "Agenda aquí tu entrevista": LINK });

    const r = await buscarLlamadaDelDeal(db, DEV(), dealId, { fetch: calendly("active") });
    expect(r).toMatchObject({ encontrada: true, accion: { tipo: "mover", a: "agendado" } });

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.etapa).toBe("agendado");
    const llamadas = await db.select().from(calls).where(eq(calls.dealId, dealId));
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].fechaAgenda?.toISOString()).toBe(INICIO);
    expect(llamadas[0].huellaFila).toBe(`calendly:${UUID}`);

    await buscarLlamadaDelDeal(db, DEV(), dealId, { fetch: calendly("active") });
    expect(await db.select().from(calls).where(eq(calls.dealId, dealId))).toHaveLength(1);
  });

  it("cita cancelada: lo dice y no escribe nada", async () => {
    await envio({ "Agenda aquí tu entrevista": LINK });
    const r = await buscarLlamadaDelDeal(db, DEV(), dealId, { fetch: calendly("canceled") });
    expect(r).toEqual({ encontrada: false, motivo: "La cita de Calendly está cancelada." });

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.etapa).toBe("registrado");
    expect(await db.select().from(calls)).toHaveLength(0);
    expect(await db.select().from(dealActividades)).toHaveLength(0);
  });

  it("sin link de Calendly en ningun envio: lo dice sin llamar a Calendly", async () => {
    await envio({ "¿Cuánto puedes invertir?": "Sí" });
    const fetch = calendly("active");
    const r = await buscarLlamadaDelDeal(db, DEV(), dealId, { fetch });
    expect(r).toMatchObject({ encontrada: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("un closer que no ve el programa recibe 404, igual que un deal inexistente", async () => {
    await envio({ "Agenda aquí tu entrevista": LINK });
    const fetch = calendly("active");
    await expect(
      buscarLlamadaDelDeal(db, { userId: closerAjeno, rol: "closer" }, dealId, { fetch }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      buscarLlamadaDelDeal(db, DEV(), "00000000-0000-4000-8000-000000000000", { fetch }),
    ).rejects.toBeInstanceOf(ErrorDeApp);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("linkDeAgendaDelEnvio", () => {
  it("toma la pregunta de agenda del mapeo, sin importar acentos ni mayusculas", () => {
    expect(linkDeAgendaDelEnvio({ "AGENDA AQUI TU ENTREVISTA": LINK }, "Agenda aquí tu entrevista")).toBe(LINK);
  });

  it("un link sin uuid de invitado no sirve: no hay a quien preguntarle", () => {
    expect(
      linkDeAgendaDelEnvio({ "Agenda aquí tu entrevista": "https://calendly.com/retia/entrevista" }, "Agenda aquí tu entrevista"),
    ).toBeNull();
  });

  it("sin pregunta de agenda configurada no busca en las demas respuestas", () => {
    expect(linkDeAgendaDelEnvio({ "Otra pregunta": LINK }, undefined)).toBeNull();
    expect(linkDeAgendaDelEnvio({ "Otra pregunta": LINK }, "Agenda aquí tu entrevista")).toBeNull();
  });
});
