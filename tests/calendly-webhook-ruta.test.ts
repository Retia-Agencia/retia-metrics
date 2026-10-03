import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, deals, entregasWebhook, leads, miembrosPrograma, programs, sobresCrudos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { aplicarReglaDeDeal } from "@/lib/ingesta/regla-de-deals";
import { entregasDePrograma, entregasHuerfanas } from "@/lib/queries/entregas-webhook";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * El webhook de Calendly (ticket 096, A5) invocando la RUTA real con eventos firmados,
 * contra PGlite con todas las migraciones. Lo que protege:
 *  - sin firma buena la base no se mueve; con firma buena el evento NUNCA se pierde
 *    (sobre crudo + 200, aunque no se entienda);
 *  - Calendly reintenta: repetir un evento no duplica ni mueve dos veces;
 *  - una reagenda mueve la MISMA llamada, en los dos ordenes posibles;
 *  - el programa sale de la URL: un evento firmado para otro programa no toca este.
 */

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let leadId: string;
let dealId: string;
let maru: string;
const CLAVE = "clave-de-firma-tactical";
const CLAVE_OTRO = "clave-de-firma-otro";

function firmar(cuerpo: string, clave = CLAVE): string {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", clave).update(`${t}.${cuerpo}`, "utf8").digest("hex")}`;
}

async function invocar(programa: string, cuerpo: string, firma: string | null): Promise<Response> {
  const { POST } = await import("@/app/api/webhooks/calendly/[programa]/route");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (firma !== null) headers["Calendly-Webhook-Signature"] = firma;
  const req = new Request(`https://app.retia.co/api/webhooks/calendly/${programa}`, { method: "POST", headers, body: cuerpo });
  return POST(req, { params: Promise.resolve({ programa }) });
}

const uri = (uuid: string) => `https://api.calendly.com/scheduled_events/EV/invitees/${uuid}`;

function creado(uuid: string, extra: { inicio?: string; viejo?: string; correo?: string; host?: string } = {}) {
  return {
    event: "invitee.created",
    payload: {
      uri: uri(uuid),
      email: extra.correo ?? "ana@correo.co",
      rescheduled: false,
      old_invitee: extra.viejo ? uri(extra.viejo) : null,
      scheduled_event: {
        start_time: extra.inicio ?? "2026-10-02T15:00:00.000000Z",
        event_memberships: [{ user_email: extra.host ?? "maru.tactical@calendly.co" }],
      },
    },
  };
}
const cancelado = (uuid: string, reagendada = false) => ({
  event: "invitee.canceled",
  payload: { uri: uri(uuid), rescheduled: reagendada },
});
const noShow = (uuid: string, retirado = false) => ({
  event: retirado ? "invitee_no_show.deleted" : "invitee_no_show.created",
  payload: { uri: uri(uuid) },
});

async function enviar(evento: unknown, programa = programId, clave = CLAVE): Promise<Response> {
  const cuerpo = JSON.stringify(evento);
  return invocar(programa, cuerpo, firmar(cuerpo, clave));
}

const llamadas = () => db.select().from(calls).where(eq(calls.programId, programId));
async function etapa() {
  const [d] = await db.select({ etapa: deals.etapa, pendiente: deals.pendiente, owner: deals.ownerUserId }).from(deals).where(eq(deals.id, dealId));
  return d;
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  holder.db = db;
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500", calendlySigningKey: CLAVE })
    .returning();
  programId = p.id;
  const [o] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "797", calendlySigningKey: CLAVE_OTRO })
    .returning();
  otroProgramId = o.id;
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" }).returning();
  leadId = l.id;
  dealId = await abrirDeal(db, { leadId, programId, etapa: "registrado", actor: { tipo: "sistema" } });
  const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  maru = m.id;
  await db.insert(miembrosPrograma).values({ userId: maru, programId, calendlyEmail: "maru.tactical@calendly.co" });
});

afterEach(async () => {
  holder.db = null;
  await cerrar();
});

