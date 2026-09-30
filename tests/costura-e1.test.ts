import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
  changeLog,
  dealEtapaHistorial,
  deals,
  leadContactos,
  leads,
  miembrosPrograma,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agregarLlamada, pegarGrain } from "@/lib/deals/llamadas";
import { entradasDesdeMatriz } from "@/lib/ingesta/adaptador-sheets";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { apartarLasQueYaEntraron } from "@/lib/sheets/traslado";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA, sembrarEstadosDeLlegada } from "./helpers/programa-de-prueba";
import real from "./fixtures/typeform-real-tactical.json";

/**
 * Prueba de COSTURA de la etapa E1 (`docs/plan-reparto.md` §4, E1). Cruza los dos
 * carriles de la etapa en un solo recorrido, contra PGlite con TODAS las migraciones:
 *
 *  - carril Mani (motor): un deal registra su llamada y su Grain, moviéndose por el
 *    motor de etapas (`lib/deals/llamadas.ts`: `agregarLlamada`, `pegarGrain`);
 *  - carril Alejo (entradas): un envío firmado entra por la RUTA real del webhook y el
 *    traslado desde Sheets entra por la misma puerta de ingesta
 *    (`lib/ingesta/ingerir.ts`, `lib/sheets/traslado.ts`).
 *
 * Lo que la costura protege es justo lo que ningún test de un solo carril ve: que el
 * envío que abre el deal, la mutación que lo agenda y el Grain que lo atiende encajen; y
 * que la historia de Sheets y el webhook NO dupliquen un lead.
 *
 * Molde: el de `tests/webhook-matriz.test.ts` para la ruta firmada (mock de `@/lib/db`,
 * `next/cache` y Calendly con `vi.stubGlobal("fetch")`), el de
 * `tests/llamadas-del-deal.test.ts` para las mutaciones del deal y el de
 * `tests/traslado.test.ts` para el camino de la hoja.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

// La regla de deals corre de verdad (es la que abre el deal desde el webhook); solo se
// evita que un fallo de import la tumbe, igual que en webhook-matriz.
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
let webhookSourceId: string;
let hojaSourceId: string;
let closer: string;

const SECRETO = "secreto-de-prueba-hmac-32-bytes-aqui";
const AGENDA = "Agenda aquí tu entrevista";
const rolCloser = "closer" as const;

function firmar(cuerpo: string, secreto = SECRETO): string {
  return "sha256=" + createHmac("sha256", secreto).update(cuerpo, "utf8").digest("base64");
}

function peticion(cuerpo: string, firma: string | null): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (firma !== null) headers["Typeform-Signature"] = firma;
  return new Request("https://app.retia.co/api/webhooks/formularios/x", {
    method: "POST",
    headers,
    body: cuerpo,
  });
}

async function invocar(fuente: string, cuerpo: string, firma: string | null): Promise<Response> {
  const { POST } = await import("@/app/api/webhooks/formularios/[fuente]/route");
  return POST(peticion(cuerpo, firma), { params: Promise.resolve({ fuente }) });
}

/** Envía un payload firmado a la fuente webhook por defecto. */
async function enviar(payload: unknown, fuente = webhookSourceId): Promise<Response> {
  const cuerpo = JSON.stringify(payload);
  return invocar(fuente, cuerpo, firmar(cuerpo));
}

type Fixture = {
  event_type: string;
  form_response: {
    token: string;
    submitted_at?: string;
    variables?: { key: string; type: string; text?: string; number?: number }[];
    hidden?: Record<string, string>;
    definition?: { fields: { id: string; title: string; type?: string }[] };
    answers: { field: { id: string; type?: string }; type: string; [k: string]: unknown }[];
  };
};

function fixture(): Fixture {
  return structuredClone(real) as unknown as Fixture;
}

/** Cambia la variable `estado` del payload. */
function conEstado(p: Fixture, estado: string): Fixture {
  p.form_response.variables = [{ key: "estado", type: "text", text: estado }];
  return p;
}

