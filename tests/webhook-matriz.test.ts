import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  calls,
  dealActividades,
  deals,
  leadContactos,
  leads,
  programs,
  sobresCrudos,
  sources,
  submissions,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import real from "./fixtures/typeform-real-tactical.json";
import daptaParcial from "./fixtures/dapta-parcial.json";
import daptaCompleto from "./fixtures/dapta-completo.json";

/**
 * Matriz de casos del webhook (tarea C del ticket 106, pedido explicito de Mani:
 * "testear todos los casos posibles para encontrar fallas rapido, asi en produccion no
 * se pierden leads"). Invoca la RUTA real con payloads FIRMADOS como Typeform
 * (`Typeform-Signature: sha256=<base64>`) contra PGlite con TODAS las migraciones. Lo
 * unico mockeado es Calendly (`globalThis.fetch`).
 *
 * El fixture usa los TITULOS REALES de las preguntas del Typeform de Tactical, con sus
 * tildes y signos, tal como quedan de llave en `submissions.respuestas`.
 *
 * El invariante que todo esto protege: **con firma valida, el lead SIEMPRE se guarda**
 * —como lead, o como sobre crudo— y la ruta responde 200, nunca 500.
 */

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

// La regla de deals corre de verdad (es lo que abre el deal y crea la llamada); solo se
// evita que un fallo de import la tumbe.
vi.mock("@/lib/ingesta/regla-de-deals", async (importOriginal) => {
  try {
    return await importOriginal<Record<string, unknown>>();
  } catch {
    return {};
  }
});

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;
const SECRETO = "secreto-de-prueba-hmac-32-bytes-aqui";
const AGENDA = "Agenda aquí tu entrevista";

function firmar(cuerpo: string, secreto = SECRETO): string {
  return "sha256=" + createHmac("sha256", secreto).update(cuerpo, "utf8").digest("base64");
}

function firmarDapta(cuerpo: string, secreto = SECRETO): string {
  return "sha256=" + createHmac("sha256", secreto).update(cuerpo, "utf8").digest("hex");
}

function peticion(cuerpo: string, firma: string | null, headerFirma = "Typeform-Signature"): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (firma !== null) headers[headerFirma] = firma;
  return new Request("https://app.retia.co/api/webhooks/formularios/x", {
    method: "POST",
    headers,
    body: cuerpo,
  });
}

async function invocar(
  fuente: string,
  cuerpo: string,
  firma: string | null,
  headerFirma?: string,
): Promise<Response> {
  const { POST } = await import("@/app/api/webhooks/formularios/[fuente]/route");
  return POST(peticion(cuerpo, firma, headerFirma), { params: Promise.resolve({ fuente }) });
}

/** Envia el fixture (o una variante) firmado a la fuente activa por defecto. */
async function enviar(payload: unknown, fuente = sourceId): Promise<Response> {
  const cuerpo = JSON.stringify(payload);
  return invocar(fuente, cuerpo, firmar(cuerpo));
}

async function enviarDapta(payload: unknown, fuente: string): Promise<Response> {
  const cuerpo = JSON.stringify(payload);
  return invocar(fuente, cuerpo, firmarDapta(cuerpo), "x-forms-signature");
}

type Answer = { field: { id: string; type?: string }; type: string; [k: string]: unknown };
type Fixture = {
  event_type: string;
  form_response: {
    token: string;
    submitted_at?: string;
    variables?: { key: string; type: string; text?: string; number?: number }[];
    hidden?: Record<string, string>;
    definition?: { fields: { id: string; title: string; type?: string }[] };
    answers: Answer[];
  };
};

/** Una copia profunda del fixture real, tipada para modificarlo con comodidad. */
function fixture(): Fixture {
  return structuredClone(real) as unknown as Fixture;
}

/** Cambia la variable `estado` del payload. */
function conEstado(p: Fixture, estado: string): Fixture {
  p.form_response.variables = [{ key: "estado", type: "text", text: estado }];
  return p;
}

/** Reemplaza el link de la pregunta de agenda (o lo vacia con ""). */
function conAgenda(p: Fixture, url: string): Fixture {
  const a = p.form_response.answers.find((x) => x.field.id === "f-agenda")!;
  a.url = url;
  return p;
}

