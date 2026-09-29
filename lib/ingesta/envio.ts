import { limpiar, normalizarEmail, normalizarTexto, parsearFecha } from "@/lib/sheets/mapeo";
import type { Calificacion } from "./calificacion";
import { estadoDesdeTexto } from "./estado";

/**
 * El Envio (ADR 0036, tickets 048 y 049): una fila del formulario, parcial o completa,
 * normalizada. Es la UNICA puerta de la ingesta: una fila de Google Sheets hoy y un
 * payload de webhook (Dapta) manana llegan aqui con la misma forma, `EntradaEnvio`, y
 * salen como el mismo `Envio`. Si el webhook se escribiera aparte, habria dos
 * implementaciones de los centinelas y de la identidad, y divergirian en silencio
 * (la herida de los ADR 0024 y 0026).
 *
 * Esta funcion es pura: no lee ni escribe la base. La escritura por lotes es del
 * resto del 049.
 */

/**
 * Los campos que la ingesta necesita encontrar en una entrada. `correo` y `telefono`
 * son de la IDENTIDAD (ticket 050), no columnas de `submissions`: por eso no estan en
 * `CAMPOS_PROMOVIDOS` y su texto crudo se queda en `respuestas`.
 */
export type CampoEnvio =
  | "token"
  | "correo"
  | "telefono"
  | "nombre"
  | "fechaEnvio"
  | "estadoHoja"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign";

/**
 * Las columnas de `submissions` que salen de la entrada. Un campo se promueve SOLO si
 * el codigo decide, filtra, indexa o cruza con el; lo demas es contenido y va a
 * `respuestas`. Y lo promovido NO se repite adentro (opcion A' del ADR 0036).
 *
 * `nombre` se promueve (migracion 0033) porque el resumen del lead (`leads.nombre`, lo
 * que busca Personas en `lib/queries/personas.ts`) se recalcula desde los envios, y
 * `respuestas` no dice cual pregunta es la del nombre.
 *
 * ⚠️ `utm_term` y `utm_content` NO estan, a proposito (ADR 0045 enmienda 2): el estandar
 * son tres campos. Sus celdas quedan crudas en `respuestas`, sin leer.
 */
export const CAMPOS_PROMOVIDOS = [
  "token",
  "nombre",
  "fechaEnvio",
  "estadoHoja",
  "utmSource",
  "utmMedium",
  "utmCampaign",
] as const satisfies readonly CampoEnvio[];

/** Lo que entra por la puerta, venga de una hoja o de un webhook. */
export interface EntradaEnvio {
  sourceId: string;
  /** Zona en que escribe la fuente (`sources.tz_fechas`, ticket 053). */
  zona: string;
  /** Fila real de la hoja (el encabezado es la 1). Nulo para lo que no viene de una hoja. */
  posicion: number | null;
  /** Encabezado → valor crudo. Los encabezados ya vienen sin repetirse. */
  columnas: Record<string, unknown>;
  /** Que encabezado trae cada campo. El mapeo ya resuelto por el adaptador. */
  campos: Partial<Record<CampoEnvio, string>>;
  /**
   * Un webhook puede declarar el parcial explicito (Dapta manda dos eventos por lead).
   * Si no viene, se deduce de la fecha: ver `construirEnvio`.
   */
  esParcial?: boolean;
  /**
   * El link de Calendly de la pregunta de agenda, cuando el envio subio a
   * `con_calendly` (ADR 0049, ADR 0057, ticket 052). Lo pone el adaptador de webhook
   * al resolver la pregunta de agenda; sirve para leer la cita real en Calendly ANTES
   * de la transaccion de ingesta. No es una columna de `submissions` (el link crudo ya
   * queda en `respuestas`): es solo el insumo del emparejador de la cita.
   */
  linkAgenda?: string | null;
  /**
   * El SCORE que el FORMULARIO calculo (ticket 070, decision del 29-sep). Entero, o null
   * si la fuente no nombra la variable de score o si el valor no era un numero. Lo pone
   * el adaptador de webhook leyendo la variable que el mapeo nombra (`variablePuntaje`);
   * el adaptador de Sheets nunca lo trae (una hoja no calcula score). El CRM NO lo
   * calcula (decision A8): solo lo lee y lo copia a `submissions.puntaje`.
   */
  puntaje?: number | null;
  leadQuality?: string | null;
  leadValue?: string | null;
}

