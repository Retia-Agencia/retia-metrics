import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { calls, deals, leadContactos, leads, programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import completo from "./fixtures/typeform-completo.json";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * La ruta del webhook (ticket 106, ADR 0055), contra PGlite con TODAS las migraciones:
 * la firma, el 404, la idempotencia, el sobre crudo y el 200 son los de verdad.
 *
 * `@/lib/db` se reemplaza por la base de prueba (holder mutable porque `vi.mock` se iza
 * antes del `beforeEach`). La ingesta y el adaptador corren sin mock: es el camino real.
 *
 * `globalThis.fetch` se stubea para que la lectura de Calendly (ticket 052) NUNCA toque
 * la red: el fixture trae un link de Calendly sin segmento `/invitees/<uuid>`, asi que
 * la cita resuelve a "no encontrada" sin llamar a la API. El stub que lanza garantiza
 * que si alguna vez SI se llamara, el test lo delata en vez de salir a internet.
 */

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

// La regla de deals (ticket 052) no es de este ticket: se aisla para que el webhook se
// pruebe aunque el motor de etapas todavia no exista o cambie. La ingesta la invoca solo
// cuando `aplicarReglaDeDeals` es true, que es justo lo que el webhook pide.
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

beforeEach(async () => {
  // Cualquier llamada a Calendly en un test del webhook es un error: el fixture no trae
  // un uuid de invitado, asi que la cita se resuelve sin red. Si algo la llamara, este
  // stub lo delata en vez de salir a internet.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("fetch no debería llamarse en los tests del webhook");
    }),
  );
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
      // La pregunta de agenda la dice el mapeo de la fuente (ADR 0012, ADR 0054 2a
      // enmienda): sin esto, el envio nunca sube a con_calendly.
      mapeoColumnas: { agenda: "Agenda aquí tu entrevista" },
    })
    .returning();
  sourceId = f.id;
});

afterEach(async () => {
  holder.db = null;
  vi.unstubAllGlobals();
  await cerrar();
});

