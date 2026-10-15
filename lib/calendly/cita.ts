/**
 * Lectura de la cita real de Calendly (ADR 0057 punto 4, ticket 109; ampliado por el
 * ticket 052 para traer tambien su estado).
 *
 * El link que Typeform guarda de la pregunta de Calendly NO trae la fecha: es
 * `https://calendly.com/d/<evento>/<nombre>/invitees/<uuid>` (verificado con datos
 * reales). La cita se lee de la API v2 de Calendly con el token del programa (un
 * token de rol `owner`, que ve las citas de todos los closers de su organizacion):
 *
 *   1. `GET /users/me` para saber la URI de la organizacion del token.
 *   2. `GET /scheduled_events?organization=...&invitee_email=...` acota primero por el
 *      correo del lead (viene en el mismo envio). Si ahi no aparece el uuid, busca entre
 *      los eventos recientes de la organizacion: el 9-oct y el 15-oct aparecieron casos
 *      donde la persona escribio un correo en el formulario y otro en Calendly. NO se
 *      filtra por estado: una cita cancelada tiene que verse (una re-agenda no debe abrir
 *      una llamada muerta).
 *   3. Por cada evento candidato, `GET <event_uri>/invitees` y se busca el invitado cuyo
 *      uuid coincide EXACTAMENTE con el del link, tambien en el fallback.
 *
 * El emparejamiento es por uuid, nunca solo por correo: un correo puede tener varias
 * citas y tomar la equivocada es invisible (ADR 0057 punto 4). Se devuelve la cita con
 * su fecha de inicio y si esta cancelada (el evento o el invitado en estado
 * `canceled`), o `null` si el uuid no aparece (la cita no se inventa). Un 401/403/5xx o
 * una respuesta con forma inesperada lanza `ErrorDeCalendly`, NUNCA un `null`
 * silencioso: un token vencido tiene que verse (ADR 0057, tercera consecuencia).
 *
 * `fetch` es inyectable para poder probar sin red. Ningun test toca la API real.
 */

/** Una cita de Calendly emparejada por uuid: su inicio y si esta cancelada. */
export interface CitaDeCalendly {
  inicio: Date;
  /** El evento o el invitado quedaron en estado `canceled`. */
  cancelada: boolean;
  /**
   * El correo de la cuenta de Calendly que hospeda la cita (`event_memberships`), para
   * saber de que closer es (ticket 096). `null` si no viene o si hay mas de un host (un
   * evento colectivo): con la duda no se inventa dueño.
   */
  correoHost: string | null;
}

/** El correo del host de un evento, solo si hay exactamente uno. */
function correoDelHost(evento: { event_memberships?: unknown }): string | null {
  const miembros = Array.isArray(evento.event_memberships) ? evento.event_memberships : [];
  const correos = new Set(
    miembros
      .map((m) => (typeof m === "object" && m !== null ? (m as { user_email?: unknown }).user_email : null))
      .filter((c): c is string => typeof c === "string" && c.includes("@"))
      .map((c) => c.trim().toLowerCase()),
  );
  return correos.size === 1 ? [...correos][0] : null;
}

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

export const BASE = "https://api.calendly.com";

