/**
 * Los conceptos de `lib/vocabulario-metricas.ts` que todavía NO tienen ficha en `./registro.ts` (ADR 0120).
 * Es un trinquete: `tests/registro-de-metricas.test.ts` exige que cada clave esté en el registro O aquí, nunca
 * en los dos, y que `TOPE_DE_PENDIENTES` sea igual a la longitud de la lista. Agregar una clave nueva al
 * vocabulario sin ficha obliga a subir el tope a la vista de todos; migrar un concepto obliga a bajarlo.
 * Migrar un concepto = escribir su ficha y BORRAR su línea de aquí (N7).
 *
 * Los de show, cita sin resultado y agenda esperan al ticket 353; los de Pauta, al 355.
 */
import type { ClaveDeMetrica } from "@/lib/vocabulario-metricas";

export const PENDIENTES_DE_REGISTRO = [
  "deals_desde_completo", "deals_desde_parcial",
  "cupos_con_caja", "nacio_agenda_del_dia", "nacio_seguimiento", "nacio_sin_llamada",
  "meta", "esperado_a_hoy", "faltan", "por_dia_habil", "proyeccion",
  "objetivo_del_dia", "objetivo_de_leads", "leads_que_hacen_falta",
  "citas_del_dia", "citas_realizadas", "citas_canceladas",
  "objetivo_semana", "objetivo_mes", "objetivo_cohorte",
  "dias_del_ritmo", "citas_minimas",
] as const satisfies readonly ClaveDeMetrica[];

/** Baja cuando se migra un concepto; subirlo es una decisión que se ve en el diff. */
export const TOPE_DE_PENDIENTES = 22;