/** Reemplaza el link de la pregunta de agenda (o lo vacía con ""). */
function conAgenda(p: Fixture, url: string): Fixture {
  const a = p.form_response.answers.find((x) => x.field.id === "f-agenda")!;
  a.url = url;
  return p;
}

/** El correo del invitado del payload (para variar la identidad). */
function conCorreo(p: Fixture, correo: string): Fixture {
  const a = p.form_response.answers.find((x) => x.field.id === "f-correo")!;
  a.email = correo;
  return p;
}

/** El fetch por defecto: lanza si algo lo llama (ningún caso aquí toca Calendly). */
function fetchQueLanza() {
  return vi.fn(async () => {
    throw new Error("fetch no debería llamarse en este caso");
  });
}

// El correo normalizado del fixture (minúsculas, recortado): la persona única.
const CORREO = "mariajose.gomez@correo.co";

beforeEach(async () => {
  vi.stubGlobal("fetch", fetchQueLanza());
  ({ db, cerrar } = await crearBaseDePrueba());
  holder.db = db;

  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" })
    .returning();
  programId = p.id;
  await sembrarEstadosDeLlegada(db, programId);

  // Un closer con membresía activa del programa (ADR 0048): trabaja los leads de aquí.
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  closer = u.id;
  await db.insert(miembrosPrograma).values({ userId: closer, programId, activo: true });

  // La fuente webhook (Typeform), activa: por aquí entran los envíos firmados.
  const [w] = await db
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
  webhookSourceId = w.id;

  // La fuente google_sheet, INACTIVA: la historia de Sheets se lee una vez por el
  // traslado (ADR 0004, ticket 111), no se sincroniza.
  const [h] = await db
    .insert(sources)
    .values({
      programId,
      nombre: "Formulario (hoja histórica)",
      tipo: "google_sheet",
      sheetId: "hoja-1",
      tab: "New form",
      activo: false,
    })
    .returning();
  hojaSourceId = h.id;
});

afterEach(async () => {
  holder.db = null;
  vi.unstubAllGlobals();
  await cerrar();
});

// ─────────────────────────────────────────── caso 1: el recorrido del deal

