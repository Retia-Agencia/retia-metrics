import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { calls, changeLog, deals, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { reconciliarCalendly } from "@/lib/calendly/reconciliar";
import { llamadasSueltasDelPrograma } from "@/lib/queries/inbox";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";
import real from "./fixtures/typeform-real-tactical.json";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({ get db() { return holder.db; } }));
vi.mock("@/lib/calendly/reconciliar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/calendly/reconciliar")>();
  return { ...actual, reconciliarCalendly: vi.fn(actual.reconciliarCalendly) };
});

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
const CLAVE_CALENDLY = "clave-calendly-comunicarte";
const CLAVE_OTRO = "clave-calendly-otro";
const CLAVE_FORMULARIO = "secreto-formulario-comunicarte";
const AGENDA = "Agenda aquí tu entrevista";

type Respuesta = { field: { id: string }; type: string; [k: string]: unknown };
type Formulario = {
  event_id: string;
  event_type: string;
  form_response: {
    token: string;
    submitted_at?: string;
    variables?: unknown[];
    answers: Respuesta[];
  };
};

function formulario(uuid: string | null, correo = "santiago.fr10@hotmail.com", token = crypto.randomUUID()): Formulario {
  const p = structuredClone(real) as unknown as Formulario;
  p.event_id = crypto.randomUUID();
  p.form_response.token = token;
  const email = p.form_response.answers.find((a) => a.field.id === "f-correo")!;
  email.email = correo;
  const agenda = p.form_response.answers.find((a) => a.field.id === "f-agenda")!;
  agenda.url = uuid ? `https://calendly.com/d/abc/entrevista/invitees/${uuid}` : "";
  return p;
}

const uri = (uuid: string) => `https://api.calendly.com/scheduled_events/EV/invitees/${uuid}`;
let secuencia = 0;
function cita(uuid: string, opciones: { correo?: string; nombre?: string; telefono?: string; vieja?: string } = {}) {
  return {
    event: "invitee.created",
    created_at: new Date(Date.UTC(2026, 9, 20, 5, 0, secuencia++)).toISOString(),
    payload: {
      uri: uri(uuid),
      email: opciones.correo ?? "reserva@correo.co",
      name: opciones.nombre ?? "Santiago Fr",
      text_reminder_number: opciones.telefono ?? null,
      old_invitee: opciones.vieja ? uri(opciones.vieja) : null,
      rescheduled: Boolean(opciones.vieja),
      scheduled_event: {
        start_time: "2026-11-05T15:00:00Z",
        event_memberships: [{ user_email: "host@calendly.co" }],
      },
    },
  };
}

function cancelada(uuid: string) {
  return {
    event: "invitee.canceled",
    created_at: new Date(Date.UTC(2026, 9, 20, 5, 1, secuencia++)).toISOString(),
    payload: { uri: uri(uuid), rescheduled: false },
  };
}

function firmaCalendly(cuerpo: string, clave = CLAVE_CALENDLY) {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", clave).update(`${t}.${cuerpo}`, "utf8").digest("hex")}`;
}

async function enviarCalendly(evento: unknown, programa = programId, clave = CLAVE_CALENDLY) {
  const cuerpo = JSON.stringify(evento);
  const { POST } = await import("@/app/api/webhooks/calendly/[programa]/route");
  return POST(new Request(`https://app.retia.co/api/webhooks/calendly/${programa}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Calendly-Webhook-Signature": firmaCalendly(cuerpo, clave) },
    body: cuerpo,
  }), { params: Promise.resolve({ programa }) });
}

async function enviarFormulario(payload: Formulario) {
  const cuerpo = JSON.stringify(payload);
  const firma = "sha256=" + createHmac("sha256", CLAVE_FORMULARIO).update(cuerpo, "utf8").digest("base64");
  const { POST } = await import("@/app/api/webhooks/formularios/[fuente]/route");
  return POST(new Request(`https://app.retia.co/api/webhooks/formularios/${sourceId}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Typeform-Signature": firma },
    body: cuerpo,
  }), { params: Promise.resolve({ fuente: sourceId }) });
}

