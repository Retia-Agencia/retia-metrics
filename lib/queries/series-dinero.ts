import { and, eq, inArray, min } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, cohorts, deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { nombreDeMes } from "@/lib/series-pasos";
import { ventasConDiaEn, type Rango } from "@/lib/queries/dashboard";
import { filtroCaja, porClaveDeDeal, porCohorteDeDeal } from "@/lib/queries/metricas-filtros";
import { leerMetasDelMes } from "@/lib/queries/metas";
import { sumaDeAbonos, valoresVendidosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

/** Lo que pasó cada día de una ventana: el insumo de toda gráfica de Dinero (ticket 370). */
export interface VentanaDeDinero {
  rango: Rango;
  /** Ventas (deals en Abonado o Completo) por el día de la venta. */
  cuposPorDia: Map<string, number>;
  /** Vendido (369): el valor vendido de esas ventas. Un cupo sin valor cuenta como cupo y no suma plata. */
  usdPorDia: Map<string, number>;
  sinValorVendido: number;
  /**
   * Cupos con caja: cada deal con al menos un abono vigente en la ventana cuenta UNA vez, el día de su
   * primer abono de la ventana. Un cupo es un cupo: un segundo abono del mismo deal no suma otro.
   */
  cuposConAbonoPorDia: Map<string, number>;
  /** Lo que entró a caja por moneda y día de abono. Nunca se convierte. */
  cajaPorMoneda: Map<string, Map<string, number>>;
}

export interface MetaDeSerie {
  etiqueta: string;
  cupos: number | null;
  /** Cupos × precio de la cohorte, la regla de `metas.ts`. */
  usd: number | null;
}

export interface SeriesDeDinero {
  programId: string;
  a: VentanaDeDinero;
  b: VentanaDeDinero | null;
  monedas: string[];
  meta: MetaDeSerie;
}

interface VentanaPedida {
  rango: Rango;
  cohorteId: string | null;
}

const sumarEn = (mapa: Map<string, number>, clave: string, valor: number) =>
  mapa.set(clave, (mapa.get(clave) ?? 0) + valor);

async function leerVentana(
  db: Db,
  entrada: { programId: string; claveCloser: string | null },
  { rango, cohorteId }: VentanaPedida,
): Promise<VentanaDeDinero> {
  const alcance = { programId: entrada.programId, rango, claveCloser: entrada.claveCloser, cohorteId };
  const [vendidas, caja, primerosAbonos] = await Promise.all([
    ventasConDiaEn(db, rango),
    db.select({ dia: abonos.fecha, moneda: abonos.moneda, total: sumaDeAbonos() })
      .from(abonos)
      .where(and(filtroCaja(alcance, db), vigente(abonos)))
      .groupBy(abonos.fecha, abonos.moneda),
    db.select({ dealId: abonos.dealId, dia: min(abonos.fecha) })
      .from(abonos)
      .where(and(filtroCaja(alcance, db), vigente(abonos)))
      .groupBy(abonos.dealId),
  ]);
  // Las ventas se filtran en SQL por programa, closer y cohorte; la lista de ids solo viaja una vez.
  const elegidas = vendidas.length === 0 ? [] : await db.select({ id: deals.id })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(inArray(deals.id, vendidas.map((venta) => venta.dealId)),
      eq(deals.programId, entrada.programId), porClaveDeDeal(entrada.claveCloser), porCohorteDeDeal(cohorteId), vigente(deals)));
  const idsElegidos = new Set(elegidas.map((deal) => deal.id));
  const ventas = vendidas.filter((venta) => idsElegidos.has(venta.dealId));
  const valores = await valoresVendidosDeDeals(db, ventas.map((venta) => venta.dealId));

  const cuposPorDia = new Map<string, number>();
  const usdPorDia = new Map<string, number>();
  let sinValorVendido = 0;
  for (const venta of ventas) {
    sumarEn(cuposPorDia, venta.dia, 1);
    const valor = valores.get(venta.dealId);
    if (valor === undefined) continue;
    if (valor === null) sinValorVendido += 1;
    else sumarEn(usdPorDia, venta.dia, valor);
  }
  const cuposConAbonoPorDia = new Map<string, number>();
  for (const fila of primerosAbonos) if (fila.dia) sumarEn(cuposConAbonoPorDia, fila.dia, 1);
  const cajaPorMoneda = new Map<string, Map<string, number>>();
  for (const fila of caja) {
    const dias = cajaPorMoneda.get(fila.moneda) ?? new Map<string, number>();
    sumarEn(dias, fila.dia, Number(fila.total));
    cajaPorMoneda.set(fila.moneda, dias);
  }
  return { rango, cuposPorDia, usdPorDia, sinValorVendido, cuposConAbonoPorDia, cajaPorMoneda };
}

/**
 * La meta que acompaña al título (ADR 0106): la de la cohorte cuando hay una elegida, la del mes del
 * extremo final del periodo cuando no. Siempre del programa entero, nunca repartida entre closers.
 */
async function leerMeta(
  db: Db,
  { programId, cohorteId, hasta, hoy }: { programId: string; cohorteId: string | null; hasta: string; hoy: string },
): Promise<MetaDeSerie> {
  if (cohorteId) {
    const [cohorte] = await db.select({ codigo: cohorts.codigo, metaCupos: cohorts.metaCupos, precioUsd: cohorts.precioUsd })
      .from(cohorts)
      .where(and(eq(cohorts.id, cohorteId), eq(cohorts.programId, programId)));
    if (!cohorte) return { etiqueta: "Meta", cupos: null, usd: null };
    return { etiqueta: `Meta de ${cohorte.codigo}`, cupos: cohorte.metaCupos, usd: cohorte.metaCupos * Number(cohorte.precioUsd) };
  }
  const mes = (hasta < hoy ? hasta : hoy).slice(0, 7);
  const metas = await leerMetasDelMes(programId, mes, hoy, db);
  const etiqueta = `Meta de ${nombreDeMes(`${mes}-01`).toLowerCase()} · programa`;
  return metas.mesSinVentana
    ? { etiqueta, cupos: null, usd: null }
    : { etiqueta, cupos: metas.metaCupos, usd: metas.metaUsd };
}

/**
 * Lo que pasó cada día en el periodo elegido (A) y, si se pidió, en su comparación (B), cada uno con su
 * propia cohorte (C3 contra C2 al mismo día de venta). El eje X, el paso y la forma los decide quien pinta
 * con `lib/series-pasos.ts`: aquí no hay ningún número de meses.
 */
export async function leerSeriesDeDinero(
  entrada: {
    programId: string;
    a: VentanaPedida;
    b: VentanaPedida | null;
    claveCloser: string | null;
    hoy: string;
  },
  db: Db = dbDeLaApp,
): Promise<SeriesDeDinero> {
  const base = { programId: entrada.programId, claveCloser: entrada.claveCloser };
  const [a, b, meta] = await Promise.all([
    leerVentana(db, base, entrada.a),
    entrada.b ? leerVentana(db, base, entrada.b) : Promise.resolve(null),
    leerMeta(db, { programId: entrada.programId, cohorteId: entrada.a.cohorteId, hasta: entrada.a.rango.hasta, hoy: entrada.hoy }),
  ]);
  const monedas = [...new Set([a, b].flatMap((ventana) => ventana ? [...ventana.cajaPorMoneda.keys()] : []))].sort();
  return { programId: entrada.programId, a, b, monedas, meta };
}
