import { and, asc, desc, eq, gte, isNotNull, lte, or } from "drizzle-orm";
import { fotosPauta, gastoPauta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilAnterior } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";
import * as agenda from "@/lib/queries/hechos/agenda";
import { tasaDelDia } from "@/lib/trm/consultar";

export interface NotaSemaforo {
  tipo: "problema" | "info";
  texto: string;
}

export interface CostoPorAgenda {
  gasto: number;
  agendasMeta: number | null;
  agendasCrm: number;
  costo: number | null;
  notas: NotaSemaforo[];
}

type FilaDeGasto = {
  dia: string;
  monto: string;
  moneda: string;
  agendasMeta: number | null;
};

const NOTA_HQ4 = "El gasto incluye todas las campañas del programa ";

async function sumarEnCop(db: Db, filas: FilaDeGasto[]): Promise<{
  gasto: number;
  agendasMeta: number | null;
  notas: NotaSemaforo[];
}> {
  let gasto = 0;
  let agendasMeta = 0;
  let tieneAgendasMeta = false;
  const sinTrm = new Map<string, number>();
  const tasas = new Map<string, number | null>();

  for (const fila of filas) {
    const monto = Number(fila.monto);
    if (fila.moneda === "COP") {
      gasto += monto;
    } else {
      if (!tasas.has(fila.dia)) {
        tasas.set(fila.dia, (await tasaDelDia(db, fila.dia))?.pesosPorDolar ?? null);
      }
      const tasa = tasas.get(fila.dia);
      if (tasa === null || tasa === undefined) {
        sinTrm.set(fila.dia, (sinTrm.get(fila.dia) ?? 0) + 1);
      } else {
        gasto += monto * tasa;
      }
    }
    if (fila.agendasMeta !== null) {
      agendasMeta += fila.agendasMeta;
      tieneAgendasMeta = true;
    }
  }

  const notas: NotaSemaforo[] = [{ tipo: "info", texto: NOTA_HQ4 }];
  for (const [dia, cantidad] of sinTrm) {
    notas.push({
      tipo: "problema",
      texto: `Sin TRM del ${dia}: ${cantidad} filas en USD no se sumaron.`,
    });
  }
  return { gasto, agendasMeta: tieneAgendasMeta ? agendasMeta : null, notas };
}

async function contarAgendas(
  db: Db,
  args: { programId: string; desde: string; hasta: string; creadaHasta?: Date },
): Promise<number> {
  const filas = await agenda.agrupar<"dia" | "area">(db, {
    programId: args.programId,
    rango: { desde: args.desde, hasta: args.hasta },
    agruparPor: ["dia"],
    filtros: { area: ["paid"] },
    creadaHasta: args.creadaHasta,
  });
  return filas.reduce((total, fila) => total + fila.agendas, 0);
}

/**
 * Meta omite la conversión de agenda cuando cuenta 0, así que una fila sin agendas es ambigua: si el
 * programa ya tuvo agendas de Meta alguna vez, mide con el pixel y la ausencia es un 0; si nunca las
 * tuvo, de verdad no las mide.
 */
async function programaMideAgendasMeta(db: Db, programId: string): Promise<boolean> {
  const [fila] = await db.select({ id: gastoPauta.id }).from(gastoPauta).where(and(
    eq(gastoPauta.programId, programId),
    eq(gastoPauta.origen, "meta_api"),
    isNotNull(gastoPauta.agendasMeta),
  )).limit(1);
  return fila !== undefined;
}

function completar(
  gasto: number,
  agendasCrm: number,
  agendasMetaLeidas: number | null,
  notas: NotaSemaforo[],
  mideAgendasMeta: boolean,
): CostoPorAgenda {
  const agendasMeta = agendasMetaLeidas === null && mideAgendasMeta ? 0 : agendasMetaLeidas;
  return {
    gasto,
    agendasMeta,
    agendasCrm,
    costo: agendasMeta !== null && agendasMeta > 0 ? gasto / agendasMeta : null,
    notas,
  };
}

async function costoDesdeFotos(
  db: Db,
  args: { programId: string; dia: string; hasta: Date },
): Promise<CostoPorAgenda> {
  const fotos = await db.selectDistinctOn([fotosPauta.campanaId], {
    dia: fotosPauta.fecha,
    monto: fotosPauta.gasto,
    moneda: fotosPauta.moneda,
    agendasMeta: fotosPauta.agendasMeta,
  }).from(fotosPauta).where(and(
    eq(fotosPauta.programId, args.programId),
    eq(fotosPauta.fecha, args.dia),
    lte(fotosPauta.tomadaEn, args.hasta),
  )).orderBy(asc(fotosPauta.campanaId), desc(fotosPauta.tomadaEn));
  const [suma, agendasCrm, mide] = await Promise.all([
    sumarEnCop(db, fotos),
    contarAgendas(db, {
      programId: args.programId,
      desde: args.dia,
      hasta: args.dia,
      creadaHasta: args.hasta,
    }),
    programaMideAgendasMeta(db, args.programId),
  ]);
  return completar(suma.gasto, agendasCrm, suma.agendasMeta, suma.notas, mide);
}

export async function costoPorAgenda(
  db: Db,
  args: { programId: string; dia: string; hasta?: Date },
): Promise<CostoPorAgenda> {
  if (args.hasta || args.dia === hoyEnBogota()) {
    return costoDesdeFotos(db, {
      programId: args.programId,
      dia: args.dia,
      hasta: args.hasta ?? new Date(),
    });
  }
  return costoPorAgendaDeVentana(db, {
    programId: args.programId,
    desde: args.dia,
    hasta: args.dia,
  });
}

export async function costoPorAgendaDeVentana(
  db: Db,
  args: { programId: string; desde: string; hasta: string },
): Promise<CostoPorAgenda> {
  const filas = await db.select({
    dia: gastoPauta.fecha,
    monto: gastoPauta.monto,
    moneda: gastoPauta.moneda,
    agendasMeta: gastoPauta.agendasMeta,
  }).from(gastoPauta).where(and(
    eq(gastoPauta.programId, args.programId),
    gte(gastoPauta.fecha, args.desde),
    lte(gastoPauta.fecha, args.hasta),
    or(
      eq(gastoPauta.origen, "meta_api"),
      and(eq(gastoPauta.origen, "manual"), eq(gastoPauta.area, "paid")),
    ),
  ));
  const [suma, agendasCrm, mide] = await Promise.all([
    sumarEnCop(db, filas),
    contarAgendas(db, {
      programId: args.programId,
      desde: args.desde,
      hasta: args.hasta,
    }),
    programaMideAgendasMeta(db, args.programId),
  ]);
  return completar(suma.gasto, agendasCrm, suma.agendasMeta, suma.notas, mide);
}

/**
 * El costo por agenda de los últimos `dias` días hábiles cerrados (sin hoy): el "valor de hoy" que la
 * plantilla de objetivos (264) pone al lado del umbral. La ventana va de calendario entre el primero y
 * el último, así que un fin de semana en medio también suma su gasto y sus agendas.
 */
export async function costoPorAgendaDeLosUltimosHabiles(
  db: Db,
  args: { programId: string; hoy: string; dias: number },
): Promise<CostoPorAgenda> {
  const hasta = diaHabilAnterior(args.hoy);
  let desde = hasta;
  for (let i = 1; i < args.dias; i++) desde = diaHabilAnterior(desde);
  return costoPorAgendaDeVentana(db, { programId: args.programId, desde, hasta });
}
