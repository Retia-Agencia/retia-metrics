import { z } from "zod";
import type { CampoEnvio, EntradaEnvio } from "./envio";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";

/**
 * El adaptador de Typeform (ticket 106, ADR 0055 punto 2): convierte un
 * `form_response` de Typeform en una `EntradaEnvio`, la MISMA forma con la que entra
 * una fila de Google Sheets (`adaptador-sheets.ts`). Todo lo que es propio del
 * PAYLOAD de Typeform vive aqui y en ningun otro lado; lo que es propio de un ENVIO
 * (los centinelas, la identidad, el dedup) vive en `construirEnvio`, que no sabe de
 * donde vino la entrada.
 *
 * Es una funcion PURA: no lee ni escribe la base. La escritura es de `ingerirEntradas`.
 *
 * El programa NO sale de aqui: sale de la FUENTE registrada en la URL (ADR 0055 punto
 * 1). Este adaptador solo traduce el contenido de un formulario; quien decide a que
 * programa pertenece es la ruta, con el `sourceId` de la fuente.
 */

// ─────────────────────────────────────────────── el payload de Typeform

/**
 * Lo que este adaptador NECESITA de un `form_response`. Es un subconjunto laxo del
 * payload real de Typeform: se validan las piezas que se leen y se ignora el resto
 * (`landed_at`, `definition.settings`, etc.), porque un campo nuevo del proveedor no
 * debe romper la ingesta.
 *
 * Las respuestas se emparejan con su pregunta por el `field.id`: `definition.fields`
 * da el TITULO de cada pregunta y `answers` da la respuesta. La llave de una respuesta
 * es el titulo de la pregunta, igual que un encabezado de columna en la hoja.
 */
const campoDefinicion = z.object({
  id: z.string(),
  title: z.string(),
});

const respuestaSchema = z
  .object({
    field: z.object({ id: z.string() }),
    type: z.string(),
    // Solo una de estas viene por respuesta, segun el tipo. Todas opcionales.
    text: z.string().optional(),
    email: z.string().optional(),
    phone_number: z.string().optional(),
    number: z.number().optional(),
    boolean: z.boolean().optional(),
    url: z.string().optional(),
    date: z.string().optional(),
    choice: z.object({ label: z.string().optional(), other: z.string().optional() }).optional(),
    choices: z.object({ labels: z.array(z.string()).optional() }).optional(),
    file_url: z.string().optional(),
  })
  .passthrough();

const variableSchema = z
  .object({
    key: z.string(),
    type: z.string(),
    text: z.string().optional(),
    number: z.number().optional(),
  })
  .passthrough();

const formResponseSchema = z
  .object({
    token: z.string(),
    submitted_at: z.string().optional(),
    hidden: z.record(z.string(), z.string()).optional(),
    definition: z.object({ fields: z.array(campoDefinicion).default([]) }).optional(),
    answers: z.array(respuestaSchema).nullish(),
    variables: z.array(variableSchema).optional(),
  })
  .passthrough();

/**
 * El sobre del webhook de Typeform. `event_type` distingue el envio completo del
 * parcial (Typeform manda `form_response_partial` cuando se configura un *partial
 * submission point*, ADR 0055 punto 4). Se acepta cualquier `event_type` y la
 * parcialidad se decide con el, sin exigir un valor fijo.
 */
export const payloadTypeformSchema = z
  .object({
    event_type: z.string().optional(),
    form_response: formResponseSchema,
  })
  .passthrough();

export type PayloadTypeform = z.infer<typeof payloadTypeformSchema>;

/**
 * Los `event_type` con los que Typeform anuncia un PARCIAL. El completo es
 * `form_response`; el parcial, `form_response_partial` (nombre del *partial submission
 * point*). Cualquier otro valor se trata como completo, que es lo conservador: un
 * envio marcado parcial por error nunca abre deal, pero uno completo si.
 */
const EVENTOS_PARCIALES = new Set(["form_response_partial", "form_response_incomplete"]);

// ─────────────────────────────────────────────── el mapeo por fuente

/**
 * El mapeo de una fuente webhook dice que TITULO de pregunta alimenta que campo del
 * Envio, igual que el mapeo de columnas de una hoja (ADR 0055 punto 2). Reusa
 * `sources.mapeoColumnas`, asi que las llaves son las de `CampoEnvio` y el valor es
 * un titulo (o una lista de titulos alternativos).
 *
 * `campoAgenda` NO es un `CampoEnvio`: es el TITULO de la pregunta cuya respuesta el
 * adaptador mira para el hecho de "agendo" (ADR 0054, segunda enmienda). Vive en el
 * mapeo (`sources.mapeoColumnas.agenda`), no en el codigo, porque cual pregunta es la
 * de agenda es una decision de CONFIGURACION (ADR 0012), no una heuristica. Sin este
 * titulo mapeado, el adaptador nunca sube un envio a `con_calendly`.
 */
