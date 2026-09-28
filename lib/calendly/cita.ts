/**
 * Lectura de la fecha real de una cita de Calendly (ADR 0057 punto 4, ticket 109).
 *
 * El link que Typeform guarda de la pregunta de Calendly NO trae la fecha: es
 * `https://calendly.com/d/<evento>/<nombre>/invitees/<uuid>` (verificado con datos
 * reales). La fecha se lee de la API v2 de Calendly con el token del programa (un
 * token de rol `owner`, que ve las citas de todos los closers de su organizacion):
 *
 *   1. `GET /users/me` para saber la URI de la organizacion del token.
 *   2. `GET /scheduled_events?organization=...&invitee_email=...` acota por el correo
 *      del lead (viene en el mismo envio).
 *   3. Por cada evento, `GET <event_uri>/invitees` y se busca el invitado cuyo uuid
 *      coincide EXACTAMENTE con el del link.
 *
 * El emparejamiento es por uuid, nunca solo por correo: un correo puede tener varias
 * citas y tomar la equivocada es invisible (ADR 0057 punto 4). Si el uuid no aparece,
 * se devuelve `null` (la cita no se inventa). Un 401/403/5xx o una respuesta con forma
 * inesperada lanza `ErrorDeCalendly`, NUNCA un `null` silencioso: un token vencido
 * tiene que verse (ADR 0057, tercera consecuencia).
 *
 * `fetch` es inyectable para poder probar sin red. Ningun test toca la API real.
 */

/** Un fallo de la API de Calendly (token vencido, 5xx, respuesta rara). Es visible. */
export class ErrorDeCalendly extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeCalendly";
  }
}

/** La firma de `fetch` que este modulo usa (subconjunto de la global). */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const BASE = "https://api.calendly.com";

export interface ParametrosCita {
  /** El token de Calendly del programa (rol owner). */
  token: string;
  /** El correo del lead, para acotar la busqueda de eventos. */
  correo: string;
  /** El uuid del invitado tomado del link (ver `uuidInvitadoDelLink`). */
  uuidInvitado: string;
  /** `fetch` inyectable; por defecto el global. */
  fetch?: FetchLike;
}

/**
 * El uuid del invitado que lleva un link de Calendly guardado por Typeform. El link
 * tiene la forma `https://calendly.com/d/<evento>/<nombre>/invitees/<uuid>`. Devuelve
 * el uuid, o `null` si la URL no casa con ese patron (otro dominio, sin segmento
 * `invitees`, etc.).
 */
export function uuidInvitadoDelLink(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.hostname !== "calendly.com" && parsed.hostname !== "www.calendly.com") return null;
  const segmentos = parsed.pathname.split("/").filter(Boolean);
  const i = segmentos.indexOf("invitees");
  if (i === -1) return null;
  const uuid = segmentos[i + 1];
  return uuid && uuid.length > 0 ? uuid : null;
}

/** Hace un GET autenticado y devuelve el JSON, o lanza `ErrorDeCalendly` si algo falla. */
async function getJson(
  fetchImpl: FetchLike,
  url: string,
  token: string,
): Promise<Record<string, unknown>> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch (error) {
    throw new ErrorDeCalendly(
      `No se pudo consultar Calendly: ${error instanceof Error ? error.message : "error de red"}.`,
    );
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new ErrorDeCalendly(
        `Calendly rechazó el token (${res.status}): puede estar vencido o el owner salió de la organización.`,
      );
    }
    throw new ErrorDeCalendly(`Calendly respondió ${res.status}.`);
  }
  let cuerpo: unknown;
  try {
    cuerpo = await res.json();
  } catch {
    throw new ErrorDeCalendly("Calendly devolvió una respuesta que no es JSON.");
  }
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new ErrorDeCalendly("Calendly devolvió una respuesta con forma inesperada.");
  }
  return cuerpo as Record<string, unknown>;
}