describe("POST /api/webhooks/formularios/[fuente]", () => {
  it("firma buena: crea lead, envio y contactos, y responde 200", async () => {
    const cuerpo = JSON.stringify(completo);
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });

    const filasLead = await db.select().from(leads);
    expect(filasLead).toHaveLength(1);
    expect(filasLead[0].emailNormalizado).toBe("ana.perez@correo.co");
    // El agendo (ADR 0054, segunda enmienda) llego hasta el lead.
    expect(filasLead[0].calificacion).toBe("con_calendly");

    const filasEnvio = await db.select().from(submissions);
    expect(filasEnvio).toHaveLength(1);
    expect(filasEnvio[0].sourceId).toBe(sourceId);
    expect(filasEnvio[0].token).toBe("tok-completo-001");
    // El link de Calendly queda en respuestas para el 096.
    expect(JSON.stringify(filasEnvio[0].respuestas)).toContain("calendly.com");

    const contactos = await db.select().from(leadContactos);
    expect(contactos.map((c) => c.tipo).sort()).toEqual(["correo", "telefono"]);

    // Caja negra (Mani, 28-sep): se guarda el cuerpo de CADA envio, incluso el que salio
    // bien, con error null.
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].error).toBeNull();
    expect(sobres[0].cuerpo).toBe(cuerpo);
  });

  it("firma mala: 401 y la base no se mueve", async () => {
    const cuerpo = JSON.stringify(completo);
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo, "otro-secreto"));
    expect(res.status).toBe(401);
    expect(await db.select().from(leads)).toHaveLength(0);
    expect(await db.select().from(submissions)).toHaveLength(0);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
  });

  it("sin header de firma: 401 y la base no se mueve", async () => {
    const cuerpo = JSON.stringify(completo);
    const res = await invocar(sourceId, cuerpo, null);
    expect(res.status).toBe(401);
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("el mismo envio dos veces deja UNA fila (idempotente por token)", async () => {
    const cuerpo = JSON.stringify(completo);
    await invocar(sourceId, cuerpo, firmar(cuerpo));
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    expect(await db.select().from(submissions)).toHaveLength(1);
    expect(await db.select().from(leads)).toHaveLength(1);
  });

  it("firma buena pero sin correo: guarda el sobre crudo y responde 200", async () => {
    const sinCorreo = structuredClone(completo);
    // Se quita la respuesta de correo (y el correo de otras piezas): no hay identidad.
    sinCorreo.form_response.answers = sinCorreo.form_response.answers.filter(
      (a) => a.field.id !== "f-correo",
    );
    const cuerpo = JSON.stringify(sinCorreo);
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ guardado: true });

    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].sourceId).toBe(sourceId);
    expect(sobres[0].cuerpo).toBe(cuerpo);
    // Una sola fila por entrega: se registro con error null y se ACTUALIZO con el motivo.
    expect(sobres[0].error).toContain("sin correo");
    // No se creo lead: no habia a quien.
    expect(await db.select().from(leads)).toHaveLength(0);
  });

  it("payload que no es JSON, con firma buena: sobre crudo + 200", async () => {
    const cuerpo = "esto no es json {{{";
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].cuerpo).toBe(cuerpo);
    expect(sobres[0].error).not.toBeNull();
  });

  it("sin agenda en el mapeo de la fuente, el mismo envio NO sube a con_calendly", async () => {
    // Una fuente webhook sin `agenda` mapeada: el link de Calendly del envio no cuenta,
    // porque cual pregunta es la de agenda lo dice el mapeo (ADR 0012), no el contenido.
    const [sinAgenda] = await db
      .insert(sources)
      .values({
        programId,
        nombre: "Typeform sin agenda",
        tipo: "webhook",
        proveedor: "typeform",
        secretoWebhook: SECRETO,
        activo: false,
        mapeoColumnas: {},
      })
      .returning();
    await db.update(sources).set({ activo: false }).where(eq(sources.id, sourceId));
    await db.update(sources).set({ activo: true }).where(eq(sources.id, sinAgenda.id));

    const cuerpo = JSON.stringify(completo);
    const res = await invocar(sinAgenda.id, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);
    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("setteo_no_calificado");
  });

  it("un id que no es fuente activa: 404 y no lee el cuerpo", async () => {
    const res = await invocar("00000000-0000-0000-0000-000000000000", JSON.stringify(completo), null);
    expect(res.status).toBe(404);
    expect(await db.select().from(leads)).toHaveLength(0);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
  });

  it("un id que ni siquiera es UUID: 404, no 500", async () => {
    const res = await invocar("no-es-un-uuid", JSON.stringify(completo), null);
    expect(res.status).toBe(404);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
  });

  it("una fuente webhook DESACTIVADA es 404 (no recibe)", async () => {
    await db.update(sources).set({ activo: false }).where(eq(sources.id, sourceId));
    const cuerpo = JSON.stringify(completo);
    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(404);
  });

  it("una fuente que NO es webhook (una hoja) con ese id es 404", async () => {
    const [hoja] = await db
      .insert(sources)
      .values({ programId, nombre: "Hoja", tipo: "google_sheet", sheetId: "s", tab: "t", activo: false })
      .returning();
    const cuerpo = JSON.stringify(completo);
    const res = await invocar(hoja.id, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(404);
  });

  it("Con Calendly con cita vigente: abre deal en Agendado, con su llamada, leyendo la fecha de Calendly", async () => {
    // El link de la pregunta de agenda ahora SÍ trae un uuid de invitado, así que la ruta
    // consulta Calendly (con fetch falso: cero red) y crea la llamada con la fecha real.
    const ORG = "https://api.calendly.com/organizations/ORG1";
    const EVENT = "https://api.calendly.com/scheduled_events/EV9";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const ok = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo });
        if (url.includes("/users/me")) return ok({ resource: { current_organization: ORG } });
        if (url.includes(`${EVENT}/invitees`)) {
          return ok({ collection: [{ uri: `${EVENT}/invitees/UU-9`, status: "active" }] });
        }
        if (url.includes("/scheduled_events")) {
          return ok({ collection: [{ uri: EVENT, start_time: "2026-10-05T16:00:00Z", status: "active" }] });
        }
        throw new Error(`URL inesperada: ${url}`);
      }),
    );

    const conUuid = structuredClone(completo);
    const agenda = conUuid.form_response.answers.find((a) => a.field.id === "f-agenda")!;
    agenda.url = "https://calendly.com/d/abc/entrevista/invitees/UU-9";
    const cuerpo = JSON.stringify(conUuid);

    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);

    const [lead] = await db.select().from(leads);
    expect(lead.calificacion).toBe("con_calendly");
    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("agendado");

    // La llamada de Calendly quedó colgada del deal, con la fecha real y sin closer.
    const filasCall = await db.select().from(calls).where(eq(calls.dealId, deal.id));
    expect(filasCall).toHaveLength(1);
    expect(filasCall[0].resultado).toBe("agendada");
    expect(filasCall[0].fechaAgenda?.toISOString()).toBe("2026-10-05T16:00:00.000Z");
    expect(filasCall[0].closerId).toBeNull();
    expect(filasCall[0].origen).toBe("calendly");
    expect(filasCall[0].huellaFila).toBe("calendly:UU-9");
  });

  it("Con Calendly con cita CANCELADA: el deal se abre en Calificado, sin llamada", async () => {
    const ORG = "https://api.calendly.com/organizations/ORG1";
    const EVENT = "https://api.calendly.com/scheduled_events/EV9";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const ok = (cuerpo: unknown) => ({ ok: true, status: 200, json: async () => cuerpo });
        if (url.includes("/users/me")) return ok({ resource: { current_organization: ORG } });
        if (url.includes(`${EVENT}/invitees`)) {
          return ok({ collection: [{ uri: `${EVENT}/invitees/UU-9`, status: "canceled" }] });
        }
        if (url.includes("/scheduled_events")) {
          return ok({ collection: [{ uri: EVENT, start_time: "2026-10-05T16:00:00Z", status: "active" }] });
        }
        throw new Error(`URL inesperada: ${url}`);
      }),
    );

    const conUuid = structuredClone(completo);
    const agenda = conUuid.form_response.answers.find((a) => a.field.id === "f-agenda")!;
    agenda.url = "https://calendly.com/d/abc/entrevista/invitees/UU-9";
    const cuerpo = JSON.stringify(conUuid);

    const res = await invocar(sourceId, cuerpo, firmar(cuerpo));
    expect(res.status).toBe(200);

    const [deal] = await db.select().from(deals);
    expect(deal.etapa).toBe("calificado");
    expect(await db.select().from(calls)).toHaveLength(0);
  });
});