/** Un stub de Calendly: cita vigente, cancelada o inexistente por uuid. */
function stubCalendly(opciones: {
  uuid?: string;
  estado?: "active" | "canceled";
  inicio?: string;
  lanza?: boolean;
  eventoVacio?: boolean;
}) {
  const ORG = "https://api.calendly.com/organizations/ORG1";
  const EVENT = "https://api.calendly.com/scheduled_events/EV9";
  const uuid = opciones.uuid ?? "inv-uuid-001";
  const inicio = opciones.inicio ?? "2026-10-05T16:00:00Z";
  return vi.fn(async (url: string) => {
    if (opciones.lanza) throw new Error("Calendly caido (red)");
    const ok = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo });
    if (url.includes("/users/me")) return ok({ resource: { current_organization: ORG } });
    if (url.includes(`${EVENT}/invitees`)) {
      return ok({ collection: [{ uri: `${EVENT}/invitees/${uuid}`, status: opciones.estado ?? "active" }] });
    }
    if (url.includes("/scheduled_events")) {
      if (opciones.eventoVacio) return ok({ collection: [] });
      return ok({ collection: [{ uri: EVENT, start_time: inicio, status: opciones.estado ?? "active" }] });
    }
    throw new Error(`URL inesperada: ${url}`);
  });
}

/** El fetch por defecto: lanza si algo lo llama (ningun caso sin agenda toca Calendly). */
function fetchQueLanza() {
  return vi.fn(async () => {
    throw new Error("fetch no debería llamarse en este caso");
  });
}

beforeEach(async () => {
  vi.stubGlobal("fetch", fetchQueLanza());
  ({ db, cerrar } = await crearBaseDePrueba());
  holder.db = db;
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" })
    .returning();
  programId = p.id;
  const [f] = await db
    .insert(sources)
    .values({
      programId,
      nombre: "Typeform Tactical",
      tipo: "webhook",
      proveedor: "typeform",
      secretoWebhook: SECRETO,
      activo: true,
      mapeoColumnas: { agenda: AGENDA },
    })
    .returning();
  sourceId = f.id;
});

afterEach(async () => {
  holder.db = null;
  vi.unstubAllGlobals();
  await cerrar();
});

// ─────────────────────────────────────────── caso 1: completo con agenda vigente

describe("caso 1 — completo con agenda vigente", () => {
  it("lead con nombre, contactos, con_calendly, deal Agendado, llamada con fecha", async () => {
    vi.stubGlobal("fetch", stubCalendly({ uuid: "inv-uuid-001" }));
    const res = await enviar(fixture());
    expect(res.status).toBe(200);

    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBe("María José Gómez");
    expect(lead.emailNormalizado).toBe("mariajose.gomez@correo.co");
    expect(lead.telefono).toBe("573001234567");
    expect(lead.calificacion).toBe("con_calendly");

    const contactos = await db.select().from(leadContactos);
    expect(contactos.map((c) => c.tipo).sort()).toEqual(["correo", "telefono"]);

    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado");
    const [call] = await db.select().from(calls).where(eq(calls.dealId, deal.id));
    expect(call.resultado).toBe("agendada");
    expect(call.fechaAgenda?.toISOString()).toBe("2026-10-05T16:00:00.000Z");
    expect(call.huellaFila).toBe("calendly:inv-uuid-001");
  });
});

// ─────────────────────────────────── caso 2: completo sin agenda, setteo_no_calificado

