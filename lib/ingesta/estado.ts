import type { Calificacion } from "./calificacion";

/**
 * El Estado de llegada de un envio, desde su texto crudo (ADR 0061). Lo pone el
 * FORMULARIO y el CRM confia en el: esta funcion solo lo LIMPIA, no lo califica ni lo
 * valida. Si el envio abre deal y en que etapa lo decide `etapaDeEntrada`
 * (`lib/ingesta/etapa-de-entrada.ts`, ADR 0069); la tabla `estados_llegada` se borro en la 0059.
 *
 * Acepta dos formas del mismo hecho, sin adivinar entre ellas:
 *
 *  - **El valor tal cual** lo manda la variable `estado` del webhook (`setteo_no_calificado`,
 *    `con_calendly_sin_agenda`, o cualquier valor nuevo): se guarda recortado, nada mas.
 *  - **La etiqueta exacta de la hoja**, con su emoji, que escribia el Apps Script en la
 *    columna `Estado` (`🗑️ Descartado`, `📞 Setteo No Calificado`, `📅 Con Calendly` y su
 *    variante con un nombre entre parentesis). La usan el traslado y la migracion desde
 *    Sheets (etapa 7), que leen una hoja una vez; se traduce al valor que hoy manda el
 *    formulario para que los dos caminos hablen igual.
 *
 * Un vacio es `null` con motivo "sin estado". Nada de emparejamiento difuso: fuera de las
 * etiquetas de la hoja, el texto no se reescribe (ADR 0004).
 */

/**
 * Las etiquetas EXACTAS del Apps Script de la hoja y el valor del formulario que
 * representan. Se comparan con el texto recortado, sin normalizar acentos ni mayusculas:
 * son literales copiados de la fuente (ADR 0004), vocabulario del traslado, no reglas.
 */
const ETIQUETAS_HOJA: ReadonlyMap<string, Calificacion> = new Map([
  ["🗑️ Descartado", "descartado"],
  ["📞 Setteo No Calificado", "setteo_no_calificado"],
  ["📅 Con Calendly", "con_calendly"],
  ["📅 Con Calendly (Juanito)", "con_calendly"],
]);

export type ResultadoEstado =
  | { calificacion: Calificacion }
  | { calificacion: null; motivo: "sin estado" };

/** Recorta el texto crudo del Estado y traduce una etiqueta de la hoja. Vacio = sin estado. */
export function estadoDesdeTexto(crudo: string | null | undefined): ResultadoEstado {
  const texto = (crudo ?? "").trim();
  if (texto === "") return { calificacion: null, motivo: "sin estado" };
  return { calificacion: ETIQUETAS_HOJA.get(texto) ?? texto };
}
