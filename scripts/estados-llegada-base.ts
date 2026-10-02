import type { EntradaEstadoLlegada } from "../lib/catalogo/estados-llegada";
import { MAPEO_FORMULARIO, type MapeoColumnas } from "../lib/sheets/mapeo";

/**
 * Lo que se siembra con el ticket 117 en cada programa, UNA vez: la usan
 * `cargar-estados-llegada.ts` y `cargar-plantillas-lead.ts` (producción) y `seed-local.ts`
 * (la base de Docker). Son filas de catálogo, no reglas: después de sembrarlas las
 * administra el gerente en `/ajustes/fuentes` (ADR 0012).
 */

/**
 * Los Estados de llegada de hoy en los dos Typeform (ADR 0061):
 *  - `setteo_no_calificado`: completó sin pasar por el Calendly → Registrado.
 *  - `con_calendly_sin_agenda`: el parcial previo al Calendly → Calificado, alta, 5 min.
 *  - `con_calendly`: lo pone el CRM cuando la pregunta de agenda trae link → Agendado.
 *  - `descartado`: mientras un formulario lo mande → Registrado (Mani, 29-sep: todo
 *    el que llena el formulario es contacto; el `lead_value` lo ordena al final).
 */
export const ESTADOS_LLEGADA_BASE: readonly Omit<EntradaEstadoLlegada, "programId">[] = [
  { valor: "setteo_no_calificado", etapaEntrada: "registrado", prioridad: "normal", alertaMinutos: null },
  { valor: "con_calendly_sin_agenda", etapaEntrada: "calificado", prioridad: "alta", alertaMinutos: 5 },
  { valor: "con_calendly", etapaEntrada: "agendado", prioridad: "normal", alertaMinutos: null },
  { valor: "descartado", etapaEntrada: "registrado", prioridad: "normal", alertaMinutos: null },
];

/**
 * La plantilla de lead (B4 del 114): qué pregunta trae el nombre, el correo y el WhatsApp.
 * Era el defecto escrito en el adaptador de Typeform. Las llaves y los patrones son los de
 * `MAPEO_FORMULARIO` (el vocabulario de `programs.plantilla_lead`), así que no cambia nada
 * en los caminos que leen una hoja y casa con los títulos de hoy ("¿Cuál es tu correo
 * electrónico?", "¿Cuál es tu número de WhatsApp?"): sin acentos ni mayúsculas, exacto
 * primero y parcial después.
 */
export const PLANTILLA_LEAD_BASE: MapeoColumnas = {
  nombre: MAPEO_FORMULARIO.nombre,
  emailNormalizado: MAPEO_FORMULARIO.emailNormalizado,
  telefono: MAPEO_FORMULARIO.telefono,
};
