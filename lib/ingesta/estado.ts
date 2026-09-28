import { CALIFICACIONES, type Calificacion } from "./calificacion";

/**
 * El Estado de llegada de un envio (ADR 0054, enmienda del 27-sep): lo pone el
 * FORMULARIO y el CRM confia en el. El CRM NO califica ni deduce nada; esta funcion
 * solo TRADUCE el texto crudo al valor del enum, no lo calcula.
 *
 * Acepta dos formas del mismo hecho, sin adivinar entre ellas:
 *
 *  - **El valor del codigo tal cual** (`descartado`, `setteo_no_calificado`,
 *    `con_calendly`): es lo que mandara el webhook de Typeform en la variable `estado`
 *    (ticket 106).
 *  - **La etiqueta exacta de la hoja**, con su emoji, que es lo que escribe hoy el Apps
 *    Script en la columna `Estado` (leido el 27-sep en `work/retia/apps-script-sheets/`):
 *    `🗑️ Descartado`, `📞 Setteo No Calificado`, `📅 Con Calendly` y su variante con un
 *    nombre entre parentesis. Lo usa el traslado desde Sheets.
 *
 * Nada de emparejamiento difuso: cualquier otro texto (o un vacio) NO se adivina, y
 * devuelve `null` con el motivo. Un valor desconocido en un envio completo es un error
 * visible (lo cuenta `ingerirEntradas` en `sinCalificar`), nunca un lead mal calificado
 * en silencio.
 */

/**
 * Las etiquetas EXACTAS que escribe el Apps Script en la columna `Estado`, por valor del
 * enum. Se comparan con el texto ya recortado (`trim`), sin normalizar acentos ni bajar
 * a minusculas: son literales copiados de la fuente (ADR 0004), no texto a interpretar.
 */
const ETIQUETAS_HOJA: Record<Calificacion, readonly string[]> = {
  descartado: ["🗑️ Descartado"],
  setteo_no_calificado: ["📞 Setteo No Calificado"],
  con_calendly: ["📅 Con Calendly", "📅 Con Calendly (Juanito)"],
};

/** Los valores del codigo, para reconocerlos tal cual los manda el webhook. */
const VALORES = new Set<string>(CALIFICACIONES);

/** Etiqueta de la hoja exacta → valor del enum, ya aplanado para buscar en O(1). */
const PORETIQUETA = new Map<string, Calificacion>(
  (Object.entries(ETIQUETAS_HOJA) as [Calificacion, readonly string[]][]).flatMap(
    ([valor, etiquetas]) => etiquetas.map((e) => [e, valor] as const),
  ),
);

export type ResultadoEstado =
  | { calificacion: Calificacion }
  /** Sin Estado reconocible. `motivo` distingue el vacio del texto ajeno, para el reporte. */
  | { calificacion: null; motivo: "sin estado" | `estado no reconocido: ${string}` };

/**
 * Traduce el texto crudo del Estado a `Calificacion | null`. `trim` de blancos y nada
 * mas: ni acentos ni mayusculas, para no confundir dos etiquetas que solo el emoji o la
 * variante entre parentesis distinguen.
 */
export function estadoDesdeTexto(crudo: string | null | undefined): ResultadoEstado {
  const texto = (crudo ?? "").trim();
  if (texto === "") return { calificacion: null, motivo: "sin estado" };
  if (VALORES.has(texto)) return { calificacion: texto as Calificacion };
  const porEtiqueta = PORETIQUETA.get(texto);
  if (porEtiqueta) return { calificacion: porEtiqueta };
  return { calificacion: null, motivo: `estado no reconocido: ${texto}` };
}