export interface Envio {
  sourceId: string;
  token: string;
  esParcial: boolean;
  fechaEnvio: Date | null;
  /** El nombre que la persona escribio en ESTE envio, recortado. Vacio = null. */
  nombre: string | null;
  /** El texto crudo de la columna `Estado`, tal como llego, para comparar (ADR 0054). */
  estadoHoja: string | null;
  /**
   * El Estado ya traducido al valor del enum, o `null` si el formulario no mando uno
   * reconocible. Lo pone el FORMULARIO y el CRM lo TRADUCE, no lo calcula (ADR 0054,
   * enmienda del 27-sep): sale de `estadoHoja` por `estadoDesdeTexto`, sin adivinar.
   */
  estado: Calificacion | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  posicionEnHoja: number | null;
  /**
   * El SCORE que trajo el formulario (ticket 070), tal cual, sin recalcular. Entero o
   * null. El CRM lo TRADUCE de la variable del payload, no lo calcula (decision A8): un
   * valor ausente o no numerico es null y no se adivina. Va a `submissions.puntaje` y de
   * ahi al resumen `leads.puntaje` por la misma regla del "envio que decide".
   */
  puntaje: number | null;
  leadQuality: string | null;
  leadValue: string | null;
  /** Todas las columnas NO promovidas, con el texto del encabezado como llave. */
  respuestas: Record<string, string | null>;
  /** Normalizados para decidir a que Lead pertenece (ticket 050). */
  identidad: { correo: string | null; telefono: string | null };
}

export type ResultadoEnvio =
  | { ok: true; envio: Envio }
  | { ok: false; motivo: "sin_token"; posicion: number | null };

/**
 * Menos que esto no es un telefono: es lo que una celda trae cuando no sabe ("0",
 * "-", "N/A"). Siete digitos es el fijo mas corto de Colombia. Es la pregunta de los
 * centinelas de AGENTS.md aplicada al telefono: unir leads por un "0" juntaria a
 * desconocidos sin un solo error.
 */
const DIGITOS_MINIMOS_TELEFONO = 7;

/** Solo digitos (ticket 050: se guarda y se compara en digitos, sin inventar formato). */
export function normalizarTelefono(v: unknown): string | null {
  const digitos = String(v ?? "").replace(/\D/g, "");
  return digitos.length >= DIGITOS_MINIMOS_TELEFONO ? digitos : null;
}

/**
 * Los valores CENTINELA de un UTM: texto que no es un dato sino un marcador de "sin
 * UTM" (Mani, 28-sep). Hoy solo `xxxxx`: el Forms Link de cada programa trae
 * `utm_source=xxxxx&utm_medium=xxxxx&...` como PLANTILLA para que el trafficker la
 * reemplace; si alguien comparte el link crudo, ese `xxxxx` llega tal cual. Tratarlo
 * como dato inflaria una campana inexistente y romperia el CPL sin un solo error, igual
 * que el centinela de fecha (`1/1/0001`) y el de telefono (`0`) de este repo.
 *
 * Se comparan sin mayusculas y con `trim`. Es el UNICO lugar donde un UTM se juzga
 * centinela; el resto sigue guardandose tal como llego (ADR 0004).
 */
const VALORES_CENTINELA_UTM = ["xxxxx"] as const;

/** Los encabezados (normalizados) de los UTM que se CAPTURAN pero no se promueven. */
const UTM_CAPTURADOS = new Set(["utm_term", "utm_content"]);

