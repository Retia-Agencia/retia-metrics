/** Formato colombiano: punto de miles, coma decimal. La moneda SIEMPRE visible. */

const numeroCO = new Intl.NumberFormat("es-CO");

export function num(valor: number, decimales = 0): string {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

export function cop(valor: number): string {
  return `COP ${numeroCO.format(Math.round(valor))}`;
}

export function usd(valor: number): string {
  return `USD ${num(valor, valor % 1 === 0 ? 0 : 2)}`;
}

export function pct(fraccion: number, decimales = 1): string {
  return `${num(fraccion * 100, decimales)}%`;
}
