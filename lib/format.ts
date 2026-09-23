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

/**
 * Un monto en dolares SIEMPRE con sus dos decimales: "USD 750,00", no "USD 750".
 *
 * Antes se omitian los decimales cuando el monto era entero. Se cambio el 18-sep tras
 * el recorrido visual: un precio de contrato, un saldo y un abono se leen al lado de
 * otros montos y con decimales variables la columna deja de alinearse y el ojo tiene
 * que confirmar si "USD 797" es 797 exactos o un redondeo. En dinero los centavos
 * existen aunque hoy valgan cero.
 *
 * `cop` NO cambia: en Colombia el peso no se cobra con centavos y "COP 2.000.000,00"
 * seria ruido, no precision.
 */
export function usd(valor: number): string {
  return `USD ${num(valor, 2)}`;
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
  return `${moneda} ${num(valor, 2)}`;
}

/**
 * Como se escribe lo que falta por pagar de una venta. Tres estados, tres frases
 * distintas, porque son tres cosas distintas:
 *
 * - `null` → no hay precio contra el cual restar (sin producto asignado). No hay
 *   saldo que calcular y no se inventa un numero.
 * - negativo → NO es "un saldo pendiente de -103". Es un SOBREPAGO de 103, que
 *   alguien confirmo a proposito (el registro de abonos, que vuelve con el ticket 060). Un menos delante le
 *   dice al closer que debe plata quien en realidad pago de mas.
 * - cero o positivo → el saldo, tal cual.
 *
 * Devuelve la ETIQUETA junto al valor porque el sobrepago cambia las dos: "Saldo
 * pendiente: sobrepago de USD 103" no se lee, "Sobrepago: USD 103" si. Si solo
 * devolviera el numero, cada pantalla tendria que decidir la etiqueta por su cuenta
 * y volveriamos a tener la misma pregunta contestada en dos sitios (ADR 0024).
 *
 * Lo preguntan `/mi-dia` y `/personas/[id]`.
 */
export function saldoLegible(
  saldo: string | number | null,
  moneda: string,
): { etiqueta: string; valor: string } {
  if (saldo === null) {
    return { etiqueta: "Saldo pendiente", valor: "sin precio de contrato registrado" };
  }
  const valor = Number(saldo);
  if (valor < 0) return { etiqueta: "Sobrepago", valor: monto(Math.abs(valor), moneda) };
  return { etiqueta: "Saldo pendiente", valor: monto(valor, moneda) };
}

/** Los meses como los escribe el negocio: tres letras, sin punto. */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * El ID de una hoja de Google recortado para la pantalla (S-13). El ID completo no
 * es un secreto, pero tampoco tiene por que estar entero en una pantalla: el prefijo
 * alcanza para saber cual es cual, igual que en `docs/estructura-bbdd.md`
 * (`1DBKL4zw…`). Se muestran los primeros 8 caracteres y un puntos suspensivos.
 */
export function truncarId(id: string | null | undefined, visibles = 8): string {
  const s = String(id ?? "").trim();
  if (!s) return "—";
  return s.length <= visibles ? s : `${s.slice(0, visibles)}…`;
}

/**
 * Una fecha de calendario 'YYYY-MM-DD' escrita para leer: "14 ago 2026".
 *
 * Se parte el string, no se construye un `Date`: la fecha es un DIA de calendario, no
 * un instante, y pasarla por `Date` la correria un dia segun la zona del servidor
 * (Vercel corre en UTC y el equipo esta en Bogota). Lo que no tenga forma de fecha se
 * devuelve tal cual, sin inventar un dia.
 */
/**
 * El dia de HOY en Bogota, como 'YYYY-MM-DD' (lo que espera un `<input type="date">`).
 *
 * NO es `new Date().toISOString().slice(0, 10)`: eso da el dia en UTC, y Bogota va
 * cinco horas atras, asi que **de 7pm a medianoche prellenaria el dia siguiente**. Un
 * abono registrado a las 9 de la noche quedaria fechado manana y caeria en otro rango
 * del dashboard. `en-CA` se usa porque su formato corto ES `YYYY-MM-DD`.
 *
 * Vive aca y no en cada formulario porque lo preguntan los dos formularios de abono de
 * `/mi-dia` (el del cierre y el suelto): una sola respuesta para una sola pregunta.
 */
export function hoyEnBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Fecha de calendario de un instante, observada en Bogota. */
export function fechaDeInstanteEnBogota(instante: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(
    new Date(instante),
  );
}

export function fecha(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return iso;
  const [, anio, mes, dia] = partes;
  const nombre = MESES[Number(mes) - 1];
  if (!nombre) return iso;
  return `${Number(dia)} ${nombre} ${anio}`;
}

/**
 * Hace cuanto paso un instante, en palabras. Vive aca y no dentro de una pantalla
 * porque lo preguntan dos (`/ajustes/fuentes` y `/nerd-stats`) y la respuesta tiene
 * que ser la misma (ADR 0024). Es un INSTANTE (timestamp), no un dia de calendario:
 * por eso pasa por `Date` y `fecha()` no.
 */
export function haceCuanto(d: Date | string | null | undefined): string {
  if (!d) return "nunca";
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
