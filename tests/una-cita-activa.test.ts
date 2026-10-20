import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { calls, deals, leads, miembrosPrograma, programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { codigoDeDeal } from "@/lib/calendly/link-de-agenda";
import { cancelarCitasReemplazadas } from "@/lib/calendly/una-cita-activa";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import type { ResultadoCita } from "@/lib/ingesta/regla-de-deals";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let dealId: string;
let hostViejaId: string;
let hostNuevaId: string;
const CLAVE = "clave-una-cita-activa";
const holder: { db: Db | null } = { db: null };

vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  holder.db = db;
  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "una-cita", nombre: "Una cita", ticketUsd: "1000" })
    .returning();
  programId = programa.id;
  await sembrarIntegracion(db, programId, "calendly", { token: "token", claveFirma: CLAVE });
  const [fuente] = await db.insert(sources).values({ programId, nombre: "Formulario", tipo: "google_sheet" }).returning();
  sourceId = fuente.id;

  const [hostVieja] = await db.insert(users).values({ email: "vieja@retia.co", rol: "closer" }).returning();
  const [hostNueva] = await db.insert(users).values({ email: "nueva@retia.co", rol: "closer" }).returning();
  hostViejaId = hostVieja.id;
  hostNuevaId = hostNueva.id;
  await db.insert(miembrosPrograma).values([
    { userId: hostViejaId, programId, calendlyEmail: "vieja@calendly.co" },
    { userId: hostNuevaId, programId, calendlyEmail: "nueva@calendly.co" },
  ]);
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "lead@correo.co" }).returning();
  const [deal] = await db
    .insert(deals)
    .values({ programId, leadId: lead.id, ownerUserId: hostViejaId, etapa: "agendado" })
    .returning();
  dealId = deal.id;
});

afterEach(() => {
  holder.db = null;
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await cerrar();
});

function fetchCalendly() {
  const evento = "https://api.calendly.com/scheduled_events/VIEJA";
  return vi.fn(async (url: string, init?: RequestInit) => {
    const ok = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo });
    if (init?.method === "POST" && url === `${evento}/cancellation`) return ok({ resource: {} });
    if (url.includes("/users/me")) {
      return ok({ resource: { current_organization: "https://api.calendly.com/organizations/ORG" } });
    }
    if (url.includes(`${evento}/invitees`)) {
      return ok({ collection: [{ uri: `${evento}/invitees/VIEJA`, status: "active" }] });
    }
    if (url.includes("/scheduled_events")) {
      return ok({ collection: [{ uri: evento, start_time: "2099-01-10T15:00:00Z", status: "active" }] });
    }
    throw new Error(`URL inesperada: ${url}`);
  });
}