export interface MapeoWebhook {
  campos?: Partial<Record<CampoEnvio, string | string[]>>;
  /**
   * Titulo de la pregunta de agenda (Calendly), de `sources.mapeoColumnas.agenda`. Si
   * falta, el envio NUNCA sube a `con_calendly`: cual pregunta es la de agenda lo dice
   * el mapeo, no el contenido de las respuestas.
   */
  campoAgenda?: string;
  /**
   * NOMBRE de la variable de Typeform que alimenta el Estado (punto E, ADR 0012). Es
   * CONFIGURACION, no codigo: cual variable clasifica al lead lo decide el mapeo, con
   * defecto `estado`. Sale de `sources.mapeoColumnas.estadoHoja`. El adaptador captura
   * TODAS las variables por igual; esta solo dice cual de ellas es el Estado.
   */
  variableEstado?: string;
  /**
   * NOMBRE de la variable de Typeform que trae el SCORE del formulario (ticket 070,
   * decision del 29-sep; mismo molde que `variableEstado`, ADR 0012). El CRM NO calcula
   * el puntaje (decision A8): Typeform lo calcula con sus pesos por respuesta y lo manda
   * como una variable. Sale de `sources.mapeoColumnas.puntaje`.
   *
   * **No hay defecto** a proposito, y es la diferencia con `variableEstado`: si el mapeo
   * no nombra la variable, `puntaje` queda null. Un nombre fijo en el codigo obligaria a
   * que cada Typeform llamara igual a su variable de score, o el CRM leeria una variable
   * ajena como puntaje sin un solo error. El Setteo sin score se ordena por recencia.
   */
  variablePuntaje?: string;
  /** Nombre configurable de la variable Typeform con la etiqueta de calidad. */
  variableLeadQuality?: string;
  /** Nombre configurable de la variable Typeform con la etiqueta de valor. */
  variableLeadValue?: string;
}

/** El nombre por defecto de la variable de Estado, si el mapeo no dice otra (punto E). */
export const VARIABLE_ESTADO_POR_DEFECTO = "estado";

/**
 * El prefijo reservado con el que una VARIABLE de Typeform entra a las columnas del
 * envio (punto E). Resuelve el choque de llaves entre una variable, un hidden y un
 * titulo de pregunta con el mismo nombre: cada namespace es distinto, asi que
 * `segmento` (hidden), `Segmento` (titulo) y `variable:segmento` (variable) conviven
 * sin pisarse. Se eligio un PREFIJO y no el sufijo `(2)` de los titulos repetidos
 * porque el sufijo solo desambigua por orden de insercion —fragil y sin decir cual
 * valor es la variable—; el prefijo es determinista y se autodescribe en `respuestas`
 * (un lector ve `variable:score` y sabe que es una variable, no una pregunta).
 */
export const PREFIJO_VARIABLE = "variable:";

export interface OpcionesTypeform {
  sourceId: string;
  /** `sources.tz_fechas` (ticket 053). No lo usa el adaptador salvo pasarlo al Envio. */
  zona: string;
  /** El mapeo de preguntas de la fuente (`sources.mapeoColumnas` + `campoAgenda`). */
  mapeo?: MapeoWebhook;
}

/**
 * Los campos que este adaptador sabe resolver por defecto, por si el mapeo de la fuente
 * no los nombra. Son los titulos de pregunta de los Typeform de hoy (mismos que el
 * adaptador de Sheets, ADR 0019). El mapeo de la fuente los sobreescribe.
 */
const MAPEO_POR_DEFECTO: Partial<Record<CampoEnvio, string[]>> = {
  nombre: ["nombre completo", "nombre"],
  correo: ["correo electronico", "correo", "email"],
  telefono: ["whatsapp", "telefono", "celular"],
};

// ─────────────────────────────────────────────── el agendo (ADR 0054)

/** Un link de Calendly es cualquier texto que contenga este dominio. */
const DOMINIO_CALENDLY = "calendly.com";

/**
 * ¿La respuesta de agenda trae un link de Calendly? Es exactamente lo que hace hoy el
 * Apps Script de la hoja: `cal.toLowerCase().includes("calendly")` (ADR 0054, segunda
 * enmienda). No interpreta la URL, solo busca el dominio.
 */
