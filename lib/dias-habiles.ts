/**
 * Dias habiles y meta, en zona America/Bogota. Funciones puras: sin base, sin I/O.
 *
 * Regla de Retia (no del calendario colombiano): un dia habil es cualquier dia que
 * no sea sabado ni domingo. Los festivos CUENTAN como habiles (ver AGENTS.md y
 * docs/overview.md, vocabulario).
 *
 * Las fechas de calendario entran como ISO 'YYYY-MM-DD' (asi vienen
 * cohorts.fechaInicioClases / fechaCierreVentas desde la base) o como Date. Un
 * instante Date se interpreta por su dia de calendario en Bogota: p.ej.
 * 2026-09-16T03:00:00Z sigue siendo 2026-09-15 en Bogota.
 *
 * No se redondea aca: dar formato es tarea de lib/format.ts.
 */

export type FechaCalendario = string | Date;

const ZONA = "America/Bogota";

const partesEnBogota = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Dia de calendario en Bogota como 'YYYY-MM-DD', venga string ISO o Date. Es la
 * unica definicion de "que dia es" del proyecto: el dashboard la usa sobre `new
 * Date()` para saber que es hoy sin depender de la zona del servidor (Vercel corre
 * en UTC, asi que a las 19:00 de Bogota ya seria manana).
 */
export function diaDeCalendario(fecha: FechaCalendario): string {
  if (typeof fecha === "string") return fecha.slice(0, 10);
  return partesEnBogota.format(fecha); // en-CA formatea como YYYY-MM-DD
}

const MS_POR_DIA = 86_400_000;

/** 'YYYY-MM-DD' → milisegundos UTC de ese día de calendario. */
export function aUtc(fecha: string): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/** Milisegundos UTC → 'YYYY-MM-DD'. */
export function aIso(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date(ms));
}

export function sumarDias(fecha: string, dias: number): string {
  return aIso(aUtc(fecha) + dias * MS_POR_DIA);
}

/** Día de la semana de una fecha ISO (0=domingo..6=sábado). */
export function diaDeLaSemana(fechaIso: string): number {
  return new Date(aUtc(fechaIso)).getUTCDay();
}

