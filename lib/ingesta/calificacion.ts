import { calificacionEnvioEnum } from "@/lib/db/schema";

/**
 * El Estado de llegada de un envio: sus valores, con los nombres de la hoja
 * (`descartado`, `setteo_no_calificado`, `con_calendly`).
 *
 * ⚠️ **El CRM NO califica ni calcula el Estado (ADR 0054, enmienda del 28-sep).** Lo pone
 * el FORMULARIO y `ingerirEntradas` lo guarda tal cual; `estadoDesdeTexto` en
 * `lib/ingesta/estado.ts` solo TRADUCE el texto crudo a este enum, no lo deduce de las
 * respuestas. Por eso este modulo ya no tiene logica de calificacion: la funcion que
 * calificaba un envio y su configuracion por fuente (T2/T4) se retiraron el 28-sep.
 * Quedan solo el tipo y la lista de valores, que el resto de la ingesta necesita
 * (`estado.ts`, `envio.ts`, `ingerir.ts`).
 *
 * La columna `sources.calificacion` (jsonb) y las columnas `submissions.calificacion` /
 * `submissions.puntaje` siguen en el esquema, sin uso: no se tocan aqui (ver reporte del
 * 28-sep). Si el Estado un dia lo calcula el CRM por programa (decision A8, `docs/plan.md`
 * §7), esa logica se reintroduce entonces, no antes.
 */

/** Los valores del Estado. El codigo decide con ellos (el 052 abre deals segun esto). */
export const CALIFICACIONES = calificacionEnvioEnum.enumValues;
export type Calificacion = (typeof CALIFICACIONES)[number];