export function traeLinkDeCalendly(valor: string | null | undefined): boolean {
  return (valor ?? "").toLowerCase().includes(DOMINIO_CALENDLY);
}

/**
 * El Estado final de un envio de Typeform (ADR 0054, segunda enmienda). Funcion PURA
 * con su test por fila (ticket 106).
 *
 * Typeform manda en la variable `estado` solo `descartado` o `setteo_no_calificado`,
 * porque no deja poner una condicion sobre la pregunta de Calendly. El hecho de
 * "agendo" lo lee el CRM del envio: si el Estado es `setteo_no_calificado` y la
 * respuesta de la pregunta de agenda trae un link de Calendly, sube a `con_calendly`.
 * `descartado` NUNCA sube: es un descarte del formulario, no un lead que agendo.
 *
 * **Cual es la pregunta de agenda lo dice el mapeo de la fuente (ADR 0012), no una
 * heuristica sobre las respuestas** (correccion del 28-sep). `campoAgenda` es el titulo
 * de esa pregunta, ya resuelto desde `sources.mapeoColumnas.agenda`. Si la fuente NO
 * tiene `agenda` mapeada (`campoAgenda` indefinido), o el envio no trajo esa pregunta,
 * el Estado se queda como estaba: nunca sube a `con_calendly`. Adivinar cual respuesta
 * es la de agenda por su contenido mandaria un lead a `con_calendly` por un `calendly.com`
 * que cayera en cualquier otro campo, sin un solo error.
 */
export function estadoConAgenda(
  estadoBase: string | null,
  respuestas: Record<string, string | null>,
  campoAgenda?: string,
): string | null {
  if (estadoBase !== "setteo_no_calificado") return estadoBase;
  if (!campoAgenda) return estadoBase;

  return traeLinkDeCalendly(respuestas[campoAgenda]) ? "con_calendly" : estadoBase;
}

// ─────────────────────────────────────────────── el adaptador

/** El texto de una respuesta de Typeform, sea cual sea su tipo. */
function textoDeRespuesta(a: z.infer<typeof respuestaSchema>): string | null {
  if (a.type === "email" && a.email !== undefined) return a.email;
  if (a.type === "phone_number" && a.phone_number !== undefined) return a.phone_number;
  if (a.type === "url" && a.url !== undefined) return a.url;
  if (a.type === "number" && a.number !== undefined) return String(a.number);
  if (a.type === "boolean" && a.boolean !== undefined) return a.boolean ? "true" : "false";
  if (a.type === "date" && a.date !== undefined) return a.date;
  if (a.type === "choice") return a.choice?.label ?? a.choice?.other ?? null;
  if (a.type === "choices") return a.choices?.labels?.join(", ") ?? null;
  if (a.type === "file_url" && a.file_url !== undefined) return a.file_url;
  if (a.text !== undefined) return a.text;
  // Cualquier tipo nuevo del proveedor: se toma el primer string presente sin romper.
  const primerTexto = [a.email, a.phone_number, a.url, a.file_url].find((v) => typeof v === "string");
  return primerTexto ?? null;
}

/**
 * Convierte un `form_response` de Typeform en una `EntradaEnvio`.
 *
 * - **Respuestas por pregunta:** la llave es el TITULO de la pregunta
 *   (`definition.fields[].title`), emparejado con `answers[]` por `field.id`. Es el
 *   equivalente del encabezado de columna de una hoja.
 * - **Campos ocultos:** `hidden` trae los UTM (`utm_source`, etc.), que se mezclan con
 *   las respuestas como si fueran columnas: el mapeo de UTM del Envio los encuentra.
 * - **La variable `estado`** (ADR 0054) va a `estadoHoja`, el campo que `estado.ts`
 *   traduce. Antes se le aplica el hecho de "agendo" (ADR 0054, segunda enmienda).
 * - **El token** del envio es `form_response.token`.
 * - **Parcial:** lo dice el `event_type` del sobre (`form_response_partial`).
 *
 * `posicion` es null: un webhook no tiene fila de hoja. El orden de versiones de un
 * mismo token lo decide entonces el orden de llegada, no la posicion (ver
 * `ingerirEntradas`).
 */
