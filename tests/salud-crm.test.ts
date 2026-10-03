import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import {
  entregasWebhook,
  leads,
  programs,
  sobresCrudos,
  sources,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import {
  cifrarCursor,
  descifrarCursor,
  purgarRechazosVencidos,
  registrarEntrega,
  entregasDePrograma,
  entregasHuerfanas,
} from "@/lib/queries/entregas-webhook";
import { conciliarTokens } from "@/lib/queries/conciliacion-sheets";
import { reprocesarSobre } from "@/lib/ingesta/procesar-sobre";
import { reprocesarSobreAccion } from "@/app/(app)/ajustes/salud/acciones";
import real from "./fixtures/typeform-real-tactical.json";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * La salud del CRM (ticket 110): cada entrega del webhook registrada, la purga de los
 * rechazos vencidos, el reproceso de un sobre con error, la conciliacion PURA con la
 * hoja y el 403 de la server action para un closer.
 *
 * La ruta se invoca de verdad, con payloads firmados como Typeform, contra PGlite con
 * todas las migraciones (mismo molde que `webhook-matriz.test.ts`). El invariante que
 * protege: **con o sin firma, toda entrega deja rastro en `entregas_webhook`, y
 * registrarla nunca cambia la respuesta HTTP ni tumba la ingesta**.
 */

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

vi.mock("@/lib/ingesta/regla-de-deals", async (importOriginal) => {
  try {
    return await importOriginal<Record<string, unknown>>();
  } catch {
    return {};
  }
});

// La server action pasa por `requireRole`, que pregunta la sesion: se controla con este
// holder para forjar un closer (que NO debe poder) o un gerente.
const sesionHolder: { rol: string | null } = { rol: null };
vi.mock("@/lib/auth/index", () => ({
  auth: async () =>
    sesionHolder.rol ? { user: { id: "u-actor", rol: sesionHolder.rol } } : null,
}));
// `rolDeVista` de un actor sin cookie devuelve su rol real: se replica sin next/headers.
vi.mock("@/lib/auth/vista", () => ({
  rolDeVista: async (session: { user?: { rol?: string } }) => session?.user?.rol ?? null,
}));

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;
const SECRETO = "secreto-de-prueba-hmac-32-bytes-aqui";
const AGENDA = "Agenda aquí tu entrevista";

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

async function enviar(payload: unknown, fuente = sourceId): Promise<Response> {
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

/** Un fetch que lanza: ningún caso de este archivo debería tocar Calendly. */
function fetchQueLanza() {
  return vi.fn(async () => {
    throw new Error("fetch no debería llamarse en este caso");
  });
}

beforeEach(async () => {
  vi.stubGlobal("fetch", fetchQueLanza());
  ({ db, cerrar } = await crearBaseDePrueba());
  holder.db = db;
  sesionHolder.rol = null;
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

// ─────────────────────────────────────────── entrega 200 procesada

describe("entrega 200 procesada", () => {
  it("queda registrada con motivo procesado, su lead y su sobre", async () => {
    const res = await enviar(conEstado(fixture(), "descartado"));
    expect(res.status).toBe(200);

    const [entrega] = await db.select().from(entregasWebhook);
    expect(entrega.codigoHttp).toBe(200);
    expect(entrega.motivo).toBe("procesado");
    expect(entrega.programId).toBe(programId);
    expect(entrega.sourceId).toBe(sourceId);

    // Trae el lead que se creó.
    const [lead] = await db.select().from(leads);
    expect(entrega.leadId).toBe(lead.id);

    // Trae el sobre crudo (caja negra).
    const [sobre] = await db.select().from(sobresCrudos);
    expect(entrega.sobreId).toBe(sobre.id);
    expect(sobre.error).toBeNull();
  });
});

/** Cambia la variable `estado` del payload (para no depender de Calendly). */
function conEstado(p: Fixture, estado: string): Fixture {
  p.form_response.variables = [{ key: "estado", type: "text", text: estado }];
  return p;
}

// ─────────────────────────────────────────── 401 por firma ausente vs inválida

describe("401 firma ausente vs firma inválida", () => {
  it("sin header: firma_ausente, sin cuerpo guardado", async () => {
    const cuerpo = JSON.stringify(conEstado(fixture(), "descartado"));
    const res = await invocar(sourceId, cuerpo, null);
    expect(res.status).toBe(401);

    const [entrega] = await db.select().from(entregasWebhook);
    expect(entrega.codigoHttp).toBe(401);
    expect(entrega.motivo).toBe("firma_ausente");
    // Un rechazo va SIN cuerpo: sin sobre y sin lead.
    expect(entrega.sobreId).toBeNull();
    expect(entrega.leadId).toBeNull();
    // La base no se movió.
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("header con firma que no cuadra: firma_invalida", async () => {
    const cuerpo = JSON.stringify(conEstado(fixture(), "descartado"));
    const res = await invocar(sourceId, cuerpo, "sha256=firmaquenocuadra");
    expect(res.status).toBe(401);

    const [entrega] = await db.select().from(entregasWebhook);
    expect(entrega.motivo).toBe("firma_invalida");
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────── 404 por fuente inexistente

describe("404 fuente inexistente", () => {
  it("un uuid que no es fuente: fuente_no_encontrada, huérfana", async () => {
    const idInexistente = "00000000-0000-4000-8000-000000000000";
    const cuerpo = JSON.stringify(fixture());
    const res = await invocar(idInexistente, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(404);

    const [entrega] = await db.select().from(entregasWebhook);
    expect(entrega.codigoHttp).toBe(404);
    expect(entrega.motivo).toBe("fuente_no_encontrada");
    // Huérfana: sin fuente ni programa.
    expect(entrega.sourceId).toBeNull();
    expect(entrega.programId).toBeNull();

    // La lectura de huérfanas la trae; la de un programa no.
    expect((await entregasHuerfanas(null, db)).entregas).toHaveLength(1);
    expect((await entregasDePrograma(programId, null, db)).entregas).toHaveLength(0);
  });
});

// ─────────────────────────────────────────── registrar la entrega nunca tumba nada

describe("registrar la entrega no cambia la respuesta ni tumba la ingesta", () => {
  it("si el INSERT de la entrega falla, la respuesta sigue siendo 200 y el lead entra", async () => {
    // Se simula un fallo del insert de `entregas_webhook` interceptando `db.insert`
    // SOLO para esa tabla; todo lo demás sigue funcionando.
    const insertReal = db.insert.bind(db);
    const espia = vi
      .spyOn(db, "insert")
      .mockImplementation(((tabla: unknown) => {
        if (tabla === entregasWebhook) {
          throw new Error("fallo simulado al registrar la entrega");
        }
        return insertReal(tabla as never);
      }) as typeof db.insert);

    try {
      const res = await enviar(conEstado(fixture(), "descartado"));
      // La respuesta no cambia.
      expect(res.status).toBe(200);
      // La ingesta ocurrió: el lead está.
      expect(await db.select().from(leads)).toHaveLength(1);
    } finally {
      espia.mockRestore();
    }

    // Y no quedó ninguna entrega registrada (el insert falló), pero nada reventó.
    expect(await db.select().from(entregasWebhook)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────── purga de rechazos > 90 días

describe("purga de rechazos vencidos", () => {
  it("borra solo los rechazos de más de 90 días, no los recientes ni los aceptados", async () => {
    const hace100dias = new Date(Date.now() - 100 * 86_400_000);
    const hace10dias = new Date(Date.now() - 10 * 86_400_000);

    // Un rechazo viejo (se borra), uno reciente (se queda) y un aceptado viejo (se queda).
    await db.insert(entregasWebhook).values([
      { programId, sourceId, codigoHttp: 401, motivo: "firma_invalida", recibidoEn: hace100dias },
      { programId, sourceId, codigoHttp: 401, motivo: "firma_invalida", recibidoEn: hace10dias },
      { programId, sourceId, codigoHttp: 200, motivo: "procesado", recibidoEn: hace100dias },
    ]);

    const borradas = await purgarRechazosVencidos(db);
    expect(borradas).toBe(1);

    const quedan = await db.select().from(entregasWebhook);
    expect(quedan).toHaveLength(2);
    // El aceptado viejo sobrevive (queda con su sobre, ADR 0058).
    expect(quedan.some((e) => e.motivo === "procesado")).toBe(true);
    // El rechazo reciente sobrevive.
    expect(quedan.filter((e) => e.motivo === "firma_invalida")).toHaveLength(1);
  });

  it("registrar un rechazo nuevo purga los vencidos de una vez (sin cron)", async () => {
    const hace100dias = new Date(Date.now() - 100 * 86_400_000);
    await db.insert(entregasWebhook).values({
      programId,
      sourceId,
      codigoHttp: 404,
      motivo: "fuente_no_encontrada",
      recibidoEn: hace100dias,
    });

    // Un rechazo nuevo: al registrarlo, el vencido se va.
    await registrarEntrega(db, {
      programId,
      sourceId,
      sobreId: null,
      leadId: null,
      codigoHttp: 401,
      motivo: "firma_invalida",
    });

    const quedan = await db.select().from(entregasWebhook);
    // Solo el nuevo.
    expect(quedan).toHaveLength(1);
    expect(quedan[0].motivo).toBe("firma_invalida");
  });
});

// ─────────────────────────────────────────── reprocesar un sobre con error

describe("reprocesar un sobre con error", () => {
  it("vuelve a correr la ingesta, marca reprocesado_en y esta vez entra el lead", async () => {
    // Se guarda a mano un sobre con error, con un cuerpo VÁLIDO (descartado, no toca
    // Calendly): simula un sobre que falló y ahora puede procesarse.
    const cuerpo = JSON.stringify(conEstado(fixture(), "descartado"));
    const [sobre] = await db
      .insert(sobresCrudos)
      .values({ sourceId, programId, cuerpo, error: "fallo anterior simulado" })
      .returning();

    const reproceso = await reprocesarSobre(db, sobre.id);
    expect(reproceso).not.toBeNull();
    expect(reproceso!.resultado.motivo).toBe("procesado");

    // El sobre quedó marcado.
    const [despues] = await db.select().from(sobresCrudos).where(eq(sobresCrudos.id, sobre.id));
    expect(despues.reprocesadoEn).not.toBeNull();
    expect(despues.error).toBeNull();

    // El lead entró.
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("un sobre ya procesado (sin error) no se reprocesa", async () => {
    const cuerpo = JSON.stringify(conEstado(fixture(), "descartado"));
    const [sobre] = await db.insert(sobresCrudos).values({ sourceId, programId, cuerpo, error: null }).returning();
    expect(await reprocesarSobre(db, sobre.id)).toBeNull();
  });
});

// ─────────────────────────────────────────── la server action exige esAdministrador

describe("server action de reprocesar: rol en el servidor", () => {
  it("un closer recibe 403 (se forja la petición, no se mira el botón)", async () => {
    const cuerpo = JSON.stringify(conEstado(fixture(), "descartado"));
    const [sobre] = await db
      .insert(sobresCrudos)
      .values({ sourceId, programId, cuerpo, error: "fallo anterior" })
      .returning();

    sesionHolder.rol = "closer";
    const r = await reprocesarSobreAccion(sobre.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("solo para");

    // Y el sobre no se tocó.
    const [despues] = await db.select().from(sobresCrudos).where(eq(sobresCrudos.id, sobre.id));
    expect(despues.reprocesadoEn).toBeNull();
  });

  it("un gerente sí reprocesa y registra la entrega nueva", async () => {
    const cuerpo = JSON.stringify(conEstado(fixture(), "descartado"));
    const [sobre] = await db
      .insert(sobresCrudos)
      .values({ sourceId, programId, cuerpo, error: "fallo anterior" })
      .returning();

    sesionHolder.rol = "gerente";
    const r = await reprocesarSobreAccion(sobre.id);
    expect(r.ok).toBe(true);

    // Quedó una entrega nueva por el reproceso.
    const entregas = await db.select().from(entregasWebhook);
    expect(entregas).toHaveLength(1);
    expect(entregas[0].motivo).toBe("procesado");
    expect(entregas[0].sobreId).toBe(sobre.id);
  });
});

// ─────────────────────────────────────────── conciliación: función PURA

describe("conciliarTokens (pura, sin red ni Sheets)", () => {
  it("encuentra lo que falta en cada lado y cuenta los totales", async () => {
    const hoja = new Set(["a", "b", "c", "d"]);
    const crm = new Set(["b", "c", "e"]);

    const r = conciliarTokens(hoja, crm);
    expect(r.enHojaNoEnCrm).toEqual(["a", "d"]);
    expect(r.enCrmNoEnHoja).toEqual(["e"]);
    expect(r.totalHoja).toBe(4);
    expect(r.totalCrm).toBe(3);
  });

  it("dos lados idénticos no dejan diferencias", async () => {
    const s = new Set(["x", "y"]);
    const r = conciliarTokens(s, new Set(["x", "y"]));
    expect(r.enHojaNoEnCrm).toEqual([]);
    expect(r.enCrmNoEnHoja).toEqual([]);
  });
});

// ─────────────────────────────────────────── lectura por programa

describe("entregasDePrograma", () => {
  it("trae las del programa, la más reciente arriba, y no las huérfanas", async () => {
    const viejo = new Date(Date.now() - 60_000);
    const nuevo = new Date();
    await db.insert(entregasWebhook).values([
      { programId, sourceId, codigoHttp: 200, motivo: "procesado", recibidoEn: viejo },
      { programId, sourceId, codigoHttp: 401, motivo: "firma_invalida", recibidoEn: nuevo },
      { programId: null, sourceId: null, codigoHttp: 404, motivo: "fuente_no_encontrada", recibidoEn: nuevo },
    ]);

    const { entregas: lista } = await entregasDePrograma(programId, null, db);
    expect(lista).toHaveLength(2);
    // La más reciente arriba.
    expect(lista[0].motivo).toBe("firma_invalida");
    expect(lista[1].motivo).toBe("procesado");

    // Sanidad: la huérfana no está aquí.
    expect(lista.every((e) => e.motivo !== "fuente_no_encontrada")).toBe(true);
    // Está en la de huérfanas.
    const orphan = await db
      .select()
      .from(entregasWebhook)
      .where(and(isNull(entregasWebhook.sourceId), eq(entregasWebhook.motivo, "fuente_no_encontrada")));
    expect(orphan).toHaveLength(1);
  });
});

// ─────────────────────────────────────────── paginación keyset (ticket 173)

describe("paginación de entregas (keyset por fecha e id, 25 por página)", () => {
  /** Siembra n entregas, las k primeras con la MISMA fecha, para probar el desempate por id. */
  async function sembrar(n: number, empatadas = 0): Promise<void> {
    const base = Date.now();
    const filas = Array.from({ length: n }, (_, i) => ({
      programId,
      sourceId,
      codigoHttp: 200 as const,
      motivo: "procesado" as const,
      // Las `empatadas` primeras caen todas en el MISMO instante; el resto, separadas.
      recibidoEn: new Date(i < empatadas ? base : base - (i + 1) * 1000),
    }));
    await db.insert(entregasWebhook).values(filas);
  }

  it("la primera página trae 25 y un cursor; la base no se recorre con OFFSET", async () => {
    await sembrar(30);
    const pagina = await entregasDePrograma(programId, null, db);
    expect(pagina.entregas).toHaveLength(25);
    expect(pagina.cursor).not.toBeNull();
  });

  it("el cursor trae las siguientes sin solape ni hueco, y la última página no tiene cursor", async () => {
    await sembrar(30);
    const primera = await entregasDePrograma(programId, null, db);
    const cursor = descifrarCursor(primera.cursor);
    const segunda = await entregasDePrograma(programId, cursor, db);

    // Las 5 restantes y ya no hay más.
    expect(segunda.entregas).toHaveLength(5);
    expect(segunda.cursor).toBeNull();

    // Sin solape ni hueco: las 30 ids, cada una una vez.
    const ids = new Set([...primera.entregas, ...segunda.entregas].map((e) => e.id));
    expect(ids.size).toBe(30);
  });

  it("desempata por id cuando varias caen en el mismo instante (ni se saltan ni se repiten)", async () => {
    // 30 entregas, todas con la MISMA fecha: sin el id en el keyset se saltarían o repetirían.
    await sembrar(30, 30);
    const primera = await entregasDePrograma(programId, null, db);
    const segunda = await entregasDePrograma(programId, descifrarCursor(primera.cursor), db);

    expect(primera.entregas).toHaveLength(25);
    expect(segunda.entregas).toHaveLength(5);
    expect(segunda.cursor).toBeNull();
    const ids = new Set([...primera.entregas, ...segunda.entregas].map((e) => e.id));
    expect(ids.size).toBe(30);
  });

  it("exactamente 25 no deja cursor: no hay página siguiente", async () => {
    await sembrar(25);
    const pagina = await entregasDePrograma(programId, null, db);
    expect(pagina.entregas).toHaveLength(25);
    expect(pagina.cursor).toBeNull();
  });

  it("un cursor malformado se trata como primera página, no revienta", () => {
    expect(descifrarCursor("no-es-base64-valido-ni-tiene-barra")).toBeNull();
    expect(descifrarCursor("")).toBeNull();
    expect(descifrarCursor(null)).toBeNull();
  });

  it("cifrar y descifrar un cursor es ida y vuelta", () => {
    const fecha = new Date("2026-10-02T15:00:00.000Z");
    const cursor = descifrarCursor(cifrarCursor({ recibidoEn: fecha, id: "abc-123" }));
    expect(cursor?.recibidoEn.toISOString()).toBe(fecha.toISOString());
    expect(cursor?.id).toBe("abc-123");
  });
});
