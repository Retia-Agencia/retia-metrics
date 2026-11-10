/**
 * Lo que todavía NO tiene ficha en `./registro.ts` (ADR 0120): el trinquete del vocabulario del Hub (ticket 403).
 * `tests/registro-de-metricas.test.ts` exige que cada clave esté cubierta, que ninguna esté en el registro Y aquí,
 * y que el tope sea igual a la longitud de la lista. Migrar un concepto = escribir su ficha y BORRAR su línea (N7).
 * La tabla semanal de Pauta y los objetivos del semáforo ya no tienen pendientes: cada clave apunta a una ficha (abajo).
 */
import type { MetricaObjetivo } from "@/lib/objetivos/metricas";
import type { ClavePautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import type { ClaveDeConcepto, ClaveDeMetrica } from "@/lib/vocabulario-metricas";

export const PENDIENTES_DE_REGISTRO = [
  "deals_desde_completo", "deals_desde_parcial",
  "cupos_con_caja",
  "meta", "esperado_a_hoy", "faltan", "por_dia_habil", "proyeccion",
  "objetivo_del_dia", "objetivo_de_leads", "leads_que_hacen_falta",
  "objetivo_semana", "objetivo_mes", "objetivo_cohorte",
  "dias_del_ritmo", "citas_minimas",
] as const satisfies readonly ClaveDeMetrica[];

/** Baja cuando se migra un concepto; subirlo es una decisión que se ve en el diff. */
export const TOPE_DE_PENDIENTES = 16;

/**
 * Hacia qué concepto va cada clave de la tabla semanal de Pauta y de los objetivos del semáforo. Exhaustivas: agregar una
 * `ClavePautaSemanal` o una `MetricaObjetivo` obliga a decidir su concepto, y el test exige que esté registrado. Desde el
 * 403 F2 todas apuntan a una ficha (ya no hay pendientes propios de estos universos: el trinquete es solo el del Hub).
 */
export const CONCEPTO_DE_PAUTA_SEMANAL: Record<ClavePautaSemanal, ClaveDeConcepto> = {
  agendas: "agendadas",
  ventas: "ventas",
  facturacion: "vendido",
  show: "asistencia",
  cierre_ventas: "cierre_de_ventas",
  agenda_venta: "cita_a_venta",
  inversion: "inversion",
  costo_agenda_crm: "costo_agenda_crm",
  costo_agenda_meta: "costo_agenda_meta",
  roas: "roas",
  profit: "profit",
  cpm: "cpm",
  ctr: "ctr",
  llegada_landing: "llegada_landing",
  conversion_landing: "conversion_landing",
  frecuencia: "frecuencia",
};

export const CONCEPTO_DE_OBJETIVO: Record<MetricaObjetivo, ClaveDeConcepto> = {
  cupos: "ventas",
  agendas: "agendadas",
  conversion_agenda_venta: "cita_a_venta",
  costo_por_agenda: "costo_agenda_crm",
  roas: "roas",
  inversion: "inversion",
};