export function entradaDesdeTypeform(payload: PayloadTypeform, opciones: OpcionesTypeform): EntradaEnvio {
  const fr = payload.form_response;

  // Titulo de pregunta por id, para nombrar cada respuesta.
  const tituloPorId = new Map<string, string>();
  for (const campo of fr.definition?.fields ?? []) tituloPorId.set(campo.id, campo.title);

  // Las respuestas, con el titulo de la pregunta como llave (el equivalente del
  // encabezado). Dos preguntas con el mismo titulo: la segunda no pisa a la primera en
  // silencio, se le agrega un sufijo, igual que `llavesUnicas` en el adaptador de hoja.
  const columnas: Record<string, unknown> = {};
  const vistos = new Map<string, number>();
  for (const a of fr.answers ?? []) {
    const base = tituloPorId.get(a.field.id) ?? `(pregunta ${a.field.id})`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    const llave = n === 1 ? base : `${base} (${n})`;
    columnas[llave] = textoDeRespuesta(a);
  }

  // Los campos ocultos (UTM) entran como columnas mas: el mapeo de UTM del Envio los
  // busca por su nombre (`utm_source`, etc.), igual que en la hoja.
  for (const [llave, valor] of Object.entries(fr.hidden ?? {})) columnas[llave] = valor;

  // Las VARIABLES entran TODAS como columnas, con el prefijo reservado `variable:`
  // (punto E): una variable nueva aparece sola en `respuestas` y una que se quita deja
  // de llegar, sin tocar codigo. El prefijo evita el choque de llaves con un hidden o un
  // titulo de pregunta del mismo nombre. Texto o numero; cualquier otro tipo se ignora
  // (no hay valor legible que guardar).
  for (const v of fr.variables ?? []) {
    const valor = v.text ?? (v.number !== undefined ? String(v.number) : undefined);
    if (valor !== undefined) columnas[`${PREFIJO_VARIABLE}${v.key}`] = valor;
  }

  // Cual variable alimenta el Estado es CONFIGURACION (punto E, ADR 0012): el mapeo lo
  // dice, con defecto `estado`. Se apunta el campo `estadoHoja` a la columna de esa
  // variable (`variable:<nombre>`), igual que la fecha y el token apuntan a columnas
  // reservadas. Asi el Estado sale del MISMO mecanismo generico que todo lo demas.
  const nombreVariableEstado = opciones.mapeo?.variableEstado ?? VARIABLE_ESTADO_POR_DEFECTO;
  const columnaEstado = `${PREFIJO_VARIABLE}${nombreVariableEstado}`;

  // El SCORE del formulario (ticket 070). Igual que el Estado, es una VARIABLE que el
  // mapeo nombra (`variablePuntaje`), pero SIN defecto: si el mapeo no la nombra, no hay
  // puntaje. Su valor ya entro a `columnas` como `variable:<nombre>` (todas las variables
  // se capturan arriba); aqui solo se lee y se convierte a entero. Un valor que no es un
  // numero finito no se adivina: queda null (decision del 29-sep, "no se le inventa uno").
  const puntaje =
    opciones.mapeo?.variablePuntaje !== undefined
      ? aEnteroONull(columnas[`${PREFIJO_VARIABLE}${opciones.mapeo.variablePuntaje}`])
      : null;
  const textoVariable = (nombre: string | undefined): string | null =>
    nombre === undefined ? null : (() => {
      const valor = columnas[`${PREFIJO_VARIABLE}${nombre}`];
      const texto = valor == null ? "" : String(valor).trim();
      return texto === "" ? null : texto;
    })();
  const leadQuality = textoVariable(opciones.mapeo?.variableLeadQuality);
  const leadValue = textoVariable(opciones.mapeo?.variableLeadValue);

  // El mapeo de campos: el de la fuente sobre el de por defecto. Los UTM y la fecha
  // no van en el mapeo de preguntas porque salen de sitios fijos del payload (hidden y
  // submitted_at): se ponen como columnas con su nombre estandar y el mapeo los apunta.
  const mapeo: Partial<Record<CampoEnvio, string | string[]>> = {
    ...MAPEO_POR_DEFECTO,
    utmSource: "utm_source",
    utmMedium: "utm_medium",
    utmCampaign: "utm_campaign",
    utmId: "utm_id",
    utmContent: "utm_content",
    utmTerm: "utm_term",
    fechaEnvio: "__submitted_at",
    token: "__token",
    estadoHoja: "__estado",
    ...opciones.mapeo?.campos,
  };

  // La fecha, el token y el estado no son respuestas del usuario: viven en el sobre.
  // Se ponen como columnas con una llave reservada (con `__`, que ningun titulo de
  // Typeform usa) y el mapeo los apunta. El parcial de Typeform no trae `submitted_at`,
  // asi que la fecha queda vacia y `construirEnvio` la lee como null (el placeholder
  // del que el repo ya sangro no llega por webhook).
  columnas["__submitted_at"] = fr.submitted_at ?? "";
  columnas["__token"] = fr.token;

  // El Estado: la variable configurada (via su columna `variable:<nombre>`), mas el
  // hecho de agendar (ADR 0054, segunda enmienda). El texto crudo que queda en
  // `estadoHoja` es el valor del codigo (`descartado`, `setteo_no_calificado`,
  // `con_calendly`), que `estadoDesdeTexto` reconoce tal cual. Si la variable no vino,
  // `columnas[columnaEstado]` es undefined y el Estado queda vacio: entra sin Estado.
  //
  // La pregunta de agenda la dice el mapeo de la fuente (`campoAgenda`), no una
  // heuristica sobre las respuestas (ADR 0012). El titulo mapeado se resuelve contra
  // las columnas reales (insensible a acentos/mayusculas) para que "Agenda aqui tu
  // entrevista" case aunque el mapeo lo escriba distinto. Sin `campoAgenda`, o si esa
  // pregunta no vino en el envio, el Estado no sube a `con_calendly`.
  const valorEstado = columnas[columnaEstado];
  const estadoBase = valorEstado === undefined || valorEstado === null ? null : String(valorEstado);
  const respuestasParaAgenda: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(columnas)) respuestasParaAgenda[k] = v === null || v === undefined ? null : String(v);
  const columnaAgenda = opciones.mapeo?.campoAgenda
    ? resolverContra(Object.keys(columnas), [opciones.mapeo.campoAgenda])
    : undefined;
  const estadoFinal = estadoConAgenda(estadoBase, respuestasParaAgenda, columnaAgenda) ?? "";
  columnas["__estado"] = estadoFinal;

  // Cuando el envio subio a `con_calendly`, el link de la pregunta de agenda es el
  // insumo para leer la cita real en Calendly (ADR 0057, ticket 052). Se lleva aparte
  // en la entrada, no como columna: el link crudo ya queda en `respuestas`.
  const linkAgenda =
    estadoFinal === "con_calendly" && columnaAgenda ? respuestasParaAgenda[columnaAgenda] : null;

  const esParcial = EVENTOS_PARCIALES.has(payload.event_type ?? "");

  // El mapeo se guarda como `MapeoColumnas` (record de campo → patron), la forma que
  // `construirEnvio` espera en `campos`. Aqui las llaves ya son los nombres exactos de
  // las columnas que se acaban de poner, asi que se pasa directo como resuelto.
  const campos: Partial<Record<CampoEnvio, string>> = {};
  for (const [campo, patron] of Object.entries(mapeo)) {
    const buscados = Array.isArray(patron) ? patron : [patron];
    // Se resuelve por coincidencia insensible a acentos/mayusculas contra las columnas
    // reales, para que "Correo" case con "correo electronico" como en la hoja.
    const encontrado = resolverContra(Object.keys(columnas), buscados);
    if (encontrado !== undefined) campos[campo as CampoEnvio] = encontrado;
  }

  return {
    sourceId: opciones.sourceId,
    zona: opciones.zona,
    posicion: null,
    columnas,
    campos,
    esParcial,
    linkAgenda,
    puntaje,
    leadQuality,
    leadValue,
  };
}