describe("caso 2 — completo sin link de agenda, setteo_no_calificado", () => {
  it("deal en Pendiente Setteo, sin llamada", async () => {
    const res = await enviar(conAgenda(fixture(), ""));
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("setteo_no_calificado");
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("pendiente_setteo");
    expect(await db.select().from(calls)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────── caso 3: descartado

describe("caso 3 — descartado", () => {
  it("el lead se guarda, pero no se abre ningun deal", async () => {
    const res = await enviar(conEstado(fixture(), "descartado"));
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("descartado");
    expect(await db.select().from(deals)).toHaveLength(0);
  });
});

// ────────────────────────── caso 4: agenda con link pero variable descartado

describe("caso 4 — link de agenda pero variable descartado", () => {
  it("descartado NUNCA sube a con_calendly, aunque traiga el link", async () => {
    // fetch que lanza: si la ruta intentara resolver la cita, el test lo delata.
    const res = await enviar(conEstado(fixture(), "descartado"));
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("descartado");
    expect(await db.select().from(deals)).toHaveLength(0);
    expect(await db.select().from(calls)).toHaveLength(0);
  });
});

// ───────────────── caso 5: la cita no queda vigente / Calendly falla / sin token

describe("caso 5 — la cita no está vigente o Calendly falla: Pendiente Setteo, lead SIEMPRE guardado", () => {
  it("cita cancelada: Pendiente Setteo con nota del sistema, sin llamada", async () => {
    vi.stubGlobal("fetch", stubCalendly({ estado: "canceled" }));
    const res = await enviar(fixture());
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("con_calendly");
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("pendiente_setteo");
    expect(await db.select().from(calls)).toHaveLength(0);
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.tipo, "nota"));
    expect(notas).toHaveLength(1);
    expect(notas[0].userId).toBeNull(); // el sistema
    expect(notas[0].nota).toContain("cancelada");
  });

  it("cita no encontrada (evento sin ese uuid): Pendiente Setteo con nota", async () => {
    vi.stubGlobal("fetch", stubCalendly({ eventoVacio: true }));
    const res = await enviar(fixture());
    expect(res.status).toBe(200);
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("pendiente_setteo");
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.tipo, "nota"));
    expect(notas[0].nota).toContain("No se encontró");
  });

  it("Calendly lanza (5xx / red): Pendiente Setteo con nota, lead guardado, 200", async () => {
    vi.stubGlobal("fetch", stubCalendly({ lanza: true }));
    const res = await enviar(fixture());
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead).toBeDefined();
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("pendiente_setteo");
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.tipo, "nota"));
    expect((notas[0].nota ?? "").toLowerCase()).toContain("calendly");
  });

  it("programa sin token de Calendly: Pendiente Setteo con nota, lead guardado", async () => {
    // Un programa activo exige token (CHECK `programs_activo_con_formulario_y_token`).
    // Para simular la configuracion incompleta sin pelear con el CHECK, se usa un
    // programa NUEVO inactivo y sin token, con su propia fuente webhook.
    const [sinToken] = await db
      .insert(programs)
      .values({ slug: "sin-token", nombre: "Sin token", ticketUsd: "1500", activo: false })
      .returning();
    const [fuenteSinToken] = await db
      .insert(sources)
      .values({
        programId: sinToken.id,
        nombre: "Typeform sin token",
        tipo: "webhook",
        proveedor: "typeform",
        secretoWebhook: SECRETO,
        activo: true,
        mapeoColumnas: { agenda: AGENDA },
      })
      .returning();

    const res = await enviar(fixture(), fuenteSinToken.id);
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads).where(eq(leads.programId, sinToken.id));
    expect(lead.calificacion).toBe("con_calendly");
    const [deal] = await db.select().from(deals).where(eq(deals.programId, sinToken.id));
    expect(deal.etapa).toBe("pendiente_setteo");
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.tipo, "nota"));
    expect((notas[0].nota ?? "").toLowerCase()).toContain("token");
  });
});

// ─────────────────────────────────── caso 6: idempotencia y fuera de orden

