import { getTableColumns, sql, type SQL } from "drizzle-orm";
import { cohorts } from "@/lib/db/schema";

export type EstadoCohorte = "futuro" | "activo" | "cerrado";

export interface VentanaDeCohorte {
  fechaInicioVentas: string | null;
  fechaCierreVentas: string | null;
}

/**
 * Estado de negocio de una cohorte en un dia de Bogota (ADR 0137, punto 5). Sin ventana completa
 * (falta inicio o cierre) es futura "por definir" y nunca vende (ticket 227).
 */
export function estadoDeCohorte(c: VentanaDeCohorte, hoy: string): EstadoCohorte {
  if (c.fechaInicioVentas === null || c.fechaCierreVentas === null || hoy < c.fechaInicioVentas) return "futuro";
  if (hoy > c.fechaCierreVentas) return "cerrado";
  return "activo";
}

/** Gemela SQL de `estadoDeCohorte`; `hoy` siempre es un dia ISO de Bogota. */
export function estadoDeCohorteSql(hoy: string): SQL<EstadoCohorte> {
  return sql<EstadoCohorte>`case
    when ${cohorts.fechaInicioVentas} is null or ${cohorts.fechaCierreVentas} is null
      or ${hoy} < ${cohorts.fechaInicioVentas} then 'futuro'
    when ${hoy} > ${cohorts.fechaCierreVentas} then 'cerrado'
    else 'activo'
  end`;
}

/** Seleccion completa para lectores que conservan la forma historica con `estado`. */
export function columnasCohorteConEstado(hoy: string) {
  return { ...getTableColumns(cohorts), estado: estadoDeCohorteSql(hoy) };
}
