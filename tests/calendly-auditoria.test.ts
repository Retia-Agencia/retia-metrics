import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { auditarCalendly } from "@/lib/calendly/auditoria";
import { EVENTOS_CALENDLY } from "@/lib/calendly/evento-webhook";
import type { FetchLike } from "@/lib/calendly/cita";
import { huellaDeCita } from "@/lib/calendly/colgar-llamada";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const AHORA = new Date("2026-10-15T17:00:00.000Z");
const ORG = "https://api.calendly.com/organizations/ORG1";
const EVENTO = "https://api.calendly.com/scheduled_events/E1";
const uriInvitado = (uuid: string) => `${EVENTO}/invitees/${uuid}`;

interface InvitadoFalso {
  uri: string;
  name?: string;
  email?: string;
  created_at: string;
  status?: string;
  rescheduled?: boolean;
  new_invitee?: string;
}

interface OpcionesCalendly {
  suscripciones?: Record<string, unknown>[];
  eventos?: Record<string, unknown>[];
  invitados?: Record<string, InvitadoFalso[]>;
  recursos?: Record<string, InvitadoFalso>;
  rechazo?: number;
}

function calendlySimulado(programId: string, opciones: OpcionesCalendly = {}): FetchLike {
  const evento = { uri: EVENTO, start_time: "2026-10-20T15:00:00.000Z", status: "active" };
  const suscripcion = {
    callback_url: `https://crm.retia.co/api/webhooks/calendly/${programId}`,
    state: "active",
    events: [...EVENTOS_CALENDLY],
  };
  return async (url) => {
    const respuesta = (json: unknown, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
    });
    if (opciones.rechazo) return respuesta({}, opciones.rechazo);
    if (url.endsWith("/users/me")) {
      return respuesta({ resource: { current_organization: ORG } });
    }
    if (url.includes("/webhook_subscriptions?")) {
      return respuesta({
        collection: opciones.suscripciones ?? [suscripcion],
        pagination: { next_page: null },
      });
    }
    if (url.includes("/scheduled_events?")) {
      return respuesta({
        collection: opciones.eventos ?? [evento],
        pagination: { next_page: null },
      });
    }
    if (url.endsWith("/invitees?count=100")) {
      const eventoUri = url.slice(0, -"/invitees?count=100".length);
      return respuesta({
        collection: opciones.invitados?.[eventoUri] ?? [],
        pagination: { next_page: null },
      });
    }
    if (opciones.recursos?.[url]) return respuesta({ resource: opciones.recursos[url] });
    return respuesta({}, 404);
  };
}

const invitado = (uuid: string, extra: Partial<InvitadoFalso> = {}): InvitadoFalso => ({
  uri: uriInvitado(uuid),
  name: `Persona ${uuid}`,
  email: `${uuid}@retia.co`,
  created_at: "2026-10-15T05:00:00.000Z",
  status: "active",
  ...extra,
});

