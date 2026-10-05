import { and, eq, inArray } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diasHabilesEntre } from "@/lib/dias-habiles";
import { mismoPuntoHabil } from "@/lib/periodo";
import { sumarDias } from "@/lib/rangos";
import { pivotarSerie } from "@/lib/series-alineadas";
import { ventasConDiaEn, type Alcance, type Rango } from "@/lib/queries/dashboard";
import { filtroCaja, porClaveDeDeal } from "@/lib/queries/metricas-filtros";
import { leerMetasDelMes, moverMes } from "@/lib/queries/metas";
import { contratadoDeDeals, sumaDeAbonos } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

interface ValoresDeDinero {
  contratadoUsd: number;
  cupos: number;
  caja: { moneda: string; total: number }[];
}

export interface MesDeDinero extends ValoresDeDinero {
  mes: string;
  rango: Rango;
  metaUsd: number | null;
  metaCupos: number | null;
  sinValorVendido: number;
}

export interface SeriesDeDinero {
  programId: string;
  meses: MesDeDinero[];
  acumulado: {
    a: Rango;
    b: Rango | null;
    puntos: {
      dia: string;
      diaAnterior: string | null;
      actual: ValoresDeDinero;
      anterior: ValoresDeDinero | null;
    }[];
  } | null;
}

const finDeMes = (mes: string) => sumarDias(`${moverMes(mes, 1)}-01`, -1);

/**
 * Seis meses hasta el mes del extremo final de A. El último llega solo hasta ese
 * extremo o hasta hoy (Bogotá, entregado por la página). La comparación mensual
 * tiene su propio B: el mes anterior al mismo hábil, no el B libre del selector.
 * La meta siempre es del programa entero, incluso al filtrar una contribución.
 */
export async function leerSeriesDeDinero(
  entrada: Alcance & { hoy: string },
  db: Db = dbDeLaApp,
): Promise<SeriesDeDinero> {
  const mesFinal = entrada.rango.hasta.slice(0, 7);
  const meses = Array.from({ length: 6 }, (_, i) => moverMes(mesFinal, i - 5));
  const corte = entrada.rango.hasta < entrada.hoy ? entrada.rango.hasta : entrada.hoy;
  const rango = { desde: `${meses[0]}-01`, hasta: corte };
  const alcance = { ...entrada, rango };
  const [vendidas, caja, metas] = await Promise.all([
    ventasConDiaEn(db, rango),
    db.select({ dia: abonos.fecha, moneda: abonos.moneda, total: sumaDeAbonos() })
      .from(abonos)
      .where(and(filtroCaja(alcance, db), vigente(abonos)))
      .groupBy(abonos.fecha, abonos.moneda),
    Promise.all(meses.map((mes) => leerMetasDelMes(entrada.programId, mes, entrada.hoy, db))),
  ]);
  const elegidas = vendidas.length === 0 ? [] : await db.select({ id: deals.id })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(inArray(deals.id, vendidas.map((venta) => venta.dealId)),
      eq(deals.programId, entrada.programId), porClaveDeDeal(entrada.claveCloser), vigente(deals)));
  const idsElegidos = new Set(elegidas.map((deal) => deal.id));
  const ventas = vendidas.filter((venta) => idsElegidos.has(venta.dealId));

  // Lotes de ids por mes para la historia y por día SOLO para los dos meses de
  // la comparación. Nunca una consulta por deal ni una copia de su valor vendido.
  const inicioDiario = `${meses[4]}-01`;
  const grupos = new Map<string, string[]>();
  for (const venta of ventas) {
    const clave = venta.dia < inicioDiario ? venta.dia.slice(0, 7) : venta.dia;
    const ids = grupos.get(clave) ?? [];
    ids.push(venta.dealId);
    grupos.set(clave, ids);
  }
  const importes = new Map(await Promise.all([...grupos].map(async ([clave, ids]) =>
    [clave, await contratadoDeDeals(db, ids)] as const)));
  const filas = [...grupos].map(([dia, ids]) => ({
    programId: entrada.programId,
    dia,
    cupos: ids.length,
    contratadoUsd: importes.get(dia)!.usd,
    sinValorVendido: importes.get(dia)!.sinValorVendido,
  }));
  const monedas = [...new Set(caja.map((fila) => fila.moneda))].sort();
  const mensuales = meses.map<MesDeDinero>((mes, i) => {
    const suyas = filas.filter((fila) => fila.dia.startsWith(mes));
    return {
      mes,
      rango: { desde: `${mes}-01`, hasta: finDeMes(mes) < corte ? finDeMes(mes) : corte },
      contratadoUsd: suyas.reduce((n, fila) => n + fila.contratadoUsd, 0),
      cupos: suyas.reduce((n, fila) => n + fila.cupos, 0),
      sinValorVendido: suyas.reduce((n, fila) => n + fila.sinValorVendido, 0),
      caja: monedas.map((moneda) => ({
        moneda,
        total: caja.filter((fila) => fila.dia.startsWith(mes) && fila.moneda === moneda)
          .reduce((n, fila) => n + Number(fila.total), 0),
      })),
      metaUsd: metas[i].mesSinVentana ? null : metas[i].metaUsd,
      metaCupos: metas[i].mesSinVentana ? null : metas[i].metaCupos,
    };
  });
  const a = mensuales[5].rango;
  if (a.hasta < a.desde) return { programId: entrada.programId, meses: mensuales, acumulado: null };
  const anterior = { desde: inicioDiario, hasta: finDeMes(meses[4]) };
  const b = mismoPuntoHabil(a, anterior);

  const acumulados = (ventana: Rango) => {
    const alcanceDiario = { programId: entrada.programId, rango: ventana };
    const cupos = pivotarSerie(filas, alcanceDiario, () => "cupos", (fila) => fila.cupos);
    const contratado = pivotarSerie(filas, alcanceDiario, () => "contratado", (fila) => fila.contratadoUsd);
    const recaudo = pivotarSerie(caja.map((fila) => ({ ...fila, programId: entrada.programId })),
      alcanceDiario, (fila) => fila.moneda, (fila) => Number(fila.total));
    let totalCupos = 0;
    let totalUsd = 0;
    const porMoneda = new Map(monedas.map((moneda) => [moneda, 0]));
    return new Map(cupos.dias.map((dia, i) => {
      totalCupos += cupos.series[0]?.valores[i] ?? 0;
      totalUsd += contratado.series[0]?.valores[i] ?? 0;
      for (const serie of recaudo.series) {
        porMoneda.set(serie.clave, porMoneda.get(serie.clave)! + serie.valores[i]);
      }
      return [dia, {
        cupos: totalCupos,
        contratadoUsd: totalUsd,
        caja: [...porMoneda].map(([moneda, total]) => ({ moneda, total })),
      }];
    }));
  };
  const valoresA = acumulados(a);
  const valoresB = b ? acumulados(b) : new Map<string, ValoresDeDinero>();
  const habilesB = diasHabilesEntre(anterior.desde, anterior.hasta);
  const puntos = [...valoresA].map(([dia, actual]) => {
    // Si B tiene menos hábiles, no prolongar su último punto como si hubiera datos.
    const comparable = diasHabilesEntre(a.desde, dia) <= habilesB
      ? mismoPuntoHabil({ desde: a.desde, hasta: dia }, anterior)
      : null;
    const diaAnterior = comparable?.hasta ?? null;
    return { dia, diaAnterior, actual, anterior: diaAnterior ? valoresB.get(diaAnterior) ?? null : null };
  });
  return { programId: entrada.programId, meses: mensuales, acumulado: { a, b, puntos } };
}
