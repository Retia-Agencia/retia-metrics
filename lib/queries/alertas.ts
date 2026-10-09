import { and, eq, inArray } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario, diaHabilDe, esDiaHabil, metaLineal } from "@/lib/dias-habiles";
import { sumarDias } from "@/lib/rangos";
import { cohorteActiva } from "@/lib/queries/cohortes";
import {
  armarMetasDelMes,
  leerCohortesYVentas,
  type CohorteParaMetas,
  type VentaParaMetas,
} from "@/lib/queries/metas";
import { umbralesDelPrograma, type MetricaConUmbral, type UmbralDeAlerta } from "@/lib/catalogo/umbrales";
import { ETAPAS_VENDIDAS } from "@/lib/deals/etapas";
import { ventasConDiaEn } from "@/lib/queries/dashboard";
import { vigente } from "@/lib/queries/vigente";

/**
 * Las alertas por persistencia (ticket 147, GC-40, QD-6): una métrica del semáforo de la meta caída
 * un día no es alerta; caída N días hábiles SEGUIDOS por debajo de su aceptable, sí. Se calcula al
 * leer, nunca se guarda.
 *
 * Reglas:
 *  - Solo días hábiles (regla de Retia: se saltan sábados y domingos; los festivos cuentan) y solo
 *    días CERRADOS: hoy no cuenta, porque su cumplimiento todavía puede subir.
 *  - El cumplimiento de un día es el del cierre de ese día: lo vendido hasta ese día contra lo
 *    esperado hasta ese día, con la misma cuenta que la meta del mes (146) y la de la cohorte (020).
 *  - Un día sin esperado (fuera de la ventana de venta) no es un día bajo: corta la racha.
 */

/** Cuántos días hábiles hacia atrás se mira, como mucho, para medir la racha. */
const RACHA_MAXIMA = 30;

export interface DatosDeAlertas {
  cohortes: readonly CohorteParaMetas[];
  /** Las ventas con día, como las cuenta la meta del mes (146). */
  ventas: readonly VentaParaMetas[];
  /**
   * Los deals de la cohorte activa que HOY están vendidos, con el día de su venta: el mismo conjunto
   * que cuenta el Pulso (`vistaDeCohorteActiva`), así el cumplimiento de un día cuadra con la tarjeta.
   * Un deal que pasó de Abonado a Cierre Perdido ya no está; uno sin día conocido lleva `DESDE_SIEMPRE`.
   */
  ventasDeLaCohorte: readonly { dealId: string; dia: string }[];
  /** La cohorte activa de hoy: la meta de la cohorte se mide siempre contra ella. */
  cohorteActivaId: string | null;
}

export interface DiaDeAlerta {
  dia: string;
  /** Fracción de cumplimiento (1 = 100 %); `null` si ese día no había nada esperado. */
  cumplimiento: number | null;
}

export interface Alerta {
  metrica: MetricaConUmbral;
  aceptable: number;
  diasSeguidos: number;
  /** Días hábiles cerrados seguidos bajo el aceptable, contando desde el último hacia atrás. */
  racha: number;
  /** La alerta sale cuando la racha llega a los días configurados. */
  disparada: boolean;
  /** Los días que mira el umbral, del más viejo al más reciente. */
  dias: DiaDeAlerta[];
}

/** El cumplimiento de una métrica al cierre de un día, con la cuenta de su meta. */
export function cumplimientoAlCierre(metrica: MetricaConUmbral, datos: DatosDeAlertas, dia: string): number | null {
  if (metrica === "meta_mes") {
    const ventasHasta = datos.ventas.filter((venta) => venta.dia <= dia);
    return armarMetasDelMes({ cohortes: datos.cohortes, ventas: ventasHasta, mes: dia.slice(0, 7), hoy: dia }).cumplimiento;
  }
  const cohorte = datos.cohortes.find((c) => c.id === datos.cohorteActivaId);
  if (!cohorte?.fechaInicioVentas || !cohorte.fechaCierreVentas) return null;
  const { dia: diaHabil, total } = diaHabilDe(dia, cohorte.fechaInicioVentas, cohorte.fechaCierreVentas);
  const esperado = metaLineal({ meta: cohorte.metaCupos, diasHabilesTotales: total }) * diaHabil;
  if (esperado === 0) return null;
  return datos.ventasDeLaCohorte.filter((venta) => venta.dia <= dia).length / esperado;
}