export interface ParametrosCita {
  /** El token de Calendly del programa (rol owner). */
  token: string;
  /** El correo del lead, para acotar la busqueda de eventos. */
  correo: string;
  /** El uuid del invitado tomado del link (ver `uuidInvitadoDelLink`). */
  uuidInvitado: string;
  /** `fetch` inyectable; por defecto el global. */
  fetch?: FetchLike;
  /** Instante de referencia para acotar el fallback; por defecto, ahora. */
  ahora?: Date;
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
export async function coleccionCompleta(
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
export async function organizacionDelToken(fetchImpl: FetchLike, token: string): Promise<string> {
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

interface EventoCalendly {
  uri?: unknown;
  start_time?: unknown;
  created_at?: unknown;
  status?: unknown;
  event_memberships?: unknown;
}

/** Busca el uuid exacto entre los invitados de un evento y arma la cita compartida. */
async function citaDelEvento(
  fetchImpl: FetchLike,
  token: string,
  evento: EventoCalendly,
  uuidInvitado: string,
): Promise<CitaDeCalendly | null> {
  const eventUri = typeof evento.uri === "string" ? evento.uri : null;
  if (!eventUri) return null;

  const lista = await coleccionCompleta(
    fetchImpl,
    `${eventUri}/invitees?count=100`,
    token,
    "invitados",
  );

  for (const invitado of lista) {
    if (typeof invitado !== "object" || invitado === null) continue;
    const inv = invitado as { uri?: unknown; status?: unknown };
    if (uuidDeUri(inv.uri) !== uuidInvitado) continue;

    const inicio = evento.start_time;
    if (typeof inicio !== "string") {
      throw new ErrorDeCalendly("El evento de Calendly no trae fecha de inicio.");
    }
    const fecha = new Date(inicio);
    if (Number.isNaN(fecha.getTime())) {
      throw new ErrorDeCalendly(`Calendly devolvió una fecha inválida: ${inicio}.`);
    }
    // Cancelada si el evento O el invitado quedaron en `canceled`. Cualquiera de las
    // dos formas basta: un lead que reagenda cancela su invitado, y el organizador
    // que cancela la reunion marca el evento.
    const cancelada = evento.status === "canceled" || inv.status === "canceled";
    return { inicio: fecha, cancelada, correoHost: correoDelHost(evento) };
  }

  return null;
}

/** Busca con hasta cinco consultas simultaneas y no toma mas trabajo al encontrar. */
async function citaEnEventosConcurrentes(
  eventos: EventoCalendly[],
  buscar: (evento: EventoCalendly) => Promise<CitaDeCalendly | null>,
): Promise<CitaDeCalendly | null> {
  let siguiente = 0;
  let encontrada: CitaDeCalendly | null = null;

  async function trabajador(): Promise<void> {
    while (!encontrada) {
      const indice = siguiente++;
      const evento = eventos[indice];
      if (!evento) return;
      const cita = await buscar(evento);
      if (cita) encontrada = cita;
    }
  }

  await Promise.all(Array.from({ length: Math.min(5, eventos.length) }, () => trabajador()));
  return encontrada;
}

/**
 * Devuelve la cita (inicio + si esta cancelada) cuyo invitado tiene EXACTAMENTE el
 * uuid dado, o `null` si no aparece ni entre los eventos del correo ni entre los
 * eventos recientes de la organizacion. Empareja por uuid, nunca solo por correo. Un
 * fallo de la API lanza `ErrorDeCalendly`.
 */
export async function citaDeCalendly({
  token,
  correo,
  uuidInvitado,
  fetch: fetchInyectado,
  ahora = new Date(),
}: ParametrosCita): Promise<CitaDeCalendly | null> {
  const fetchImpl = fetchInyectado ?? (globalThis.fetch as unknown as FetchLike);
  if (!fetchImpl) throw new ErrorDeCalendly("No hay implementación de fetch disponible.");

  const organizacion = await organizacionDelToken(fetchImpl, token);

  const url = `${BASE}/scheduled_events?organization=${encodeURIComponent(
    organizacion,
  )}&invitee_email=${encodeURIComponent(correo)}&count=100`;
  const coleccion = await coleccionCompleta(fetchImpl, url, token, "eventos");
  const eventosEscaneados = new Set<string>();

  for (const evento of coleccion) {
    if (typeof evento !== "object" || evento === null) continue;
    const e = evento as EventoCalendly;
    const eventUri = typeof e.uri === "string" ? e.uri : null;
    if (!eventUri) continue;
    eventosEscaneados.add(eventUri);
    const cita = await citaDelEvento(fetchImpl, token, e, uuidInvitado);
    if (cita) return cita;
  }

  const dia = 24 * 60 * 60 * 1000;
  const desde = new Date(ahora.getTime() - 14 * dia);
  const hastaInicio = new Date(ahora.getTime() + 60 * dia);
  const hastaCreacion = ahora.getTime() + dia;
  const urlRecientes = `${BASE}/scheduled_events?organization=${encodeURIComponent(
    organizacion,
  )}&min_start_time=${encodeURIComponent(desde.toISOString())}&max_start_time=${encodeURIComponent(
    hastaInicio.toISOString(),
  )}&count=100`;
  const recientes = await coleccionCompleta(fetchImpl, urlRecientes, token, "eventos recientes");
  const candidatos = recientes
    .filter((evento): evento is EventoCalendly => typeof evento === "object" && evento !== null)
    .filter((evento) => typeof evento.uri === "string" && !eventosEscaneados.has(evento.uri))
    .map((evento) => ({ evento, creada: new Date(String(evento.created_at)).getTime() }))
    .filter(({ creada }) => !Number.isNaN(creada) && creada >= desde.getTime() && creada <= hastaCreacion)
    .sort((a, b) => b.creada - a.creada)
    .map(({ evento }) => evento);

  const cita = await citaEnEventosConcurrentes(candidatos.slice(0, 200), (evento) =>
    citaDelEvento(fetchImpl, token, evento, uuidInvitado),
  );
  if (cita) return cita;
  if (candidatos.length > 200) {
    throw new ErrorDeCalendly(
      "Demasiadas citas recientes para buscar la del enlace; revísala a mano.",
    );
  }
  return null;
}