describe("auditarCalendly", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let actorId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [programa] = await db
      .insert(programs)
      .values({
        ...PROGRAMA_DE_PRUEBA,
        slug: "auditoria",
        nombre: "Auditoría",
        ticketUsd: "1500",
        calendlyToken: "token",
        activo: false,
      })
      .returning();
    programId = programa.id;
    const [actor] = await db
      .insert(users)
      .values({ email: "gerente-auditoria@retia.co", rol: "gerente" })
      .returning();
    actorId = actor.id;
  });

  afterAll(async () => cerrar());

  async function insertarLlamada(
    uuid: string,
    programa = programId,
    anulada = false,
  ): Promise<void> {
    const [lead] = await db
      .insert(leads)
      .values({ programId: programa, emailNormalizado: `${uuid}-${programa}@retia.co` })
      .returning();
    const [deal] = await db.insert(deals).values({ programId: programa, leadId: lead.id }).returning();
    await db.insert(calls).values({
      programId: programa,
      dealId: deal.id,
      huellaFila: huellaDeCita(uuid),
      origen: "calendly",
      ...(anulada
        ? { anuladoEn: AHORA, anuladoPor: actorId, motivoAnulacion: "Corrección humana" }
        : {}),
    });
  }

  it("lista y cuenta un invitado sin llamada", async () => {
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { invitados: { [EVENTO]: [invitado("SIN")] } }),
    });

    expect(resultado).toMatchObject({
      estado: "ok",
      suscripcion: { tipo: "activa" },
      citasRevisadas: 1,
      faltantes: [{ uuidInvitado: "SIN", motivo: "sin_llamada", cancelada: false }],
    });
  });

  it("no marca la mitad vieja de una reagenda cuando la nueva tiene llamada", async () => {
    await insertarLlamada("NUEVA");
    const vieja = invitado("VIEJA", { rescheduled: true, new_invitee: uriInvitado("NUEVA") });
    const nueva = invitado("NUEVA", { created_at: "2026-10-15T06:00:00.000Z" });
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { invitados: { [EVENTO]: [vieja, nueva] } }),
    });

    expect(resultado).toMatchObject({ estado: "ok", citasRevisadas: 2, faltantes: [] });
  });

  it("marca reagenda_sin_llamada cuando la nueva tampoco tiene llamada", async () => {
    const vieja = invitado("VIEJA", { rescheduled: true, new_invitee: uriInvitado("NUEVA") });
    const nueva = invitado("NUEVA", { created_at: "2026-10-15T16:55:00.000Z" });
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { invitados: { [EVENTO]: [vieja, nueva] } }),
    });

    expect(resultado).toMatchObject({
      estado: "ok",
      citasRevisadas: 1,
      faltantes: [{ uuidInvitado: "VIEJA", motivo: "reagenda_sin_llamada" }],
    });
  });

  it.each([
    [
      "deshabilitada",
      [
        {
          callback_url: "https://crm.retia.co/api/webhooks/calendly/PROGRAM",
          state: "disabled",
          events: [...EVENTOS_CALENDLY],
        },
      ],
      { tipo: "deshabilitada", estado: "disabled" },
    ],
    ["ausente", [], { tipo: "ausente" }],
    [
      "incompleta",
      [
        {
          callback_url: "https://crm.retia.co/api/webhooks/calendly/PROGRAM",
          state: "active",
          events: EVENTOS_CALENDLY.slice(0, -1),
        },
      ],
      { tipo: "eventos_incompletos", faltan: ["invitee_no_show.deleted"] },
    ],
  ])("reporta una suscripción %s", async (_nombre, suscripcionesBase, esperado) => {
    const suscripciones = suscripcionesBase.map((fila) => ({
      ...fila,
      callback_url: String(fila.callback_url).replace("PROGRAM", programId),
    }));
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { suscripciones, eventos: [] }),
    });
    expect(resultado).toMatchObject({ estado: "ok", suscripcion: esperado });
  });

  it("devuelve un error visible cuando Calendly rechaza el token", async () => {
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { rechazo: 401 }),
    });
    expect(resultado).toEqual({
      estado: "error",
      mensaje:
        "Calendly rechazó el token (401): puede estar vencido o el owner salió de la organización.",
    });
  });

  it("no cuenta un invitado creado hace cinco minutos", async () => {
    const reciente = invitado("RECIENTE", { created_at: "2026-10-15T16:55:00.000Z" });
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { invitados: { [EVENTO]: [reciente] } }),
    });
    expect(resultado).toMatchObject({ estado: "ok", citasRevisadas: 0, faltantes: [] });
  });

  it("considera presente una llamada anulada", async () => {
    await insertarLlamada("ANULADA", programId, true);
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { invitados: { [EVENTO]: [invitado("ANULADA")] } }),
    });
    expect(resultado).toMatchObject({ estado: "ok", citasRevisadas: 1, faltantes: [] });
  });

  it("devuelve sin_token sin consultar Calendly", async () => {
    const [sinToken] = await db
      .insert(programs)
      .values({
        ...PROGRAMA_DE_PRUEBA,
        slug: "sin-token",
        nombre: "Sin token",
        ticketUsd: "100",
        calendlyToken: null,
        activo: false,
      })
      .returning();
    let consulto = false;
    const fetch: FetchLike = async () => {
      consulto = true;
      throw new Error("No debía consultar");
    };
    expect(await auditarCalendly(db, sinToken.id, { fetch, ahora: AHORA })).toEqual({
      estado: "sin_token",
    });
    expect(consulto).toBe(false);
  });

  it("no cruza una llamada con la misma huella en otro programa", async () => {
    const [otro] = await db
      .insert(programs)
      .values({
        ...PROGRAMA_DE_PRUEBA,
        slug: "otro",
        nombre: "Otro",
        ticketUsd: "100",
        calendlyToken: "token-otro",
        activo: false,
      })
      .returning();
    await insertarLlamada("MISMA", otro.id);
    const resultado = await auditarCalendly(db, programId, {
      ahora: AHORA,
      fetch: calendlySimulado(programId, { invitados: { [EVENTO]: [invitado("MISMA")] } }),
    });
    expect(resultado).toMatchObject({
      estado: "ok",
      citasRevisadas: 1,
      faltantes: [{ uuidInvitado: "MISMA", motivo: "sin_llamada" }],
    });
  });
});