/**
 * Lee un UTM: lo recorta como `limpiar`, pero un valor CENTINELA (`xxxxx`) es "sin UTM"
 * y devuelve null. NO normaliza nada mas (ADR 0004: un UTM real se guarda como llego).
 */
export function limpiarUtm(v: unknown): string | null {
  const s = limpiar(v);
  if (s === null) return null;
  return VALORES_CENTINELA_UTM.includes(s.toLowerCase() as (typeof VALORES_CENTINELA_UTM)[number])
    ? null
    : s;
}

export function construirEnvio(entrada: EntradaEnvio): ResultadoEnvio {
  const celda = (campo: CampoEnvio): unknown => {
    const encabezado = entrada.campos[campo];
    return encabezado === undefined ? undefined : entrada.columnas[encabezado];
  };

  // El token es la llave del envio (`submissions_fuente_token_idx`). Sin token no se
  // inventa una: el envio se reporta rechazado con su posicion.
  const token = limpiar(celda("token"));
  if (!token) return { ok: false, motivo: "sin_token", posicion: entrada.posicion };

  const fechaEnvio = parsearFecha(celda("fechaEnvio"), entrada.zona);

  // El Estado se guarda crudo (`estadoHoja`) para comparar, y traducido (`estado`) para
  // que el codigo decida con el (el 052 abre deals). La traduccion no adivina: un texto
  // ajeno deja `estado` nulo y el envio se reporta en la ingesta.
  const estadoHoja = limpiar(celda("estadoHoja"));
  const estado = estadoDesdeTexto(estadoHoja).calificacion;

  const promovidos = new Set(
    CAMPOS_PROMOVIDOS.map((c) => entrada.campos[c]).filter((h): h is string => h !== undefined),
  );
  const respuestas: Record<string, string | null> = {};
  for (const [encabezado, valor] of Object.entries(entrada.columnas)) {
    if (promovidos.has(encabezado)) continue;
    // `utm_term` y `utm_content` se CAPTURAN en `respuestas` (no se promueven, ADR 0045),
    // pero el centinela `xxxxx` tampoco es un dato ahi: se limpia con la misma regla que
    // los tres UTM leidos, para que no quede guardado en ninguna columna.
    const esUtmCapturado = UTM_CAPTURADOS.has(normalizarTexto(encabezado));
    respuestas[encabezado] = esUtmCapturado ? limpiarUtm(valor) : limpiar(valor);
  }

  return {
    ok: true,
    envio: {
      sourceId: entrada.sourceId,
      token,
      // 🩸 Typeform escribe los parciales con la fecha placeholder `1/1/0001` (medido en
      // uno de los programas: 1.152 parciales, todos asi), y `parsearFecha` la devuelve como null.
      // Una fila completa siempre trae fecha. Supuesto a medir contra `dev` en el 049.
      esParcial: entrada.esParcial ?? fechaEnvio === null,
      fechaEnvio,
      // El nombre se recorta y un vacio es null (`limpiar`), como todo campo promovido.
      nombre: limpiar(celda("nombre")),
      estadoHoja,
      estado,
      // Crudos, pero el centinela `xxxxx` es "sin UTM" (null), no un dato (Mani,
      // 28-sep). Un UTM ausente sigue siendo null, nunca "organico" (ADR 0004).
      utmSource: limpiarUtm(celda("utmSource")),
      utmMedium: limpiarUtm(celda("utmMedium")),
      utmCampaign: limpiarUtm(celda("utmCampaign")),
      posicionEnHoja: entrada.posicion,
      // El SCORE lo pone el adaptador (webhook) o es null (hoja). Un valor no numerico ya
      // llego como null desde el adaptador: aqui no se re-juzga, se copia (decision A8).
      puntaje: entrada.puntaje ?? null,
      leadQuality: entrada.leadQuality ?? null,
      leadValue: entrada.leadValue ?? null,
      respuestas,
      identidad: {
        correo: normalizarEmail(celda("correo")),
        telefono: normalizarTelefono(celda("telefono")),
      },
    },
  };
}
