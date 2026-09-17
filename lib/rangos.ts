import type { Rango } from "@/lib/queries/dashboard";

/**
 * El selector de rango del dashboard (ticket 005): traduce lo que el usuario elige a
 * el par de fechas que consumen las consultas del 004.
 *
 * Aritmetica de calendario pura: sin base, sin reloj y sin `Date` local. Las fechas
 * entran y salen como 'YYYY-MM-DD' ya en Bogota (quien las produce es
 * `diaDeCalendario` de `lib/dias-habiles.ts`), y las cuentas se hacen en UTC para
 * que sumar un dia no dependa de la zona del servidor.
 *
 * "Esta semana" y "este mes" llegan HASTA HOY, no hasta el fin del periodo (decision
 * de Mani, 17-sep): el dashboard es el reporte del dia, y arrastrar dias futuros en
 * cero ensuciaria las tasas y el cumplimiento.
 */

export type PresetDeRango = "hoy" | "semana" | "mes" | "cohorte" | "custom";

const MS_POR_DIA = 86_400_000;

/** 'YYYY-MM-DD' → milisegundos UTC de ese dia de calendario. */
function aUtc(fecha: string): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia);
}

/** milisegundos UTC → 'YYYY-MM-DD'. */
function aIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** El lunes de la semana a la que pertenece la fecha (la semana arranca en lunes). */
function lunesDe(fecha: string): string {
  const ms = aUtc(fecha);
  const dow = new Date(ms).getUTCDay(); // 0 = domingo
  const desdeElLunes = dow === 0 ? 6 : dow - 1;
  return aIso(ms - desdeElLunes * MS_POR_DIA);
}

/** El dia 1 del mes de la fecha. */
function primeroDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

/** Una fecha de calendario escrita como 'YYYY-MM-DD' y que existe de verdad. */
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esFecha(valor: string | undefined): valor is string {
  return valor !== undefined && FECHA.test(valor) && !Number.isNaN(aUtc(valor));
}

/**
 * Lo que se resolvio. `preset` es el que de verdad se uso, no el que pidieron: si la
 * cohorte no tiene ventana o las fechas custom no sirven, sale "hoy" y la pantalla
 * pinta "hoy". Asi el selector nunca miente sobre que se esta mirando.
 */
export interface SeleccionDeRango {
  preset: PresetDeRango;
  rango: Rango;
}

export function resolverRango(args: {
  /** Lo que venga en la URL, que puede ser cualquier cosa. */
  preset: string;
  /** Hoy en Bogota, 'YYYY-MM-DD'. */
  hoy: string;
  /** Ventana de venta de la cohorte activa, o null si no hay (ADR 0022). */
  ventana?: { inicio: string; cierre: string } | null;
  desde?: string;
  hasta?: string;
}): SeleccionDeRango {
  const { preset, hoy, ventana, desde, hasta } = args;
  const soloHoy: SeleccionDeRango = { preset: "hoy", rango: { desde: hoy, hasta: hoy } };

  switch (preset) {
    case "semana":
      return { preset, rango: { desde: lunesDe(hoy), hasta: hoy } };
    case "mes":
      return { preset, rango: { desde: primeroDelMes(hoy), hasta: hoy } };
    case "cohorte":
      // Sin ventana no se inventa una: la cohorte cerrada vieja no tiene inicio de
      // ventas declarado y el dashboard lo dice en vez de suponerlo.
      if (!ventana) return soloHoy;
      return {
        preset,
        rango: {
          desde: ventana.inicio,
          // Pasado el cierre, la cohorte ya no vende: el rango no crece mas.
          hasta: aUtc(hoy) > aUtc(ventana.cierre) ? ventana.cierre : hoy,
        },
      };
    case "custom":
      if (!esFecha(desde) || !esFecha(hasta) || aUtc(desde) > aUtc(hasta)) return soloHoy;
      return { preset, rango: { desde, hasta } };
    default:
      return soloHoy;
  }
}