/**
 * Todas las filas de una coleccion paginada de Calendly: sigue `pagination.next_page`
 * hasta el final. Sin esto, la pagina por defecto (20) cortaria la busqueda y un uuid
 * de la pagina 2 saldria como `null` silencioso.
 */
async function coleccionCompleta(
  fetchImpl: FetchLike,
  url: string,
  token: string,
  queEs: string,
): Promise<unknown[]> {
  const filas: unknown[] = [];
  let siguiente: string | null = url;
  while (siguiente) {
    const cuerpo = await getJson(fetchImpl, siguiente, token);
    if (!Array.isArray(cuerpo.collection)) {
      throw new ErrorDeCalendly(`Calendly no devolvió la lista de ${queEs}.`);
    }
    filas.push(...cuerpo.collection);
    const pag = cuerpo.pagination as { next_page?: unknown } | undefined;
    siguiente = typeof pag?.next_page === "string" && pag.next_page.length > 0 ? pag.next_page : null;
  }
  return filas;
}

/** La URI de la organizacion del token, desde `GET /users/me`. */
async function organizacionDelToken(fetchImpl: FetchLike, token: string): Promise<string> {
  const cuerpo = await getJson(fetchImpl, `${BASE}/users/me`, token);
  const recurso = cuerpo.resource as { current_organization?: unknown } | undefined;
  const org = recurso?.current_organization;
  if (typeof org !== "string" || org.length === 0) {
    throw new ErrorDeCalendly("Calendly no devolvió la organización del token.");
  }
  return org;
}

/** El uuid del invitado que trae la URI de Calendly (`.../invitees/<uuid>`). */
function uuidDeUri(uri: unknown): string | null {
  if (typeof uri !== "string") return null;
  const partes = uri.split("/").filter(Boolean);
  return partes[partes.length - 1] ?? null;
}

/**
 * Devuelve la fecha de inicio (`Date`) de la cita cuyo invitado tiene EXACTAMENTE el
 * uuid dado, o `null` si no aparece entre los eventos del correo. Empareja por uuid,
 * nunca solo por correo. Un fallo de la API lanza `ErrorDeCalendly`.
 */
export async function fechaDeCita({
  token,
  correo,
  uuidInvitado,
  fetch: fetchInyectado,
}: ParametrosCita): Promise<Date | null> {
  const fetchImpl = fetchInyectado ?? (globalThis.fetch as unknown as FetchLike);
  if (!fetchImpl) throw new ErrorDeCalendly("No hay implementación de fetch disponible.");

  const organizacion = await organizacionDelToken(fetchImpl, token);

  const url = `${BASE}/scheduled_events?organization=${encodeURIComponent(
    organizacion,
  )}&invitee_email=${encodeURIComponent(correo)}&count=100`;
  const coleccion = await coleccionCompleta(fetchImpl, url, token, "eventos");

  for (const evento of coleccion) {
    if (typeof evento !== "object" || evento === null) continue;
    const e = evento as { uri?: unknown; start_time?: unknown };
    const eventUri = typeof e.uri === "string" ? e.uri : null;
    if (!eventUri) continue;

    const lista = await coleccionCompleta(
      fetchImpl,
      `${eventUri}/invitees?count=100`,
      token,
      "invitados",
    );

    for (const invitado of lista) {
      if (typeof invitado !== "object" || invitado === null) continue;
      const inv = invitado as { uri?: unknown };
      if (uuidDeUri(inv.uri) === uuidInvitado) {
        // El invitado del uuid vive en este evento: su fecha es la del evento.
        const inicio = e.start_time;
        if (typeof inicio !== "string") {
          throw new ErrorDeCalendly("El evento de Calendly no trae fecha de inicio.");
        }
        const fecha = new Date(inicio);
        if (Number.isNaN(fecha.getTime())) {
          throw new ErrorDeCalendly(`Calendly devolvió una fecha inválida: ${inicio}.`);
        }
        return fecha;
      }
    }
  }

  // El uuid no aparece entre las citas del correo: la cita no se inventa.
  return null;
}