describe("caso 6 — reintentos y llegada fuera de orden", () => {
  it("el mismo envío dos veces deja UNA fila", async () => {
    await enviar(conAgenda(fixture(), ""));
    const res = await enviar(conAgenda(fixture(), ""));
    expect(res.status).toBe(200);
    expect(await db.select().from(submissions)).toHaveLength(1);
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("un envío viejo que llega DESPUÉS de uno más nuevo no le gana al resumen (por fecha)", async () => {
    // Dos tokens de la misma persona: primero se ingiere el NUEVO (fecha 25-sep), luego
    // el VIEJO (fecha 20-sep). El resumen del lead conserva la fecha más reciente.
    const nuevo = conAgenda(fixture(), "");
    nuevo.form_response.token = "tok-nuevo";
    nuevo.form_response.submitted_at = "2026-09-25T14:00:00Z";
    await enviar(nuevo);

    const viejo = conAgenda(fixture(), "");
    viejo.form_response.token = "tok-viejo";
    viejo.form_response.submitted_at = "2026-09-20T14:00:00Z";
    await enviar(viejo);

    const [lead] = await db.select().from(leads);
    expect(lead.fechaUltimaAplicacion?.toISOString()).toBe("2026-09-25T14:00:00.000Z");
    expect(lead.fechaPrimeraAplicacion?.toISOString()).toBe("2026-09-20T14:00:00.000Z");
    expect(lead.numAplicaciones).toBe(2);
  });
});

// ─────────────────────────────────── caso 7: la misma persona re-aplica

describe("caso 7 — la misma persona re-aplica (fija el comportamiento actual)", () => {
  it("(a) agendó y luego descartado: el deal sigue en Agendado; la calificación del lead pasa a descartado", async () => {
    vi.stubGlobal("fetch", stubCalendly({}));
    const agenda = fixture();
    agenda.form_response.token = "t-agenda";
    await enviar(agenda);
    let [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado");

    // Ahora descartado: la regla no toca un deal, y descartado no abre ni mueve.
    vi.stubGlobal("fetch", fetchQueLanza());
    const desc = conEstado(fixture(), "descartado");
    desc.form_response.token = "t-desc";
    await enviar(desc);
    [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado"); // el deal no retrocede
  });

  it("(b) descartado y luego agenda: se abre el deal en Agendado al llegar la agenda", async () => {
    const desc = conEstado(fixture(), "descartado");
    desc.form_response.token = "t-desc";
    await enviar(desc);
    expect(await db.select().from(deals)).toHaveLength(0);

    vi.stubGlobal("fetch", stubCalendly({}));
    const agenda = fixture();
    agenda.form_response.token = "t-agenda";
    await enviar(agenda);
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado");
  });

  it("(c) agenda dos veces con dos citas distintas: la SEGUNDA cita crea su llamada en el mismo deal", async () => {
    // Decidido por Mani (28-sep): una re-agenda con fecha nueva no se pierde. El deal ya
    // está en Agendado y no se mueve; la cita nueva queda como otra llamada del mismo
    // deal. Cancelar la vieja cuando Calendly avise es del ticket 096.
    vi.stubGlobal("fetch", stubCalendly({ uuid: "uuid-1", inicio: "2026-10-05T16:00:00Z" }));
    const a1 = conAgenda(fixture(), "https://calendly.com/d/x/y/invitees/uuid-1");
    a1.form_response.token = "t-1";
    await enviar(a1);

    vi.stubGlobal("fetch", stubCalendly({ uuid: "uuid-2", inicio: "2026-10-07T16:00:00Z" }));
    const a2 = conAgenda(fixture(), "https://calendly.com/d/x/y/invitees/uuid-2");
    a2.form_response.token = "t-2";
    await enviar(a2);

    const filasDeal = await db.select().from(deals);
    expect(filasDeal).toHaveLength(1);
    expect(filasDeal[0].etapa).toBe("agendado");
    const filasCall = await db.select().from(calls);
    expect(filasCall.map((c) => c.huellaFila).sort()).toEqual(["calendly:uuid-1", "calendly:uuid-2"]);
    expect(filasCall.every((c) => c.dealId === filasDeal[0].id)).toBe(true);
    const segunda = filasCall.find((c) => c.huellaFila === "calendly:uuid-2")!;
    expect(segunda.fechaAgenda?.toISOString()).toBe("2026-10-07T16:00:00.000Z");
  });

  it("(d) setteo y luego agenda: el deal sube de Pendiente Setteo a Agendado", async () => {
    const setteo = conAgenda(fixture(), "");
    setteo.form_response.token = "t-setteo";
    await enviar(setteo);
    let [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("pendiente_setteo");

    vi.stubGlobal("fetch", stubCalendly({}));
    const agenda = fixture();
    agenda.form_response.token = "t-agenda";
    await enviar(agenda);
    [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado");
  });

  it("DECIDIDO (Mani, 28-sep): la calificación del lead pasa a descartado y su deal sigue en Agendado (7a): decide el closer en la llamada", async () => {
    // No es un bug: el Estado del lead es el del envío más reciente (ADR 0054), y el deal
    // no retrocede por un re-envío (regla de deals). Pero un lead "descartado" con un deal
    // "agendado" es una combinación que el producto tiene que mirar. Se fija el estado
    // actual; NO se decide aquí.
    vi.stubGlobal("fetch", stubCalendly({}));
    const agenda = fixture();
    agenda.form_response.token = "t-agenda";
    agenda.form_response.submitted_at = "2026-09-20T14:00:00Z";
    await enviar(agenda);

    vi.stubGlobal("fetch", fetchQueLanza());
    const desc = conEstado(fixture(), "descartado");
    desc.form_response.token = "t-desc";
    desc.form_response.submitted_at = "2026-09-25T14:00:00Z";
    await enviar(desc);

    const [lead] = await db.select().from(leads);
    const [deal] = await db.select().from(deals);
    expect(lead.calificacion).toBe("descartado");
    expect(deal.etapa).toBe("agendado");
  });
});

// ─────────────────────────────────── caso 8: identidad y frontera de programa

describe("caso 8 — mismo correo, mayúsculas/espacios y frontera de programa", () => {
  it("mismo correo con mayúsculas y espacios es el MISMO lead", async () => {
    const a = conAgenda(fixture(), "");
    a.form_response.token = "t-1";
    await enviar(a);

    const b = conAgenda(fixture(), "");
    b.form_response.token = "t-2";
    const correoB = b.form_response.answers.find((x) => x.field.id === "f-correo")!;
    correoB.email = "  MARIAJOSE.gomez@CORREO.CO ";
    await enviar(b);

    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("el mismo correo en OTRO programa es OTRO lead (frontera)", async () => {
    await enviar(conAgenda(fixture(), ""));

    const [otro] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "C", ticketUsd: "797" })
      .returning();
    const [fuenteOtro] = await db
      .insert(sources)
      .values({
        programId: otro.id,
        nombre: "Typeform C",
        tipo: "webhook",
        proveedor: "typeform",
        secretoWebhook: SECRETO,
        activo: true,
        mapeoColumnas: { agenda: AGENDA },
      })
      .returning();

    const otroEnvio = conAgenda(fixture(), "");
    otroEnvio.form_response.token = "t-otro-programa";
    await enviar(otroEnvio, fuenteOtro.id);

    expect(await db.select().from(leads)).toHaveLength(2);
  });
});

describe("Dapta", () => {
  async function fuenteDapta(programa = programId): Promise<string> {
    const [fuente] = await db
      .insert(sources)
      .values({
        programId: programa,
        nombre: "Dapta Forms",
        tipo: "webhook",
        proveedor: "dapta",
        secretoWebhook: SECRETO,
        activo: true,
      })
      .returning();
    return fuente.id;
  }

  it("acepta la firma hexadecimal correcta y rechaza la incorrecta", async () => {
    const fuente = await fuenteDapta();
    const cuerpo = JSON.stringify(daptaCompleto);
    const mala = await invocar(fuente, cuerpo, "sha256=00", "x-forms-signature");
    const buena = await enviarDapta(daptaCompleto, fuente);
    expect(mala.status).toBe(401);
    expect(buena.status).toBe(200);
  });

  it("guarda el parcial y el completo del mismo token como dos envios y un lead", async () => {
    const fuente = await fuenteDapta();
    await enviarDapta(daptaParcial, fuente);
    await enviarDapta(daptaCompleto, fuente);
    expect(await db.select().from(submissions)).toHaveLength(2);
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("deduplica la misma persona de Typeform y Dapta dentro del programa", async () => {
    const fuente = await fuenteDapta();
    await enviar(conAgenda(fixture(), ""));
    await enviarDapta(daptaCompleto, fuente);
    expect(await db.select().from(submissions)).toHaveLength(2);
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("mantiene la frontera cuando el mismo correo llega a otro programa", async () => {
    const fuente = await fuenteDapta();
    await enviarDapta(daptaCompleto, fuente);
    const [otro] = await db
      .insert(programs)
      .values({
        ...PROGRAMA_DE_PRUEBA,
        slug: "dapta-otro",
        nombre: "Dapta Otro",
        ticketUsd: "1500",
      })
      .returning();
    const fuenteOtro = await fuenteDapta(otro.id);
    await enviarDapta(daptaCompleto, fuenteOtro);
    expect(await db.select().from(leads)).toHaveLength(2);
  });

  it("la entrega de prueba del editor de Dapta responde 200, deja el sobre y no crea lead", async () => {
    const fuente = await fuenteDapta();
    // La forma que arma Dapta al "enviar prueba": parcial, sin outcome y con respuestas de muestra.
    const prueba = {
      ...structuredClone(daptaParcial),
      submission: { id: "test-submission", sessionId: "test-session", score: 0, outcome: null },
      data: { nombre: "Sample", email: "sample@example.com", test: true },
      utm: {},
    };
    const res = await enviarDapta(prueba, fuente);
    expect(res.status).toBe(200);
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].error).toContain("prueba");
    expect(await db.select().from(submissions)).toHaveLength(0);
    expect(await db.select().from(leads)).toHaveLength(0);
  });
});

// ─────────────────────────────────── caso 9: correo/telefono ausentes o centinela

describe("caso 9 — sin correo, solo teléfono, teléfono inválido", () => {
  it("sin correo: sobre crudo + 200 y sin lead", async () => {
    const p = fixture();
    p.form_response.answers = p.form_response.answers.filter((a) => a.field.id !== "f-correo");
    const res = await enviar(conAgenda(p, ""));
    expect(res.status).toBe(200);
    expect(await db.select().from(leads)).toHaveLength(0);
    expect(await db.select().from(sobresCrudos)).toHaveLength(1);
  });

  it("solo teléfono conocido de OTRO lead: une por teléfono, marcado, sin lead nuevo", async () => {
    // Primero un lead con correo y teléfono.
    await enviar(conAgenda(fixture(), ""));
    // Ahora un envío con OTRO correo pero el MISMO teléfono: se une al mismo lead.
    const p = conAgenda(fixture(), "");
    p.form_response.token = "t-tel";
    const correo = p.form_response.answers.find((a) => a.field.id === "f-correo")!;
    correo.email = "otra.persona@correo.co";
    await enviar(p);

    // El teléfono une (regla 2 de identidad): no se crea un lead nuevo; el correo nuevo
    // entra como contacto SIN confirmar y un gerente lo resuelve (ADR 0035).
    expect(await db.select().from(leads)).toHaveLength(1);
    const [nuevo] = await db.select().from(leadContactos).where(eq(leadContactos.valor, "otra.persona@correo.co"));
    expect(nuevo.confirmado).toBe(false);
  });

  it('teléfono centinela "0" no une a nadie: entra sin teléfono principal', async () => {
    const p = conAgenda(fixture(), "");
    const tel = p.form_response.answers.find((a) => a.field.id === "f-whatsapp")!;
    tel.phone_number = "0";
    await enviar(p);
    const [lead] = await db.select().from(leads);
    expect(lead.telefono).toBeNull();
    expect(await db.select().from(leadContactos).where(eq(leadContactos.tipo, "telefono"))).toHaveLength(0);
  });
});

// ─────────────────────────────────── caso 10: nombres raros

describe("caso 10 — nombres vacíos, con tildes/emoji, largos, ausentes", () => {
  it("nombre solo con espacios queda null", async () => {
    const p = conAgenda(fixture(), "");
    const n = p.form_response.answers.find((a) => a.field.id === "f-nombre")!;
    n.text = "   ";
    await enviar(p);
    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBeNull();
  });

  it("nombre con tildes y emoji se guarda tal cual (recortado)", async () => {
    const p = conAgenda(fixture(), "");
    const n = p.form_response.answers.find((a) => a.field.id === "f-nombre")!;
    n.text = "  José Ñandú 🦤  ";
    await enviar(p);
    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBe("José Ñandú 🦤");
  });

  it("nombre muy largo se guarda entero (no hay límite en la columna)", async () => {
    const largo = "A".repeat(600);
    const p = conAgenda(fixture(), "");
    const n = p.form_response.answers.find((a) => a.field.id === "f-nombre")!;
    n.text = largo;
    await enviar(p);
    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBe(largo);
  });

  it("pregunta de nombre AUSENTE: lead sin nombre, sin error", async () => {
    const p = conAgenda(fixture(), "");
    p.form_response.answers = p.form_response.answers.filter((a) => a.field.id !== "f-nombre");
    const res = await enviar(p);
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.nombre).toBeNull();
  });
});

// ─────────────────────────────────── caso 11: UTM (centinela xxxxx; el resto sin cambio)

describe("caso 11 — UTM ausentes, vacíos, y el CENTINELA xxxxx (Mani, 28-sep)", () => {
  it("UTM presentes se guardan crudos", async () => {
    await enviar(conAgenda(fixture(), ""));
    const [envio] = await db.select().from(submissions);
    expect(envio.utmSource).toBe("facebook");
    expect(envio.utmMedium).toBe("paid");
    expect(envio.utmCampaign).toBe("tactical-septiembre");
  });

  it("UTM ausentes (sin hidden): quedan null, no un centinela inventado", async () => {
    const p = conAgenda(fixture(), "");
    delete p.form_response.hidden;
    await enviar(p);
    const [envio] = await db.select().from(submissions);
    expect(envio.utmSource).toBeNull();
    expect(envio.utmMedium).toBeNull();
    expect(envio.utmCampaign).toBeNull();
  });

  it("UTM vacíos: quedan null", async () => {
    const p = conAgenda(fixture(), "");
    p.form_response.hidden = { utm_source: "", utm_medium: "", utm_campaign: "" };
    await enviar(p);
    const [envio] = await db.select().from(submissions);
    expect(envio.utmSource).toBeNull();
  });

  it('el placeholder "xxxxx" es un CENTINELA: se trata como sin UTM (null) en los tres leídos', async () => {
    // El Forms Link de los programas trae utm_*=xxxxx como plantilla; si alguien comparte
    // el link crudo, llega "xxxxx". No es un dato: es "sin UTM" (Mani, 28-sep).
    const p = conAgenda(fixture(), "");
    p.form_response.hidden = { utm_source: "xxxxx", utm_medium: " XXXXX ", utm_campaign: "Xxxxx" };
    await enviar(p);
    const [envio] = await db.select().from(submissions);
    expect(envio.utmSource).toBeNull();
    expect(envio.utmMedium).toBeNull();
    expect(envio.utmCampaign).toBeNull();
  });

  it('el centinela "xxxxx" tampoco queda en utm_term ni utm_content', async () => {
    const p = conAgenda(fixture(), "");
    p.form_response.hidden = {
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "camp",
      utm_term: "xxxxx",
      utm_content: "xxxxx",
    };
    await enviar(p);
    const [envio] = await db.select().from(submissions);
    expect(envio.utmTerm).toBeNull();
    expect(envio.utmContent).toBeNull();
  });

  it("las seis UTM de la plantilla de Pauta quedan en sus columnas y no en respuestas; la macro, tal cual (ticket 116)", async () => {
    const p = conAgenda(fixture(), "");
    p.form_response.hidden = {
      utm_source: "ig",
      utm_medium: "paid_social",
      utm_campaign: "Metodo_Tactical",
      utm_content: "{{ad.name}}",
      utm_term: "Instagram_Reels",
      utm_id: "120212345678900001",
    };
    await enviar(p);
    const [envio] = await db.select().from(submissions);
    expect([envio.utmSource, envio.utmMedium, envio.utmCampaign, envio.utmContent, envio.utmTerm, envio.utmId]).toEqual([
      "ig",
      "paid_social",
      "Metodo_Tactical",
      "{{ad.name}}",
      "Instagram_Reels",
      "120212345678900001",
    ]);
    const respuestas = envio.respuestas as Record<string, unknown>;
    for (const llave of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id"]) {
      expect(respuestas).not.toHaveProperty(llave);
    }
  });
});

// ─────────────────────────────────── caso 12: payloads raros pero con firma buena

describe("caso 12 — respuestas raras: tipo nuevo, nula, sin definition, answers null, sin hidden", () => {
  it("un type de respuesta desconocido no rompe: el lead se guarda", async () => {
    const p = conAgenda(fixture(), "");
    // Un tipo que el adaptador no conoce, con un string dentro.
    p.form_response.answers.push({ field: { id: "f-x" }, type: "payment", text: "pagó" } as Answer);
    const res = await enviar(p);
    expect(res.status).toBe(200);
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("definition.fields ausente: sin títulos no se resuelve el correo → sobre crudo + 200", async () => {
    const p = conAgenda(fixture(), "");
    delete p.form_response.definition;
    const res = await enviar(p);
    // Sin títulos, las respuestas entran con una llave genérica y el correo no se
    // resuelve por título: no hay identidad → sobre crudo. Lo esencial: 200, nunca 500.
    expect(res.status).toBe(200);
    expect(await db.select().from(sobresCrudos)).toHaveLength(1);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("answers null: 200, sin 500 (queda como sobre crudo por falta de correo)", async () => {
    const p = conAgenda(fixture(), "");
    (p.form_response as { answers: unknown }).answers = null;
    const res = await enviar(p);
    expect(res.status).toBe(200);
    expect(await db.select().from(sobresCrudos)).toHaveLength(1);
  });

  it("hidden ausente: 200, envío guardado sin UTM", async () => {
    const p = conAgenda(fixture(), "");
    delete p.form_response.hidden;
    const res = await enviar(p);
    expect(res.status).toBe(200);
    const [envio] = await db.select().from(submissions);
    expect(envio.utmSource).toBeNull();
  });
});

// ─────────────────────────────────── caso 13: firma / cuerpo / fuente inválidos

describe("caso 13 — firma y fuente inválidas", () => {
  it("firma ausente: 401 y base intacta", async () => {
    const cuerpo = JSON.stringify(fixture());
    const res = await invocar(sourceId, cuerpo, null);
    expect(res.status).toBe(401);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("firma mala: 401 y base intacta", async () => {
    const cuerpo = JSON.stringify(fixture());
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo, "otro-secreto"));
    expect(res.status).toBe(401);
    expect(await db.select().from(submissions)).toHaveLength(0);
  });

  it("cuerpo alterado tras firmar: 401", async () => {
    const cuerpo = JSON.stringify(fixture());
    const firma = firmar(cuerpo);
    const alterado = cuerpo.replace("María", "Otra");
    const res = await invocar(sourceId, alterado, firma);
    expect(res.status).toBe(401);
  });

  it("fuente inactiva: 404", async () => {
    await db.update(sources).set({ activo: false }).where(eq(sources.id, sourceId));
    const res = await enviar(fixture());
    expect(res.status).toBe(404);
  });

  it("id que no es UUID: 404, no 500", async () => {
    const res = await invocar("no-es-uuid", JSON.stringify(fixture()), null);
    expect(res.status).toBe(404);
  });

  it("una fuente que no es webhook: 404", async () => {
    const [hoja] = await db
      .insert(sources)
      .values({ programId, nombre: "Hoja", tipo: "google_sheet", sheetId: "s", tab: "t", activo: false })
      .returning();
    const res = await enviar(fixture(), hoja.id);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────── caso 14: excepción tras firma válida

describe("caso 14 — cualquier excepción DESPUÉS de firma válida: sobre crudo + 200, nunca 500", () => {
  it("JSON inválido: sobre crudo + 200", async () => {
    const cuerpo = "no es json {{{";
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].cuerpo).toBe(cuerpo);
  });

  it("payload sin form_response (falla el esquema): sobre crudo + 200", async () => {
    const cuerpo = JSON.stringify({ event_type: "form_response" });
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    expect(await db.select().from(sobresCrudos)).toHaveLength(1);
  });
});

// ─────────────────────────────────── caso 15: dos entregas simultáneas

describe("caso 15 — dos entregas simultáneas del mismo token", () => {
  it("Promise.all de dos envíos idénticos deja UNA fila, sin 500", async () => {
    const cuerpo = JSON.stringify(conAgenda(fixture(), ""));
    const firma = firmar(cuerpo);
    const [r1, r2] = await Promise.all([
      invocar(sourceId, cuerpo, firma),
      invocar(sourceId, cuerpo, firma),
    ]);
    expect(r1.status).toBeLessThan(500);
    expect(r2.status).toBeLessThan(500);
    expect(await db.select().from(submissions)).toHaveLength(1);
    expect(await db.select().from(leads)).toHaveLength(1);
  });
});

// ─────────────────────────────────── caso D: la caja negra (Mani, 28-sep)

describe("caso D — caja negra: se guarda el cuerpo crudo de CADA envío", () => {
  it("un envío que sale BIEN queda en sobres_crudos con error null y byte a byte", async () => {
    const cuerpo = JSON.stringify(conAgenda(fixture(), ""));
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].error).toBeNull();
    // Byte a byte el cuerpo recibido.
    expect(sobres[0].cuerpo).toBe(cuerpo);
  });

  it("un envío que FALLA deja UNA sola fila (se actualiza, no se inserta otra)", async () => {
    // Sin correo: se registra con error null y luego se actualiza con el motivo.
    const p = fixture();
    p.form_response.answers = p.form_response.answers.filter((a) => a.field.id !== "f-correo");
    const cuerpo = JSON.stringify(conAgenda(p, ""));
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1); // una sola fila por entrega
    expect(sobres[0].error).not.toBeNull();
    expect(sobres[0].cuerpo).toBe(cuerpo);
  });

  it("el cuerpo guardado es EXACTAMENTE los bytes recibidos, no un JSON re-serializado", async () => {
    // Un cuerpo con espacios raros y orden de llaves propio: si la ruta re-serializara,
    // el guardado no coincidiría byte a byte (y la firma tampoco cuadraría).
    const crudo = '{\n  "event_type":"form_response",\n  "form_response":{"token":"t-bytes","answers":[]}\n}';
    const res = await invocar(sourceId, crudo, firmar(crudo));
    expect(res.status).toBe(200);
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].cuerpo).toBe(crudo);
  });
});

// ─────────────────────────────────── caso E: variables genéricas por la ruta

describe("caso E — variables genéricas (nada hard-coded a estado)", () => {
  it("una variable desconocida entra sola a submissions.respuestas, prefijada", async () => {
    const p = conAgenda(fixture(), "");
    p.form_response.variables = [
      { key: "estado", type: "text", text: "setteo_no_calificado" },
      { key: "score", type: "number", number: 88 },
      { key: "segmento", type: "text", text: "premium" },
    ];
    const res = await enviar(p);
    expect(res.status).toBe(200);
    const [envio] = await db.select().from(submissions);
    const respuestas = envio.respuestas as Record<string, string | null>;
    expect(respuestas["variable:score"]).toBe("88");
    expect(respuestas["variable:segmento"]).toBe("premium");
  });

  it("un payload SIN la variable estado entra sin Estado y no revienta", async () => {
    const p = conAgenda(fixture(), "");
    p.form_response.variables = [{ key: "score", type: "number", number: 1 }];
    const res = await enviar(p);
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBeNull();
    // Sin Estado no se abre deal (la regla no toca un lead sin calificación).
    expect(await db.select().from(deals)).toHaveLength(0);
  });

  it("una fuente que apunta el Estado a OTRA variable la usa (config, no código)", async () => {
    // La fuente configura `estadoHoja` = nombre de la variable que clasifica.
    const [fuenteOtra] = await db
      .insert(sources)
      .values({
        programId,
        nombre: "Typeform con estado en otra variable",
        tipo: "webhook",
        proveedor: "typeform",
        secretoWebhook: SECRETO,
        activo: false,
        mapeoColumnas: { agenda: AGENDA, estadoHoja: "clasificacion" },
      })
      .returning();
    await db.update(sources).set({ activo: false }).where(eq(sources.id, sourceId));
    await db.update(sources).set({ activo: true }).where(eq(sources.id, fuenteOtra.id));

    const p = conAgenda(fixture(), "");
    p.form_response.variables = [
      { key: "estado", type: "text", text: "descartado" },
      { key: "clasificacion", type: "text", text: "setteo_no_calificado" },
    ];
    const res = await enviar(p, fuenteOtra.id);
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("setteo_no_calificado");
  });
});
