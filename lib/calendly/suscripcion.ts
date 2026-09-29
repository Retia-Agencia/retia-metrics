import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { changeLog, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { BASE, coleccionCompleta, ErrorDeCalendly, organizacionDelToken, type FetchLike } from "./cita";
import { EVENTOS_CALENDLY } from "./evento-webhook";

/**
 * "Conectar Calendly" (ticket 096, A5): crea la suscripcion del webhook de un programa en
 * Calendly, con el token del programa (ADR 0057), y guarda la clave con la que Calendly va
 * a firmar. Los webhooks de Calendly se crean SOLO por la API y exigen plan Standard o
 * superior en la cuenta.
 *
 * Es el UNICO escritor de `programs.calendly_signing_key` (tercera excepcion nombrada de
 * secretos, AGENTS.md): no pasa por el molde, el `change_log` dice que cambio SIN el valor,
 * y ninguna lectura del catalogo la devuelve (`sinToken` en `lib/catalogo/programas.ts`).
 * `tests/calendly-suscripcion.test.ts` vigila que nadie mas la escriba.
 *
 * La clave la genera el CRM y se la manda a Calendly (`signing_key` al crear), asi que no
 * depende de leerla de la respuesta. Conectar otra vez REHACE la suscripcion: borra la que
 * apunta a la misma URL (Calendly no admite dos) y crea una nueva con clave nueva.
 *
 * `fetch` es inyectable: ningun test toca la API real.
 */

/** La ruta del webhook de Calendly de un programa. Derivada, nunca guardada (ADR 0024). */
export function rutaDelWebhookDeCalendly(programId: string): string {
  return `/api/webhooks/calendly/${programId}`;
}

/** Lo que `fetch` necesita aqui: ademas del GET de `cita.ts`, POST con cuerpo y DELETE. */
export type FetchConCuerpo = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => ReturnType<FetchLike>;

const CLAVE_OCULTA = "(oculto)";

/**
 * Conecta (o reconecta) el webhook de Calendly del programa. `urlBase` es el origen publico
 * de produccion (`AUTH_URL`): Calendly solo entrega a HTTPS.
 */
export async function conectarCalendly(
  db: Db,
  actorId: string,
  programId: string,
  opciones: { urlBase: string | undefined; fetch?: FetchConCuerpo },
): Promise<{ url: string }> {
  const base = (opciones.urlBase ?? "").trim().replace(/\/+$/, "");
  if (!base.startsWith("https://")) {
    throw new ErrorDeApp(
      "Falta la URL pública de la app (AUTH_URL con https): Calendly solo entrega a HTTPS. Conéctalo desde producción.",
      422,
    );
  }
  const [programa] = await db
    .select({ id: programs.id, nombre: programs.nombre, token: programs.calendlyToken, clave: programs.calendlySigningKey })
    .from(programs)
    .where(eq(programs.id, programId));
  if (!programa) throw new ErrorDeApp("No existe un programa con ese id.", 404);
  if (!programa.token) throw new ErrorDeApp("El programa no tiene token de Calendly: cárgalo primero.", 422);

  const url = `${base}${rutaDelWebhookDeCalendly(programa.id)}`;
  const fetchImpl = opciones.fetch ?? (globalThis.fetch as unknown as FetchConCuerpo);
  const clave = randomBytes(32).toString("hex");

  try {
    const organizacion = await organizacionDelToken(fetchImpl as FetchLike, programa.token);
    const existentes = await coleccionCompleta(
      fetchImpl as FetchLike,
      `${BASE}/webhook_subscriptions?organization=${encodeURIComponent(organizacion)}&scope=organization&count=100`,
      programa.token,
      "suscripciones",
    );
    for (const s of existentes) {
      const sub = s as { uri?: unknown; callback_url?: unknown };
      if (sub.callback_url === url && typeof sub.uri === "string") {
        await pedir(fetchImpl, sub.uri, programa.token, "DELETE");
      }
    }
    await pedir(fetchImpl, `${BASE}/webhook_subscriptions`, programa.token, "POST", {
      url,
      events: EVENTOS_CALENDLY,
      organization: organizacion,
      scope: "organization",
      signing_key: clave,
    });
  } catch (e) {
    if (e instanceof ErrorDeCalendly) throw new ErrorDeApp(e.message, 502);
    throw e;
  }

  await db.transaction(async (tx) => {
    await tx.update(programs).set({ calendlySigningKey: clave }).where(eq(programs.id, programa.id));
    await tx.insert(changeLog).values({
      tabla: "programs",
      registroId: programa.id,
      etiqueta: programa.nombre,
      campo: "calendly_signing_key",
      valorAnterior: programa.clave ? CLAVE_OCULTA : null,
      valorNuevo: CLAVE_OCULTA,
      origen: "app",
      userId: actorId,
    });
  });
  return { url };
}

/** POST o DELETE autenticado. Un rechazo sale como `ErrorDeCalendly` con un mensaje que se entiende. */
async function pedir(
  fetchImpl: FetchConCuerpo,
  url: string,
  token: string,
  method: "POST" | "DELETE",
  cuerpo?: unknown,
): Promise<void> {
  let res: Awaited<ReturnType<FetchConCuerpo>>;
  try {
    res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch (error) {
    throw new ErrorDeCalendly(`No se pudo contactar a Calendly: ${error instanceof Error ? error.message : "error de red"}.`);
  }
  if (res.ok) return;
  if (res.status === 401) throw new ErrorDeCalendly("Calendly rechazó el token (401): puede estar vencido.");
  if (res.status === 403) {
    throw new ErrorDeCalendly(
      "Calendly no dejó crear el webhook (403): la cuenta necesita plan Standard o superior y el token debe ser de un owner o admin.",
    );
  }
  throw new ErrorDeCalendly(`Calendly respondió ${res.status} al ${method === "POST" ? "crear" : "borrar"} la suscripción.`);
}
