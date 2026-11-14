/**
 * Costo por venta de Pauta (CAC, ticket 415): Inversión ÷ Ventas de pauta, en COP. La ÚNICA definición (ADR 0115 N1).
 *
 * Las dos partes NO se vuelven a leer: las trae quien pinta las celdas «Inversión» y «Ventas» del mismo periodo, así
 * que el costo y sus dos celdas no pueden divergir (el molde de `costoPorAgendaDelCrm`). Ventas de pauta son las de
 * área Paid por fecha de venta: una venta de orgánico o de referidos no baja el costo.
 *
 * Cobertura (N3): sin ventas no hay entre qué dividir; sin inversión (no se cargó gasto, falta la tasa de cambio o el
 * gasto sumó cero) no hay costo que repartir. En los dos casos el valor es `null` con su motivo, nunca COP 0.
 */
import { razonVacia, type RazonConCobertura } from "@/lib/cobertura";

export const MOTIVO_SIN_VENTAS = "No hubo ventas: no hay entre qué dividir";
export const MOTIVO_SIN_INVERSION = "Sin inversión en el periodo";

export function costoPorVenta(e: {
  /** La celda «Inversión» del periodo, en COP; `null` si no se pudo calcular. */
  inversionCop: number | null;
  /** Por qué la inversión no se pudo calcular (lo que dice su celda). */
  motivoSinInversion?: string | null;
  /** La celda «Ventas» del periodo: ventas de área Paid. */
  ventas: number;
}): RazonConCobertura {
  if (e.inversionCop === null) return razonVacia(e.motivoSinInversion ?? MOTIVO_SIN_INVERSION);
  if (e.inversionCop <= 0) return razonVacia(MOTIVO_SIN_INVERSION);
  if (e.ventas <= 0) return razonVacia(MOTIVO_SIN_VENTAS);
  return { valor: e.inversionCop / e.ventas, base: e.ventas, faltan: 0, motivo: null };
}