/** El día de una venta vendida sin movimiento que la feche: cuenta en todo día. */
export const DESDE_SIEMPRE = "0000-01-01";

/** El día hábil anterior a `dia`. */
function habilAnterior(dia: string): string {
  let anterior = sumarDias(dia, -1);
  while (!esDiaHabil(anterior)) anterior = sumarDias(anterior, -1);
  return anterior;
}

/** Los últimos `n` días hábiles cerrados antes de `hoy`, del más reciente al más viejo. */
export function habilesCerradosAntesDe(hoy: string, n: number): string[] {
  const dias: string[] = [];
  for (let dia = habilAnterior(hoy); dias.length < n; dia = habilAnterior(dia)) dias.push(dia);
  return dias;
}

/** La cuenta, sin base ni reloj. `hoy` es el día de Bogotá que entrega `hoyEnBogota()`. */
export function evaluarAlerta(umbral: Pick<UmbralDeAlerta, "metrica" | "aceptable" | "diasSeguidos">, datos: DatosDeAlertas, hoy: string): Alerta {
  const recientes = habilesCerradosAntesDe(hoy, Math.max(RACHA_MAXIMA, umbral.diasSeguidos)).map((dia) => ({
    dia,
    cumplimiento: cumplimientoAlCierre(umbral.metrica, datos, dia),
  }));
  const bajo = (d: DiaDeAlerta) => d.cumplimiento !== null && d.cumplimiento * 100 < umbral.aceptable;
  const corte = recientes.findIndex((d) => !bajo(d));
  const racha = corte === -1 ? recientes.length : corte;
  return {
    metrica: umbral.metrica,
    aceptable: umbral.aceptable,
    diasSeguidos: umbral.diasSeguidos,
    racha,
    disparada: racha >= umbral.diasSeguidos,
    dias: recientes.slice(0, umbral.diasSeguidos).reverse(),
  };
}

/**
 * Las alertas de un programa: una por umbral ACTIVO, disparada o no (la pantalla decide qué
 * mostrar). Sin umbrales no lee nada más. Las ventas se leen desde el primer día del mes más viejo
 * que mira la racha, o desde el inicio de la cohorte activa si es anterior.
 */
export async function alertasDelPrograma(programId: string, hoy: string, db: Db = dbDeLaApp): Promise<Alerta[]> {
  const umbrales = (await umbralesDelPrograma(db, programId)).filter((u) => u.activo);
  if (umbrales.length === 0) return [];
  const masViejo = habilesCerradosAntesDe(hoy, Math.max(RACHA_MAXIMA, ...umbrales.map((u) => u.diasSeguidos))).at(-1)!;
  const activa = await cohorteActiva(programId, db);
  const [{ cohortes, ventas }, ventasDeLaCohorte] = await Promise.all([
    leerCohortesYVentas(db, programId, { desde: `${masViejo.slice(0, 7)}-01`, hasta: hoy }),
    activa ? leerVentasDeLaCohorte(db, activa.id, hoy) : Promise.resolve([]),
  ]);
  const datos: DatosDeAlertas = { cohortes, ventas, ventasDeLaCohorte, cohorteActivaId: activa?.id ?? null };
  return umbrales.map((umbral) => evaluarAlerta(umbral, datos, hoy));
}

/**
 * Los deals de la cohorte que hoy están vendidos (el predicado de `ventasDeCohorte` del Pulso) con el
 * día de su venta. El día se lee SIN límite inferior: una preventa o un deal migrado con historial
 * viejo también cuenta, como en el Pulso.
 */
async function leerVentasDeLaCohorte(db: Db, cohorteId: string, hoy: string) {
  const [vendidos, conDia] = await Promise.all([
    db.select({ dealId: deals.id }).from(deals).where(and(
      eq(deals.cohortId, cohorteId),
      inArray(deals.etapa, [...ETAPAS_VENDIDAS]),
      eq(deals.cortesia, false),
      vigente(deals),
    )),
    ventasConDiaEn(db, { desde: "2000-01-01", hasta: hoy }),
  ]);
  const diaPorDeal = new Map(conDia.map((venta) => [venta.dealId, diaDeCalendario(venta.dia)]));
  return vendidos.map(({ dealId }) => ({ dealId, dia: diaPorDeal.get(dealId) ?? DESDE_SIEMPRE }));
}
