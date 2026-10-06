/**
 * El Insights de un formulario de Typeform (ticket 126 parte B): por pregunta, cuantos la
 * vieron y cuantos se fueron ahi. Lo que pidio Pauta para mejorar el formulario.
 *
 * Medido el 6-oct contra la API real (`GET /insights/{form}/summary`):
 *
 *  - Es AGREGADO y sin canal, y **no acepta rango de fechas**: `since`/`until`, `from`/`to`
 *    y `date_from` devuelven lo mismo que sin parametros. Es el historico acumulado del
 *    formulario, y la pantalla lo dice; no se cruza con el periodo del dashboard.
 *  - `fields` viene en el orden del formulario, cada uno con `views` y `dropoffs`.
 *  - `form.summary` trae `unique_visits` y `responses_count`.
 *
 * No se guarda nada (126: "en vivo, sin guardar"). Un 401/403/5xx o una respuesta con forma
 * inesperada lanza `ErrorDeTypeform`, nunca un embudo vacio: un token vencido tiene que
 * verse, igual que en Calendly (ADR 0057). `fetch` es inyectable; ningun test toca la API.
 */

export interface PreguntaDelInsights {
  id: string;
  titulo: string;
  tipo: string;
  vistas: number;
  abandonos: number;
}

export interface InsightsDelFormulario {
  formId: string;
  visitasUnicas: number;
  respuestas: number;
  /** En el orden del formulario. */
  preguntas: PreguntaDelInsights[];
}

/** Un fallo de la API de Typeform (token vencido, 5xx, respuesta rara). Es visible. */
export class ErrorDeTypeform extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeTypeform";
  }
}

/** La firma de `fetch` que este modulo usa (subconjunto de la global). */
export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; cache?: "no-store"; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const BASE = "https://api.typeform.com";

/**
 * El id del formulario sale de su URL publica (`https://<cuenta>.typeform.com/to/<id>`), que
 * la fuente ya guarda para los links de captacion (ADR 0068). Sin URL o con otra forma no
 * hay id: no se adivina.
 */
export function formIdDeTypeform(urlPublica: string | null | undefined): string | null {
  if (!urlPublica) return null;
  let url: URL;
  try {
    url = new URL(urlPublica);
  } catch {
    return null;
  }
  if (!/(^|\.)typeform\.com$/i.test(url.hostname)) return null;
  const m = url.pathname.match(/^\/to\/([A-Za-z0-9]+)\/?$/);
  return m ? m[1] : null;
}

function entero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? Math.round(valor) : null;
}

/** Valida la respuesta del summary. Una forma inesperada lanza: no se pinta un embudo inventado. */
export function interpretarInsights(formId: string, json: unknown): InsightsDelFormulario {
  const raiz = (typeof json === "object" && json !== null ? json : {}) as {
    form?: { summary?: { unique_visits?: unknown; responses_count?: unknown } };
    fields?: unknown;
  };
  const visitasUnicas = entero(raiz.form?.summary?.unique_visits);
  const respuestas = entero(raiz.form?.summary?.responses_count);
  if (visitasUnicas === null || respuestas === null || !Array.isArray(raiz.fields)) {
    throw new ErrorDeTypeform("Typeform devolvió el Insights con una forma inesperada.");
  }
  const preguntas = raiz.fields.map((campo): PreguntaDelInsights => {
    const c = (typeof campo === "object" && campo !== null ? campo : {}) as Record<string, unknown>;
    const vistas = entero(c.views);
    const abandonos = entero(c.dropoffs);
    if (typeof c.id !== "string" || vistas === null || abandonos === null) {
      throw new ErrorDeTypeform("Typeform devolvió una pregunta del Insights con una forma inesperada.");
    }
    return {
      id: c.id,
      titulo: typeof c.title === "string" ? c.title : "(sin título)",
      tipo: typeof c.type === "string" ? c.type : "",
      vistas,
      abandonos,
    };
  });
  return { formId, visitasUnicas, respuestas, preguntas };
}

/** Lee el summary del Insights de un formulario con el token de su cuenta. */
export async function leerInsights({
  token,
  formId,
  fetch: f = globalThis.fetch as unknown as FetchLike,
}: {
  token: string;
  formId: string;
  fetch?: FetchLike;
}): Promise<InsightsDelFormulario> {
  let respuesta: Awaited<ReturnType<FetchLike>>;
  try {
    respuesta = await f(`${BASE}/insights/${encodeURIComponent(formId)}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ErrorDeTypeform("No se pudo contactar a Typeform.");
  }
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new ErrorDeTypeform("Typeform rechazó el token (vencido o sin acceso a este formulario).");
  }
  if (respuesta.status === 404) throw new ErrorDeTypeform("Typeform no encuentra ese formulario.");
  if (!respuesta.ok) throw new ErrorDeTypeform(`Typeform respondió ${respuesta.status}.`);
  return interpretarInsights(formId, await respuesta.json());
}