function calendlyApi(uuid: string, estado: "active" | "canceled" = "active") {
  return vi.fn(async (url: string) => {
    const ok = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo });
    if (url.includes("/users/me")) return ok({ resource: { current_organization: "https://api.calendly.com/organizations/O" } });
    if (url.includes("/invitees")) return ok({ collection: [{ uri: uri(uuid), status: estado }] });
    if (url.includes("/scheduled_events")) return ok({ collection: [{ uri: "https://api.calendly.com/scheduled_events/EV", start_time: "2026-11-05T15:00:00Z", status: estado }] });
    throw new Error(`URL inesperada: ${url}`);
  });
}

async function dealDe(correo: string) {
  const [lead] = await db.select().from(leads).where(eq(leads.emailNormalizado, correo));
  const [deal] = await db.select().from(deals).where(eq(deals.leadId, lead.id));
  return deal;
}

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  vi.clearAllMocks();
  await vaciar();
  secuencia = 0;
  holder.db = db;
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797" }).returning();
  programId = programa.id;
  const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1500" }).returning();
  otroProgramId = otro.id;
  await sembrarIntegracion(db, programId, "calendly", { token: "token", claveFirma: CLAVE_CALENDLY });
  await sembrarIntegracion(db, otroProgramId, "calendly", { token: "token", claveFirma: CLAVE_OTRO });
  const [fuente] = await db.insert(sources).values({
    programId,
    nombre: "Typeform Comunicarte",
    tipo: "webhook",
    proveedor: "typeform",
    secretoWebhook: CLAVE_FORMULARIO,
    activo: true,
    mapeoColumnas: { agenda: AGENDA },
  }).returning();
  sourceId = fuente.id;
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("No debía consultar Calendly"); }));
});
afterEach(() => { holder.db = null; vi.unstubAllGlobals(); });
afterAll(async () => cerrar());

