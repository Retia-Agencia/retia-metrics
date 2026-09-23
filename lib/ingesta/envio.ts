import { limpiar, normalizarEmail, parsearFecha } from "@/lib/sheets/mapeo";

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
 * ⚠️ `utm_term` y `utm_content` NO estan, a proposito (ADR 0045 enmienda 2): el estandar
 * son tres campos. Sus celdas quedan crudas en `respuestas`, sin leer.
 */
export const CAMPOS_PROMOVIDOS = [
  "token",
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
}

export interface Envio {
  sourceId: string;
  token: string;
  esParcial: boolean;
  fechaEnvio: Date | null;
  estadoHoja: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  posicionEnHoja: number | null;
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

  const promovidos = new Set(
    CAMPOS_PROMOVIDOS.map((c) => entrada.campos[c]).filter((h): h is string => h !== undefined),
  );
  const respuestas: Record<string, string | null> = {};
  for (const [encabezado, valor] of Object.entries(entrada.columnas)) {
    if (!promovidos.has(encabezado)) respuestas[encabezado] = limpiar(valor);
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
      estadoHoja: limpiar(celda("estadoHoja")),
      // Crudos: un UTM ausente es null, nunca "organico" (ADR 0004).
      utmSource: limpiar(celda("utmSource")),
      utmMedium: limpiar(celda("utmMedium")),
      utmCampaign: limpiar(celda("utmCampaign")),
      posicionEnHoja: entrada.posicion,
      respuestas,
      identidad: {
        correo: normalizarEmail(celda("correo")),
        telefono: normalizarTelefono(celda("telefono")),
      },
    },
  };
}
