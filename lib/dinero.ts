/** Redondea montos en USD a centavos antes de exponerlos como totales. */
export function redondearUsd(valor: number): number {
  return Math.round(valor * 100) / 100;
}