describe("caso 1 — el envío abre el deal, se agenda, se pega el Grain y queda en Atendido", () => {
  it("Pendiente Setteo → Agendado → Atendido, con historial completo y rastro en change_log", async () => {
    // 1. El envío firmado entra por la RUTA real. `setteo_no_calificado` sin link de
    //    agenda abre un deal en Pendiente Setteo, sin llamada (regla de deals).
    const res = await enviar(conAgenda(conEstado(fixture(), "setteo_no_calificado"), ""));
    expect(res.status).toBe(200);

    const [lead] = await db.select().from(leads);
    expect(lead.emailNormalizado).toBe(CORREO);

    const dealsIniciales = await db.select().from(deals);
    expect(dealsIniciales).toHaveLength(1);
    const dealId = dealsIniciales[0].id;
    expect(dealsIniciales[0].etapa).toBe("pendiente_setteo");
    // El deal lo abrió el sistema: nace sin dueño (Unclaimed).
    expect(dealsIniciales[0].ownerUserId).toBeNull();
    expect(await db.select().from(calls)).toHaveLength(0);

    // 2. El closer reclama el deal. Reclamar es el ticket 070 (fuera de E1): aquí se
    //    simula la asignación del dueño, que es su precondición para registrar.
    await db.update(deals).set({ ownerUserId: closer }).where(eq(deals.id, dealId));

    // 3. El closer agenda la llamada. Desde Pendiente Setteo, `agregarLlamada` mueve el
    //    deal a Agendado por el motor (`moverEtapa`).
    const fechaCita = new Date("2026-10-05T16:00:00.000Z");
    const { callId, movioAAgendado } = await agregarLlamada(
      db,
      { userId: closer, rol: rolCloser },
      { dealId, fechaAgenda: fechaCita, linkCalendly: "https://calendly.com/maru/30min/abc" },
    );
    expect(movioAAgendado).toBe(true);

    const [trasAgendar] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(trasAgendar.etapa).toBe("agendado");

    const [call] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(call.dealId).toBe(dealId);
    expect(call.programId).toBe(programId);
    expect(call.closerUserId).toBe(closer);
    expect(call.resultado).toBe("agendada");
    expect(call.origen).toBe("crm");

    // 4. Se pega el link de Grain: es decir que la llamada sucedió, y mueve el deal a
    //    Atendido (T10 Agendado → Atendido, del sistema).
    const { movioAAtendido, etapa } = await pegarGrain(
      db,
      { userId: closer, rol: rolCloser },
      { callId, linkGrain: "https://grain.com/share/recording/xyz-123" },
    );
    expect(movioAAtendido).toBe(true);
    expect(etapa).toBe("atendido");

    const [dealFinal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(dealFinal.etapa).toBe("atendido");

    const [callFinal] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(callFinal.resultado).toBe("show");
    expect(callFinal.linkGrain).toBe("https://grain.com/share/recording/xyz-123");
    expect(callFinal.fechaLlamada).not.toBeNull();

    // 5. `deal_etapa_historial` tiene CADA movimiento, en orden.
    const historial = await db
      .select()
      .from(dealEtapaHistorial)
      .where(eq(dealEtapaHistorial.dealId, dealId))
      .orderBy(dealEtapaHistorial.fecha);
    expect(historial.map((h) => [h.de, h.a])).toEqual([
      [null, "pendiente_setteo"], // el alta del sistema (webhook)
      ["pendiente_setteo", "agendado"], // agregarLlamada (por el closer)
      ["agendado", "atendido"], // pegarGrain (por el sistema)
    ]);

    // 6. `change_log` tiene el rastro de la escritura del CRM (ADR 0042): la creación
    //    de la llamada y el Grain quedan registrados contra la tabla `calls`.
    const rastroCall = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.tabla, "calls"), eq(changeLog.registroId, callId)));
    const campos = rastroCall.map((f) => f.campo);
    // El alta de la llamada (agregarLlamada).
    expect(campos).toContain("resultado");
    expect(campos).toContain("fechaAgenda");
    // El Grain (pegarGrain) sobre la MISMA llamada.
    expect(campos).toContain("linkGrain");
    // El actor de la creación fue el closer.
    expect(
      rastroCall.some((f) => f.campo === "resultado" && f.userId === closer),
    ).toBe(true);
  });
});

// ─────────────────────────────────── caso 2: traslado + webhook no duplican

/** Los encabezados de la hoja histórica (vocabulario de Sheets). */
const ENCABEZADOS = [
  "Token",
  "Correo electronico",
  "WhatsApp",
  "Nombre completo",
  "Submitted At",
  "Estado",
];

function matriz(filas: (string | null)[][]): string[][] {
  return [ENCABEZADOS, ...filas.map((f) => f.map((c) => c ?? ""))];
}

/** Fila de hoja: [token, correo, whatsapp, nombre, fecha, estado]. */
function filaHoja(o: {
  token?: string;
  correo?: string;
  whatsapp?: string;
  nombre?: string;
  fecha?: string;
  estado?: string;
}): (string | null)[] {
  return [
    o.token ?? "",
    o.correo ?? "",
    o.whatsapp ?? "",
    o.nombre ?? "",
    o.fecha ?? "",
    o.estado ?? "",
  ];
}

function entradasDeHoja(filas: (string | null)[][]) {
  return entradasDesdeMatriz(matriz(filas), { sourceId: hojaSourceId, zona: "UTC" });
}

