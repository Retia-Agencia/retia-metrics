import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, changeLog, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { linkEnviadoSinCita, marcarLinkEnviado } from "@/lib/deals/handoff";
import { codigoDeDeal } from "@/lib/calendly/link-de-agenda";
import { inboxDelPrograma } from "@/lib/queries/inbox";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let dealId: string;
let ownerId: string;
let otroId: string;
let programId: string;
let hostId: string;
const CLAVE = "clave-handoff-local";
const holder: { db: Db | null } = { db: null };

vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  holder.db = db;
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "handoff", nombre: "Handoff", ticketUsd: "1000", calendlySigningKey: CLAVE }).returning();
  programId = programa.id;
  const [owner] = await db.insert(users).values({ email: "setter@retia.co", rol: "closer" }).returning();
  const [otro] = await db.insert(users).values({ email: "otro@retia.co", rol: "closer" }).returning();
  ownerId = owner.id;
  otroId = otro.id;
  const [host] = await db.insert(users).values({ email: "host@retia.co", rol: "closer" }).returning();
  hostId = host.id;
  await db.insert(miembrosPrograma).values({ userId: hostId, programId, calendlyEmail: "host@calendly.co" });
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "lead@correo.co" }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId: ownerId, etapa: "calificado" }).returning();
  dealId = deal.id;
});

afterEach(async () => {
  holder.db = null;
  await cerrar();
});

async function enviarCita(host: string, uuid: string): Promise<Response> {
  const cuerpo = JSON.stringify({
    event: "invitee.created",
    created_at: "2026-10-04T14:00:00.000000Z",
    payload: {
      uri: `https://api.calendly.com/scheduled_events/H/invitees/${uuid}`,
      email: "lead@correo.co",
      tracking: { utm_content: codigoDeDeal(dealId) },
      scheduled_event: {
        start_time: "2026-10-04T15:00:00.000Z",
        event_memberships: [{ user_email: host }],
      },
    },
  });
  const t = Math.floor(Date.now() / 1000);
  const firma = createHmac("sha256", CLAVE).update(`${t}.${cuerpo}`, "utf8").digest("hex");
  const { POST } = await import("@/app/api/webhooks/calendly/[programa]/route");
  return POST(
    new Request(`http://localhost/api/webhooks/calendly/${programId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "calendly-webhook-signature": `t=${t},v1=${firma}`,
      },
      body: cuerpo,
    }),
    { params: Promise.resolve({ programa: programId }) },
  );
}

describe("marcarLinkEnviado", () => {
  it("escribe handoff_en y su change_log con el actor", async () => {
    await marcarLinkEnviado(db, { userId: ownerId, rol: "closer" }, dealId);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.handoffEn).toBeInstanceOf(Date);
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.registroId, dealId), eq(changeLog.campo, "handoffEn")));
    expect(rastro).toHaveLength(1);
    expect(rastro[0].userId).toBe(ownerId);
  });

  it("rechaza a un closer que no es dueño y deja el deal quieto", async () => {
    await expect(marcarLinkEnviado(db, { userId: otroId, rol: "closer" }, dealId)).rejects.toMatchObject({ status: 403 });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].handoffEn).toBeNull();
  });

  it("rechaza cuando ya hay una llamada vigente agendada", async () => {
    await db.insert(calls).values({ programId, dealId, origen: "crm", resultado: "agendada" });
    await expect(marcarLinkEnviado(db, { userId: ownerId, rol: "closer" }, dealId)).rejects.toMatchObject({ status: 409 });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].handoffEn).toBeNull();
  });
});

describe("linkEnviadoSinCita", () => {
  const viernes = new Date("2026-10-02T15:00:00.000Z");

  it.each(["2026-10-02", "2026-10-03", "2026-10-04"])("viernes todavía no alerta el %s", (hoy) => {
    expect(linkEnviadoSinCita({ handoffEn: viernes, tieneCitaVigente: false, hoy })).toBe(false);
  });

  it("alerta el lunes y se limpia cuando existe una cita vigente", () => {
    expect(linkEnviadoSinCita({ handoffEn: viernes, tieneCitaVigente: false, hoy: "2026-10-05" })).toBe(true);
    expect(linkEnviadoSinCita({ handoffEn: viernes, tieneCitaVigente: true, hoy: "2026-10-05" })).toBe(false);
  });
});

describe("handoff por la ruta real de Calendly", () => {
  it("con host vinculada pasa el deal, conserva el setter y asigna la llamada", async () => {
    await marcarLinkEnviado(db, { userId: ownerId, rol: "closer" }, dealId);
    expect((await enviarCita("host@calendly.co", "HANDOFF-1")).status).toBe(200);

    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal).toMatchObject({ ownerUserId: hostId, setterUserId: ownerId, etapa: "agendado" });
    const [llamada] = await db.select().from(calls).where(eq(calls.dealId, dealId));
    expect(llamada.closerUserId).toBe(hostId);
  });

  it("sin cuenta guarda la llamada sin closer y la muestra en el Inbox del programa", async () => {
    await marcarLinkEnviado(db, { userId: ownerId, rol: "closer" }, dealId);
    expect((await enviarCita("externa@calendly.co", "HANDOFF-2")).status).toBe(200);

    const [llamada] = await db.select().from(calls).where(eq(calls.dealId, dealId));
    expect(llamada.closerUserId).toBeNull();
    const inbox = await inboxDelPrograma(db, programId, "equipo");
    expect(inbox.llamadasSinCloser).toEqual([
      expect.objectContaining({
        callId: llamada.id,
        dealId,
        hostEmail: "externa@calendly.co",
        leadEmail: "lead@correo.co",
      }),
    ]);
  });
});