async function enviarCalendly(evento: unknown): Promise<Response> {
  const cuerpo = JSON.stringify(evento);
  const t = Math.floor(Date.now() / 1000);
  const firma = createHmac("sha256", CLAVE).update(`${t}.${cuerpo}`, "utf8").digest("hex");
  const { POST } = await import("@/app/api/webhooks/calendly/[programa]/route");
  return POST(
    new Request(`http://localhost/api/webhooks/calendly/${programId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "calendly-webhook-signature": `t=${t},v1=${firma}` },
      body: cuerpo,
    }),
    { params: Promise.resolve({ programa: programId }) },
  );
}

function citaCreada() {
  return {
    event: "invitee.created",
    created_at: "2026-10-20T14:00:00.000Z",
    payload: {
      uri: "https://api.calendly.com/scheduled_events/NUEVA/invitees/NUEVA",
      email: "lead@correo.co",
      rescheduled: false,
      old_invitee: null,
      tracking: { utm_content: codigoDeDeal(dealId) },
      scheduled_event: {
        start_time: "2099-01-12T15:00:00.000Z",
        event_memberships: [{ user_email: "nueva@calendly.co" }],
      },
    },
  };
}

describe("una sola cita activa por deal", () => {
  it("reemplaza la futura, conserva la pasada, es idempotente y la cancelación vieja no mueve el deal", async () => {
    await db.insert(calls).values([
      {
        programId,
        dealId,
        emailLead: "lead@correo.co",
        closerUserId: hostViejaId,
        fechaAgenda: new Date("2099-01-10T15:00:00Z"),
        huellaFila: "calendly:VIEJA",
        origen: "calendly",
        resultado: "agendada",
      },
      {
        programId,
        dealId,
        emailLead: "lead@correo.co",
        closerUserId: hostViejaId,
        fechaAgenda: new Date("2020-01-10T15:00:00Z"),
        huellaFila: "calendly:PASADA",
        origen: "calendly",
        resultado: "agendada",
      },
    ]);
    const fetch = fetchCalendly();
    vi.stubGlobal("fetch", fetch);

    expect((await enviarCalendly(citaCreada())).status).toBe(200);
    const llamadas = await db.select().from(calls).where(eq(calls.dealId, dealId)).orderBy(asc(calls.fechaAgenda));
    expect(llamadas.map((llamada) => [llamada.huellaFila, llamada.resultado])).toEqual([
      ["calendly:PASADA", "agendada"],
      ["calendly:VIEJA", "reagendada"],
      ["calendly:NUEVA", "agendada"],
    ]);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0]).toMatchObject({
      ownerUserId: hostNuevaId,
      etapa: "agendado",
    });
    expect(fetch.mock.calls.filter(([url, init]) => String(url).endsWith("/cancellation") && init?.method === "POST")).toHaveLength(1);

    expect((await enviarCalendly(citaCreada())).status).toBe(200);
    expect(fetch.mock.calls.filter(([url, init]) => String(url).endsWith("/cancellation") && init?.method === "POST")).toHaveLength(1);

    expect((await enviarCalendly({
      event: "invitee.canceled",
      created_at: "2026-10-20T14:05:00.000Z",
      payload: { uri: "https://api.calendly.com/scheduled_events/VIEJA/invitees/VIEJA", rescheduled: false },
    })).status).toBe(200);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].etapa).toBe("agendado");
  });

  it("reemplaza la cita anterior cuando la nueva entra por la ingesta del formulario", async () => {
    const [vieja] = await db.insert(calls).values({
      programId,
      dealId,
      emailLead: "lead@correo.co",
      closerUserId: hostViejaId,
      fechaAgenda: new Date("2099-01-10T15:00:00Z"),
      huellaFila: "calendly:FORM-VIEJA",
      origen: "calendly",
      resultado: "agendada",
    }).returning();
    const entrada: EntradaEnvio = {
      sourceId,
      zona: "UTC",
      posicion: null,
      columnas: {
        Token: "envio-nuevo",
        Correo: "lead@correo.co",
        "Submitted At": "2026-10-20T15:00:00Z",
        Estado: "con_calendly",
      },
      campos: {
        token: "Token",
        correo: "Correo",
        fechaEnvio: "Submitted At",
        estadoHoja: "Estado",
      },
    };
    const cita: ResultadoCita = {
      estado: "vigente",
      uuidInvitado: "FORM-NUEVA",
      inicio: new Date("2099-01-12T15:00:00Z"),
      correoHost: "nueva@calendly.co",
    };

    const resultado = await ingerirEntradas(db, programId, [entrada], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: new Map([["lead@correo.co", cita]]),
    });
    expect(resultado.citasACancelar).toEqual([{ dealId, callId: vieja.id }]);
    await cancelarCitasReemplazadas(db, resultado.citasACancelar, { fetch: fetchCalendly() });

    const llamadas = await db.select().from(calls).where(eq(calls.dealId, dealId));
    expect(llamadas.find((llamada) => llamada.id === vieja.id)?.resultado).toBe("reagendada");
    expect(llamadas.find((llamada) => llamada.huellaFila === "calendly:FORM-NUEVA")?.resultado).toBe("agendada");
  });
});