describe("caso 2 — el traslado desde Sheets y el webhook son la misma persona: UN solo lead", () => {
  it("hoja con T1, luego el MISMO correo (otra grafía) por webhook con T2: un lead, dos envíos", async () => {
    // 1. Traslado: la persona entra desde la hoja histórica con token T1.
    const desdeHoja = entradasDeHoja([
      filaHoja({
        token: "T1",
        correo: "MariaJose.Gomez@Correo.co",
        fecha: "2026-08-01T10:00:00Z",
        estado: "🗑️ Descartado",
      }),
    ]);
    await ingerirEntradas(db, programId, desdeHoja, { aplicarReglaDeDeals: false });

    let leadsDelPrograma = await db.select().from(leads).where(eq(leads.programId, programId));
    expect(leadsDelPrograma).toHaveLength(1);
    expect(leadsDelPrograma[0].emailNormalizado).toBe(CORREO);
    const leadId = leadsDelPrograma[0].id;

    // 2. La MISMA persona vuelve a llenar el formulario (mayúsculas y espacios distintos)
    //    y entra por la RUTA del webhook con un token NUEVO T2.
    const porWebhook = conAgenda(conEstado(fixture(), "setteo_no_calificado"), "");
    porWebhook.form_response.token = "T2";
    conCorreo(porWebhook, "  MARIAJOSE.gomez@CORREO.CO ");
    const res = await enviar(porWebhook);
    expect(res.status).toBe(200);

    // 3. Sigue habiendo UN solo lead en el programa: la llave es
    //    (program_id, email_normalizado), y la normalización une las dos grafías.
    leadsDelPrograma = await db.select().from(leads).where(eq(leads.programId, programId));
    expect(leadsDelPrograma).toHaveLength(1);
    expect(leadsDelPrograma[0].id).toBe(leadId);

    // Con DOS envíos: uno de la hoja (T1) y uno del webhook (T2).
    const envios = await db.select().from(submissions);
    expect(envios).toHaveLength(2);
    expect(envios.map((e) => e.token).sort()).toEqual(["T1", "T2"]);
    // Los dos cuelgan del mismo lead.
    expect(envios.every((e) => e.leadId === leadId)).toBe(true);
  });

  it("caso inverso — webhook con T3, luego la hoja trae el MISMO T3: apartarLasQueYaEntraron lo aparta", async () => {
    // 1. La persona entra primero por el webhook con token T3.
    const porWebhook = conAgenda(conEstado(fixture(), "setteo_no_calificado"), "");
    porWebhook.form_response.token = "T3";
    const res = await enviar(porWebhook);
    expect(res.status).toBe(200);

    const enviosAntes = await db.select().from(submissions);
    expect(enviosAntes).toHaveLength(1);
    expect(enviosAntes[0].token).toBe("T3");

    // 2. El mismo envío aparece luego en la hoja histórica con el mismo T3. El traslado
    //    pregunta primero qué tokens ya tiene el programa y aparta los que ya entraron.
    const desdeHoja = entradasDeHoja([
      filaHoja({
        token: "T3",
        correo: "MariaJose.Gomez@Correo.co",
        fecha: "2026-09-25T14:00:00Z",
        estado: "🗑️ Descartado",
      }),
    ]);
    // El programa ya tiene T3 (por el webhook, misma fuente-agnóstico: es el token de la
    // entrega). En el traslado real este set sale de los tokens que el programa ya
    // registró; aquí se arma con lo que hay en `submissions`.
    const yaEnElCrm = new Set(enviosAntes.map((e) => e.token));
    const { nuevas, yaEnElCrm: apartadas } = apartarLasQueYaEntraron(desdeHoja, yaEnElCrm);
    expect(apartadas).toBe(1);
    expect(nuevas).toHaveLength(0);

    // 3. Como no queda nada nuevo, no se ingiere de la hoja: el lead sigue con UN envío.
    if (nuevas.length > 0) {
      await ingerirEntradas(
        db,
        programId,
        nuevas.map((e) => ({ ...e, sourceId: hojaSourceId })),
        { aplicarReglaDeDeals: false },
      );
    }

    const enviosDespues = await db.select().from(submissions);
    expect(enviosDespues).toHaveLength(1);
    expect(enviosDespues[0].token).toBe("T3");

    // Y un solo lead, con un solo contacto de correo.
    const leadsDelPrograma = await db.select().from(leads).where(eq(leads.programId, programId));
    expect(leadsDelPrograma).toHaveLength(1);
    const contactosCorreo = await db
      .select()
      .from(leadContactos)
      .where(and(eq(leadContactos.programId, programId), eq(leadContactos.tipo, "correo")));
    expect(contactosCorreo).toHaveLength(1);
  });
});