describe("rechazos: la base no se mueve", () => {
  it("id mal formado o programa inexistente: 404 huerfana", async () => {
    const cuerpo = JSON.stringify(creado("A"));
    expect((await invocar("no-es-uuid", cuerpo, firmar(cuerpo))).status).toBe(404);
    expect((await invocar(crypto.randomUUID(), cuerpo, firmar(cuerpo))).status).toBe(404);
    expect(await llamadas()).toHaveLength(0);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
    expect((await entregasHuerfanas(null, db)).entregas.map((e) => e.motivo)).toEqual(["fuente_no_encontrada", "fuente_no_encontrada"]);
  });

  it("programa sin clave (no conectado): 401 sin_secreto", async () => {
    await db.update(programs).set({ calendlySigningKey: null }).where(eq(programs.id, programId));
    expect((await enviar(creado("A"))).status).toBe(401);
    const [e] = await db.select().from(entregasWebhook);
    expect(e.motivo).toBe("sin_secreto");
    expect(e.programId).toBe(programId);
  });

  it("sin firma, firma de otra clave: 401, sin sobre ni llamada", async () => {
    const cuerpo = JSON.stringify(creado("A"));
    expect((await invocar(programId, cuerpo, null)).status).toBe(401);
    expect((await invocar(programId, cuerpo, firmar(cuerpo, CLAVE_OTRO))).status).toBe(401);
    expect(await llamadas()).toHaveLength(0);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
    const motivos = (await db.select().from(entregasWebhook)).map((e) => e.motivo).sort();
    expect(motivos).toEqual(["firma_ausente", "firma_invalida"]);
  });

  it("frontera: un evento firmado para OTRO programa no toca las citas de este", async () => {
    await enviar(creado("A"));
    const res = await enviar(cancelado("A"), otroProgramId, CLAVE_OTRO);
    expect(res.status).toBe(200);
    const [c] = await llamadas();
    expect(c.resultado).toBe("agendada");
    expect((await etapa()).etapa).toBe("agendado");
  });
});

describe("una cita nueva", () => {
  it("se cuelga del deal, lo lleva a Agendado, la host se queda el deal, y el sobre queda", async () => {
    const res = await enviar(creado("A"));
    expect(res.status).toBe(200);
    const [c] = await llamadas();
    expect(c.dealId).toBe(dealId);
    expect(c.fechaAgenda?.toISOString()).toBe("2026-10-02T15:00:00.000Z");
    expect(c.closerUserId).toBe(maru);
    expect(await etapa()).toEqual({ etapa: "agendado", owner: maru, pendiente: null });

    const [s] = await db.select().from(sobresCrudos);
    expect(s).toMatchObject({ origen: "calendly", sourceId: null, programId, error: null });
    const [e] = (await entregasDePrograma(programId, null, db)).entregas;
    expect(e).toMatchObject({ motivo: "procesado", codigoHttp: 200, fuenteNombre: "Calendly", reprocesable: false });
    expect((await entregasHuerfanas(null, db)).entregas).toHaveLength(0);
  });

  it("repetida (Calendly reintenta): una sola llamada", async () => {
    await enviar(creado("A"));
    await enviar(creado("A"));
    expect(await llamadas()).toHaveLength(1);
  });

  it("antes que el envio: queda suelta y el 052 la ADOPTA en vez de chocar", async () => {
    await enviar(creado("B", { correo: "nuevo@correo.co" }));
    const [suelta] = await llamadas();
    expect(suelta.dealId).toBeNull();

    // Llega el envio "Con Calendly" del lead nuevo, con la misma cita.
    const [nuevo] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: "nuevo@correo.co", nombre: "Nuevo", calificacion: "con_calendly" })
      .returning();
    await aplicarReglaDeDeal(
      db,
      { id: nuevo.id, programId, emailNormalizado: "nuevo@correo.co", hechos: { esParcial: false, agendo: true, leadQuality: null } },
      { estado: "vigente", inicio: new Date("2026-10-02T15:00:00.000Z"), uuidInvitado: "B", correoHost: null },
    );
    const todas = await llamadas();
    expect(todas).toHaveLength(1);
    const [dealNuevo] = await db.select().from(deals).where(eq(deals.leadId, nuevo.id));
    expect(todas[0].dealId).toBe(dealNuevo.id);
    expect(dealNuevo.etapa).toBe("agendado");
  });
});

