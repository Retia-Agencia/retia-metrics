import { MAPEO_FORMULARIO, type MapeoColumnas } from "../lib/sheets/mapeo";

/**
 * La plantilla de lead (B4 del 114): qué pregunta trae el nombre, el correo y el WhatsApp.
 * Era el defecto escrito en el adaptador de Typeform. Las llaves y los patrones son los de
 * `MAPEO_FORMULARIO` (el vocabulario de `programs.plantilla_lead`), así que no cambia nada
 * en los caminos que leen una hoja y casa con los títulos de hoy ("¿Cuál es tu correo
 * electrónico?", "¿Cuál es tu número de WhatsApp?"): sin acentos ni mayúsculas, exacto
 * primero y parcial después.
 *
 * La usan `cargar-plantillas-lead.ts` (producción) y `seed-local.ts` (la base de Docker).
 * Es una fila de catálogo, no una regla: después la administra el gerente (ADR 0012).
 */
export const PLANTILLA_LEAD_BASE: MapeoColumnas = {
  nombre: MAPEO_FORMULARIO.nombre,
  emailNormalizado: MAPEO_FORMULARIO.emailNormalizado,
  telefono: MAPEO_FORMULARIO.telefono,
};