/** El lunes de la semana a la que pertenece la fecha. */
export function lunesDe(fecha: string): string {
  const dia = diaDeLaSemana(fecha);
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

/** Numero de dia UTC (dias enteros desde epoch) del dia de calendario, sin sesgo de zona. */
function numeroDeDia(fecha: FechaCalendario): number {
  const [anio, mes, dia] = diaDeCalendario(fecha).split("-").map(Number);
  return Math.floor(Date.UTC(anio, mes - 1, dia) / MS_POR_DIA);
}

/** Dia de la semana (0=domingo..6=sabado) de un numero de dia. */
function diaDeLaSemanaNumero(numDia: number): number {
  return new Date(numDia * MS_POR_DIA).getUTCDay();
}

function esHabil(numDia: number): boolean {
  const dow = diaDeLaSemanaNumero(numDia);
  return dow !== 0 && dow !== 6;
}

/** true si el dia de calendario (en Bogota) no es sabado ni domingo. */
export function esDiaHabil(fecha: FechaCalendario): boolean {
  return esHabil(numeroDeDia(fecha));
}

/** El primer día hábil posterior al día de calendario recibido. */
export function diaHabilSiguiente(fecha: FechaCalendario): string {
  let dia = numeroDeDia(fecha) + 1;
  while (!esHabil(dia)) dia += 1;
  return new Date(dia * MS_POR_DIA).toISOString().slice(0, 10);
}

/** El primer día hábil anterior al día de calendario recibido. */
export function diaHabilAnterior(fecha: FechaCalendario): string {
  let dia = numeroDeDia(fecha) - 1;
  while (!esHabil(dia)) dia -= 1;
  return new Date(dia * MS_POR_DIA).toISOString().slice(0, 10);
}

/** El día de calendario anterior, sin depender de la zona horaria del proceso. */
export function diaCalendarioAnterior(fecha: string): string {
  return new Date((numeroDeDia(fecha) - 1) * MS_POR_DIA).toISOString().slice(0, 10);
}

/**
 * Dias habiles entre dos fechas de calendario, inclusive en ambos extremos.
 * Devuelve 0 si `fin` es anterior a `inicio`.
 */
export function diasHabilesEntre(inicio: FechaCalendario, fin: FechaCalendario): number {
  const desde = numeroDeDia(inicio);
  const hasta = numeroDeDia(fin);
  if (hasta < desde) return 0;
  let habiles = 0;
  for (let d = desde; d <= hasta; d++) {
    if (esHabil(d)) habiles++;
  }
  return habiles;
}

/**
 * Ubica una fecha dentro de una ventana de venta como par { dia, total }:
 * - `total` = dias habiles de [inicio, fin] inclusive (diasHabilesEntre).
 * - `dia`   = dias habiles de [inicio, fecha] inclusive, topado a [0, total].
 *
 * Si `fecha` cae en fin de semana, `dia` es el conteo de habiles hasta esa fecha,
 * es decir el mismo numero del ultimo dia habil anterior. Antes del inicio da 0;
 * despues del fin queda topado en `total`.
 */
export function diaHabilDe(
  fecha: FechaCalendario,
  inicio: FechaCalendario,
  fin: FechaCalendario,
): { dia: number; total: number } {
  const total = diasHabilesEntre(inicio, fin);
  const dia = Math.min(Math.max(diasHabilesEntre(inicio, fecha), 0), total);
  return { dia, total };
}

/**
 * La META DE HOY, medida a la APERTURA del dia (352, DA-5): lo que faltaba al abrir hoy, repartido entre
 * los dias habiles que quedan CONTANDO hoy.
 *
 *   max(meta - vendidosAntesDeHoy, 0) / diasHabilesEntre(hoy, cierre)
 *
 * El borde es explicito y es UNO para todas las pantallas: hoy cuenta como dia restante y las ventas de hoy
 * NO se descuentan (si se descontaran, la meta bajaria a medida que se vende y el cumplimiento del dia
 * subiria sin tope: 4 vendidas contra una meta de 2 daban 333 %). El ultimo dia habil da el faltante
 * entero; pasado el cierre ya no quedan dias y devuelve el faltante entero tambien (no divide por cero).
 * Un sabado o domingo reparte entre los habiles que siguen. No redondea: eso es de lib/format.ts.
 */
export function metaDeHoy(args: {
  meta: number;
  vendidosAntesDeHoy: number;
  hoy: FechaCalendario;
  cierre: FechaCalendario;
}): number {
  const faltantes = Math.max(args.meta - args.vendidosAntesDeHoy, 0);
  const dias = diasHabilesEntre(args.hoy, args.cierre);
  return dias <= 0 ? faltantes : faltantes / dias;
}

/**
 * Lo esperado por el ritmo lineal AL CIERRE de `hasta` (inclusive): meta repartida uniforme entre los habiles
 * de la ventana [inicio, cierre], por los habiles transcurridos de inicio a `hasta`. Antes del inicio es 0;
 * despues del cierre es la meta entera. Es la unica cuenta del esperado lineal (352, R-09): el cumplimiento
 * de la cohorte, de las alertas y del mes la importan.
 */
export function esperadoLineal(args: {
  meta: number;
  inicio: FechaCalendario;
  cierre: FechaCalendario;
  hasta: FechaCalendario;
}): number {
  const { dia, total } = diaHabilDe(args.hasta, args.inicio, args.cierre);
  return metaLineal({ meta: args.meta, diasHabilesTotales: total }) * dia;
}

/**
 * Ritmo lineal ideal: meta repartida uniforme entre los dias habiles totales de la
 * cohorte, meta / diasHabilesTotales. Con 0 dias totales devuelve 0 (no divide por
 * cero). No se redondea aca: dar formato es tarea de lib/format.ts.
 */
export function metaLineal(args: { meta: number; diasHabilesTotales: number }): number {
  if (args.diasHabilesTotales <= 0) return 0;
  return args.meta / args.diasHabilesTotales;
}
