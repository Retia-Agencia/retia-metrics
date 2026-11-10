/**
 * Lo que todavía NO tiene ficha en `./registro.ts` (ADR 0120), en los TRES universos de métricas que vigila el
 * trinquete (ticket 403 F2): el vocabulario del Hub, la tabla semanal de Pauta y los objetivos del semáforo.
 * `tests/registro-de-metricas.test.ts` exige que cada clave de cada universo esté cubierta, que ninguna esté en
 * el registro Y en los pendientes, y que cada tope sea igual a la longitud de su lista. Agregar una clave sin
 * ficha obliga a subir el tope a la vista de todos; migrar un concepto obliga a bajarlo.
 * Migrar un concepto = escribir su ficha y BORRAR su línea de aquí (N7).
 *
 * Las claves de Pauta y de objetivos que miden un concepto del Hub apuntan a su clave (no tienen ficha propia: la
 * ficha es la del concepto, y si ese está pendiente cuenta en el tope del Hub). `"pendiente"` es un concepto propio
 * de ese universo que aún no tiene función única ni ficha; `"retirar"` es un objetivo sin lector.
 */
import type { MetricaObjetivo } from "@/lib/objetivos/metricas";
import type { ClavePautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import type { ClaveDeMetrica } from "@/lib/vocabulario-metricas";

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

export type DestinoDeUnaClave = ClaveDeMetrica | "pendiente" | "retirar";

/** Tabla semanal de Pauta (412): exhaustiva, agregar una `ClavePautaSemanal` obliga a decidir su destino. */
export const CONCEPTO_DE_PAUTA_SEMANAL: Record<ClavePautaSemanal, DestinoDeUnaClave> = {
  agendas: "agendadas",
  ventas: "ventas",
  facturacion: "vendido",
  show: "asistencia",
  cierre_ventas: "cierre_de_ventas",
  agenda_venta: "cita_a_venta",
  inversion: "pendiente",
  costo_agenda_crm: "pendiente",
  costo_agenda_meta: "pendiente",
  roas: "pendiente",
  profit: "pendiente",
  cpm: "pendiente",
  ctr: "pendiente",
  llegada_landing: "pendiente",
  conversion_landing: "pendiente",
  frecuencia: "pendiente",
};
export const TOPE_PENDIENTES_DE_PAUTA_SEMANAL = 10;

/** Objetivos del semáforo (`METRICAS_OBJETIVO`): exhaustiva. Los tres `retirar` esperan la migración que recrea el enum. */
export const CONCEPTO_DE_OBJETIVO: Record<MetricaObjetivo, DestinoDeUnaClave> = {
  cupos: "ventas",
  agendas: "agendadas",
  conversion_agenda_venta: "cita_a_venta",
  costo_por_agenda: "pendiente",
  roas: "pendiente",
  inversion: "pendiente",
  agendas_por_dia: "retirar",
  costo_por_lead: "retirar",
  costo_por_venta: "retirar",
};
export const TOPE_PENDIENTES_DE_OBJETIVO = 6;

/** El tope a la vista de los tres universos juntos (antes: 23 + 16 + 9 = 48 por medir; ahora, lo que mide el código). */
export const TOPE_TOTAL = TOPE_DE_PENDIENTES + TOPE_PENDIENTES_DE_PAUTA_SEMANAL + TOPE_PENDIENTES_DE_OBJETIVO;