describe("matriz 363 por las rutas reales", () => {
  it("webhook antes del formulario: I1/I2 y caso real adoptan la suelta y suben Calificado a Agendado", async () => {
    const uuid = "SANTIAGO-REAL";
    expect((await enviarCalendly(cita(uuid, { correo: "reserva.distinta@correo.co" }))).status).toBe(200);
    expect((await db.select().from(calls))[0].dealId).toBeNull();
    expect((await enviarFormulario(formulario(uuid))).status).toBe(200);
    const deal = await dealDe("santiago.fr10@hotmail.com");
    expect(deal.etapa).toBe("agendado");
    expect((await db.select().from(calls))[0].dealId).toBe(deal.id);
  });

  it("formulario antes del webhook: I3 deja una llamada y un deal Agendado", async () => {
    const uuid = "FORM-PRIMERO";
    vi.stubGlobal("fetch", calendlyApi(uuid));
    await enviarFormulario(formulario(uuid));
    await enviarCalendly(cita(uuid));
    expect(await db.select().from(calls)).toHaveLength(1);
    expect((await dealDe("santiago.fr10@hotmail.com")).etapa).toBe("agendado");
  });

  it("correo distinto en Calendly: el UUID del link manda", async () => {
    const uuid = "CORREO-DISTINTO";
    await enviarCalendly(cita(uuid, { correo: "sr.newbusiness@gmail.com" }));
    await enviarFormulario(formulario(uuid, "varigroupdigital@gmail.com"));
    const deal = await dealDe("varigroupdigital@gmail.com");
    expect((await db.select().from(calls))[0]).toMatchObject({ dealId: deal.id, emailLead: "sr.newbusiness@gmail.com" });
  });

  it("mismo correo: el fallback confirmado también reconcilia", async () => {
    const uuid = "MISMO-CORREO";
    await enviarCalendly(cita(uuid, { correo: "mismo@correo.co" }));
    await enviarFormulario(formulario(uuid, "mismo@correo.co"));
    expect((await db.select().from(calls))[0].dealId).toBe((await dealDe("mismo@correo.co")).id);
  });

  it("parcial y luego completo: I3 conserva un deal y la completa cuelga la cita", async () => {
    const uuid = "PARCIAL-COMPLETO";
    const token = "token-parcial-completo";
    const parcial = formulario(null, "parcial@correo.co", token);
    parcial.event_type = "form_response_partial";
    delete parcial.form_response.submitted_at;
    await enviarFormulario(parcial);
    await enviarCalendly(cita(uuid, { correo: "otro@correo.co" }));
    await enviarFormulario(formulario(uuid, "parcial@correo.co", token));
    expect(await db.select().from(deals)).toHaveLength(1);
    expect((await db.select().from(deals))[0].etapa).toBe("agendado");
    expect((await db.select().from(calls))[0].dealId).toBe((await db.select().from(deals))[0].id);
  });

  it("reintento del webhook: I3 es idempotente y deja un solo rastro de asignación", async () => {
    const uuid = "REINTENTO";
    await enviarFormulario(formulario(uuid, "retry@correo.co"));
    const rastrosAntes = (await db.select().from(changeLog)).filter((c) => c.tabla === "calls" && c.campo === "dealId").length;
    const evento = cita(uuid, { correo: "retry@correo.co" });
    await enviarCalendly(evento);
    await enviarCalendly(evento);
    expect(await db.select().from(calls)).toHaveLength(1);
    expect((await db.select().from(changeLog)).filter((c) => c.tabla === "calls" && c.campo === "dealId")).toHaveLength(rastrosAntes + 1);
  });

  it("dos entregas simultáneas: I3 converge a una llamada colgada y Agendado", async () => {
    const uuid = "SIMULTANEAS";
    vi.stubGlobal("fetch", calendlyApi(uuid));
    const [calendly, forma] = await Promise.all([
      enviarCalendly(cita(uuid, { correo: "agenda@correo.co" })),
      enviarFormulario(formulario(uuid, "simultanea@correo.co")),
    ]);
    expect([calendly.status, forma.status]).toEqual([200, 200]);
    expect(await db.select().from(calls)).toHaveLength(1);
    const deal = await dealDe("simultanea@correo.co");
    expect((await db.select().from(calls))[0].dealId).toBe(deal.id);
    expect(deal.etapa).toBe("agendado");
  });

  it("reagenda con otro correo: el deal ya Agendado cuelga la nueva cita por UUID", async () => {
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "titular@correo.co" }).returning();
    const dealId = await abrirDeal(db, { leadId: lead.id, programId, etapa: "agendado", actor: { tipo: "sistema" } });
    await db.insert(calls).values({ programId, dealId, origen: "calendly", resultado: "agendada", huellaFila: "calendly:VIEJA", fechaAgenda: new Date("2026-11-01T15:00:00Z") });
    await db.insert(submissions).values({ sourceId, leadId: lead.id, token: "reagenda", respuestas: { [AGENDA]: "https://calendly.com/d/x/invitees/NUEVA" } });
    await enviarCalendly(cita("NUEVA", { correo: "reagenda.distinta@correo.co" }));
    const nueva = (await db.select().from(calls)).find((c) => c.huellaFila === "calendly:NUEVA");
    expect(nueva?.dealId).toBe(dealId);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("agendado");
  });

  it("cita cancelada antes del formulario: I2 negativo, no cuelga ni mueve a Agendado", async () => {
    const uuid = "CANCELADA-ANTES";
    await enviarCalendly(cita(uuid, { correo: "cancelada@agenda.co" }));
    await enviarCalendly(cancelada(uuid));
    vi.stubGlobal("fetch", calendlyApi(uuid, "canceled"));
    await enviarFormulario(formulario(uuid, "cancelada@form.co"));
    const deal = await dealDe("cancelada@form.co");
    expect(deal.etapa).not.toBe("agendado");
    expect((await db.select().from(calls))[0]).toMatchObject({ dealId: null, resultado: "cancelada" });
  });

  it("UUID en envíos de dos leads: I1 negativo, queda suelta y cuenta como duda", async () => {
    const uuid = "UUID-DUDOSO";
    for (const [i, correo] of ["uno@correo.co", "dos@correo.co"].entries()) {
      const [lead] = await db.insert(leads).values({ programId, emailNormalizado: correo }).returning();
      await abrirDeal(db, { leadId: lead.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
      await db.insert(submissions).values({ sourceId, leadId: lead.id, token: `duda-${i}`, respuestas: { [AGENDA]: `https://calendly.com/d/x/invitees/${uuid}` } });
    }
    await enviarCalendly(cita(uuid, { correo: "ninguno@correo.co" }));
    expect((await db.select().from(calls))[0].dealId).toBeNull();
    expect((await reconciliarCalendly(db, programId)).dudas).toBeGreaterThan(0);
  });

  it("cita de otro programa: nunca cruza la frontera", async () => {
    const uuid = "OTRO-PROGRAMA";
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "frontera@correo.co" }).returning();
    const dealId = await abrirDeal(db, { leadId: lead.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
    await db.insert(submissions).values({ sourceId, leadId: lead.id, token: "frontera", respuestas: { [AGENDA]: `https://calendly.com/d/x/invitees/${uuid}` } });
    await enviarCalendly(cita(uuid, { correo: "frontera@correo.co" }), otroProgramId, CLAVE_OTRO);
    expect((await db.select().from(calls))[0]).toMatchObject({ programId: otroProgramId, dealId: null });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("registrado");
  });

  it("sin UUID compartido: I4 queda suelta y nombre/teléfono nunca la asignan solos", async () => {
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "persona@correo.co", nombre: "Santiago Fr", telefono: "573001234567" }).returning();
    await abrirDeal(db, { leadId: lead.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
    await enviarCalendly(cita("SIN-LINK", { correo: "otro@correo.co", nombre: "Santiago Fr", telefono: "+57 300 123 4567" }));
    expect((await db.select().from(calls))[0].dealId).toBeNull();
  });

  it("I4 en los dos sentidos: una suelta joven no alarma y al superar 24 horas sí", async () => {
    await enviarCalendly(cita("SIN-ENVIO", { correo: "sin-envio@correo.co" }));
    const [llamada] = await db.select().from(calls);
    await db.update(calls).set({ createdAt: new Date() }).where(eq(calls.id, llamada.id));
    expect((await llamadasSueltasDelPrograma(db, programId))[0]).toMatchObject({ sueltaVieja: false });
    await db.update(calls).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).where(eq(calls.id, llamada.id));
    expect((await llamadasSueltasDelPrograma(db, programId))[0]).toMatchObject({ sueltaVieja: true, horasSuelta: 25 });
  });

  it("el webhook de Calendly llama el barrido aunque el evento sea ignorado", async () => {
    const { dealId, callId } = await prepararSueltaReconciliable("LLAMADOR-WEBHOOK");
    await enviarCalendly({ event: "routing_form_submission.created", created_at: new Date().toISOString(), payload: {} });
    expect((await db.select().from(calls).where(eq(calls.id, callId)))[0].dealId).toBe(dealId);
    expect(vi.mocked(reconciliarCalendly)).toHaveBeenCalledWith(db, programId, { reparar: false });
  });

  it("ingerirEntradas acota el barrido a los leads tocados", async () => {
    const ajeno = await prepararSueltaReconciliable("NO-TOCADO", "no-tocado@correo.co");
    const propio = await prepararSueltaReconciliable("TOCADO", "tocado@correo.co");
    await enviarFormulario(formulario("TOCADO", "tocado@correo.co", "toca-solo-uno"));
    expect((await db.select().from(calls).where(eq(calls.id, propio.callId)))[0].dealId).toBe(propio.dealId);
    expect((await db.select().from(calls).where(eq(calls.id, ajeno.callId)))[0].dealId).toBeNull();
    expect(vi.mocked(reconciliarCalendly)).toHaveBeenCalledWith(db, programId, { leadIds: [propio.leadId] });
  });
});

async function prepararSueltaReconciliable(uuid: string, correo = `${uuid.toLowerCase()}@correo.co`) {
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: correo }).returning();
  const dealId = await abrirDeal(db, { leadId: lead.id, programId, etapa: "calificado", actor: { tipo: "sistema" } });
  await db.insert(submissions).values({ sourceId, leadId: lead.id, token: `pre-${uuid}`, respuestas: { [AGENDA]: `https://calendly.com/d/x/invitees/${uuid}` } });
  const [call] = await db.insert(calls).values({ programId, origen: "calendly", resultado: "agendada", huellaFila: `calendly:${uuid}`, fechaAgenda: new Date("2026-11-05T15:00:00Z"), emailLead: "otro@correo.co" }).returning();
  return { leadId: lead.id, dealId, callId: call.id };
}
