/** Formato colombiano: punto de miles, coma decimal. La moneda SIEMPRE visible. */

const numeroCO = new Intl.NumberFormat("es-CO");
const formatosPorDecimales = new Map<number, Intl.NumberFormat>();

function formatoCon(decimales: number): Intl.NumberFormat {
  let formato = formatosPorDecimales.get(decimales);
  if (!formato) {
    formato = new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    });
    formatosPorDecimales.set(decimales, formato);
  }
  return formato;
}

export function num(valor: number, decimales = 0): string {
  return formatoCon(decimales).format(valor);
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

/**
 * Un monto con su moneda al lado, despachando por el texto que trae la fila de la
 * base. La moneda NUNCA se convierte ni se omite: hay caja en USD y pauta en COP y
 * no existe una TRM historica unica (restriccion dura de AGENTS.md). Una moneda que
 * el codigo no conoce se muestra igual, con su codigo delante.
 */
export function monto(valor: number, moneda: string): string {
  if (moneda === "USD") return usd(valor);
  if (moneda === "COP") return cop(valor);
  return `${moneda} ${num(valor, valor % 1 === 0 ? 0 : 2)}`;
}

/** Los meses como los escribe el negocio: tres letras, sin punto. */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Una fecha de calendario 'YYYY-MM-DD' escrita para leer: "14 ago 2026".
 *
 * Se parte el string, no se construye un `Date`: la fecha es un DIA de calendario, no
 * un instante, y pasarla por `Date` la correria un dia segun la zona del servidor
 * (Vercel corre en UTC y el equipo esta en Bogota). Lo que no tenga forma de fecha se
 * devuelve tal cual, sin inventar un dia.
 */
export function fecha(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return iso;
  const [, anio, mes, dia] = partes;
  const nombre = MESES[Number(mes) - 1];
  if (!nombre) return iso;
  return `${Number(dia)} ${nombre} ${anio}`;
}
