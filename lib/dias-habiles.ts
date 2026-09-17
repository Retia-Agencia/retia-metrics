/**
 * Dias habiles y meta, en zona America/Bogota. Funciones puras: sin base, sin I/O.
 *
 * Regla de Retia (no del calendario colombiano): un dia habil es cualquier dia que
 * no sea sabado ni domingo. Los festivos CUENTAN como habiles (ver AGENTS.md y
 * docs/agents/context.md, "Dia habil").
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

/** Numero de dia UTC (dias enteros desde epoch) del dia de calendario, sin sesgo de zona. */
function numeroDeDia(fecha: FechaCalendario): number {
  const [anio, mes, dia] = diaDeCalendario(fecha).split("-").map(Number);
  return Math.floor(Date.UTC(anio, mes - 1, dia) / MS_POR_DIA);
}

/** Dia de la semana (0=domingo..6=sabado) de un numero de dia. */
function diaDeLaSemana(numDia: number): number {
  return new Date(numDia * MS_POR_DIA).getUTCDay();
}

function esHabil(numDia: number): boolean {
  const dow = diaDeLaSemana(numDia);
  return dow !== 0 && dow !== 6;
}

/** true si el dia de calendario (en Bogota) no es sabado ni domingo. */
export function esDiaHabil(fecha: FechaCalendario): boolean {
  return esHabil(numeroDeDia(fecha));
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
 * Cupos que faltan por vender por cada dia habil que le queda a la cohorte:
 * max(meta - vendidos, 0) / diasHabilesRestantes.
 *
 * Con `diasHabilesRestantes = 0` no se divide por cero: se devuelve el faltante
 * completo si es > 0 (hay que cerrarlo todo hoy), o 0 si la meta ya se cumplio.
 * No se redondea aca: dar formato es tarea de lib/format.ts.
 */
export function metaDinamica(args: {
  meta: number;
  vendidos: number;
  diasHabilesRestantes: number;
}): number {
  const faltantes = Math.max(args.meta - args.vendidos, 0);
  if (args.diasHabilesRestantes <= 0) return faltantes;
  return faltantes / args.diasHabilesRestantes;
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