/**
 * Convierte el valor de la variable de score a un entero, o null. El adaptador guarda
 * las variables como texto en `columnas` (`String(v.number)` o `v.text`), asi que aqui
 * se re-parsea. **Un valor que no es un numero finito se descarta a null, nunca se
 * adivina** (decision del 29-sep). Se redondea a entero porque `submissions.puntaje` es
 * `integer`; un score con decimales pierde la fraccion, no falla la ingesta.
 */
function aEnteroONull(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = Number(String(valor).trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** El mapeo laxo para reusar el resolvedor de la hoja si hiciera falta en el futuro. */
export type MapeoWebhookColumnas = MapeoColumnas;

/**
 * Encuentra en `columnas` la primera que case con alguno de los patrones, exacto
 * primero y parcial despues, sin acentos ni mayusculas. Es el mismo criterio de
 * `resolverColumnas` de la hoja, reducido a lo que el adaptador necesita: emparejar el
 * titulo de una pregunta con su nombre real. Lo usa tambien "buscar llamada" (096) para
 * encontrar la pregunta de agenda en un envio ya guardado, con el mismo criterio.
 */
export function resolverContra(columnas: string[], patrones: string[]): string | undefined {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normalizadas = columnas.map((c) => ({ real: c, n: norm(c) }));
  const buscados = patrones.map(norm);
  for (const b of buscados) {
    const exacto = normalizadas.find((c) => c.n === b);
    if (exacto) return exacto.real;
  }
  for (const b of buscados) {
    const parcial = normalizadas.find((c) => c.n.includes(b));
    if (parcial) return parcial.real;
  }
  return undefined;
}