describe("cancelacion y no-show", () => {
  it("cancelada: la llamada pasa a cancelada y el deal a Re-agenda; repetirla no hace nada", async () => {
    await enviar(creado("A"));
    await enviar(cancelado("A"));
    await enviar(cancelado("A"));
    const [c] = await llamadas();
    expect(c.resultado).toBe("cancelada");
    expect(await etapa()).toMatchObject({ etapa: "agendado", pendiente: "reagenda" });
  });

  it("la cancelacion de una cita que el CRM no conoce: 200 y nada inventado", async () => {
    expect((await enviar(cancelado("DESCONOCIDA"))).status).toBe(200);
    expect(await llamadas()).toHaveLength(0);
    expect((await etapa()).etapa).toBe("registrado");
  });

  it("no-show y su retiro: ida y vuelta de la llamada y del deal", async () => {
    await enviar(creado("A"));
    await enviar(noShow("A"));
    expect((await llamadas())[0].resultado).toBe("no_show");
    expect(await etapa()).toMatchObject({ etapa: "agendado", pendiente: "reagenda" });
    await enviar(noShow("A", true));
    expect((await llamadas())[0].resultado).toBe("agendada");
    expect((await etapa()).etapa).toBe("agendado");
  });

  it("un no-show no pisa una llamada que ya ocurrio", async () => {
    await enviar(creado("A"));
    await db.update(calls).set({ resultado: "show" }).where(eq(calls.programId, programId));
    await enviar(noShow("A"));
    expect((await llamadas())[0].resultado).toBe("show");
  });
});

describe("reagenda: la MISMA llamada, en los dos ordenes", () => {
  async function verificar() {
    const todas = await llamadas();
    expect(todas).toHaveLength(1);
    expect(todas[0].huellaFila).toBe("calendly:NUEVA");
    expect(todas[0].fechaAgenda?.toISOString()).toBe("2026-10-05T16:00:00.000Z");
    expect(todas[0].resultado).toBe("agendada");
    expect((await etapa()).etapa).toBe("agendado");
  }

  it("primero la cancelacion (rescheduled) y despues la cita nueva", async () => {
    await enviar(creado("VIEJA"));
    await enviar(cancelado("VIEJA", true));
    expect((await etapa()).etapa).toBe("agendado");
    await enviar(creado("NUEVA", { viejo: "VIEJA", inicio: "2026-10-05T16:00:00Z" }));
    await verificar();
  });

  it("primero la cita nueva y despues la cancelacion; y repetir la nueva no duplica", async () => {
    await enviar(creado("VIEJA"));
    await enviar(creado("NUEVA", { viejo: "VIEJA", inicio: "2026-10-05T16:00:00Z" }));
    await enviar(cancelado("VIEJA", true));
    await enviar(creado("NUEVA", { viejo: "VIEJA", inicio: "2026-10-05T16:00:00Z" }));
    await verificar();
  });

  it("una reagenda con otra host cambia el closer de la misma llamada", async () => {
    const [andrea] = await db.insert(users).values({ email: "andrea@retiagrowth.com", rol: "closer" }).returning();
    await db.insert(miembrosPrograma).values({ userId: andrea.id, programId, calendlyEmail: "andrea@calendly.co" });
    await enviar(creado("VIEJA"));
    const [antes] = await llamadas();
    await enviar(creado("NUEVA", { viejo: "VIEJA", host: "andrea@calendly.co" }));
    const [despues] = await llamadas();
    expect(despues.id).toBe(antes.id);
    expect(despues.closerUserId).toBe(andrea.id);
  });

  it("si la vieja ya estaba cancelada (la cancelacion llego sin marca), la nueva la revive y el deal vuelve a Agendado", async () => {
    await enviar(creado("VIEJA"));
    await enviar(cancelado("VIEJA"));
    expect(await etapa()).toMatchObject({ etapa: "agendado", pendiente: "reagenda" });
    await enviar(creado("NUEVA", { viejo: "VIEJA", inicio: "2026-10-05T16:00:00Z" }));
    await verificar();
  });
});

describe("caja negra", () => {
  it("un cuerpo que no se entiende: 200, sobre con error, entrega contenido_invalido", async () => {
    const cuerpo = "{ roto";
    expect((await invocar(programId, cuerpo, firmar(cuerpo))).status).toBe(200);
    const [s] = await db.select().from(sobresCrudos).where(and(eq(sobresCrudos.programId, programId)));
    expect(s.error).toMatch(/JSON/);
    const [e] = await db.select().from(entregasWebhook);
    expect(e.motivo).toBe("contenido_invalido");
  });

  it("un evento que no se escucha: 200 procesado, nada escrito", async () => {
    expect((await enviar({ event: "routing_form_submission.created", payload: {} })).status).toBe(200);
    expect(await llamadas()).toHaveLength(0);
  });
});
