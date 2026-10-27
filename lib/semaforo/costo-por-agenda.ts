import { and, asc, desc, eq, gte, isNotNull, lte, or } from "drizzle-orm";
import { fotosPauta, gastoPauta, pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilAnterior } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";
import * as agenda from "@/lib/queries/hechos/agenda";
import { tasaDelDia } from "@/lib/trm/consultar";
import { codigoCortoDeCampana, idsDeCampanas, type PropositoCampana } from "@/lib/pauta/proposito";

export interface NotaSemaforo {
  tipo: "problema" | "info";
  texto: string;
}

export interface CampanaSemaforo {
  codigo: string | null;
  nombre: string;
  gasto: number;
  agendasMeta: number | null;
  costo: number | null;
  proposito: PropositoCampana | null;
}

export interface CostoPorAgenda {
  gasto: number;
  agendasMeta: number | null;
  agendasCrm: number;
  costo: number | null;
  campanas: CampanaSemaforo[];
  lanzamiento: { gasto: number; campanas: CampanaSemaforo[] };
  gastoTotal: number;
  notas: NotaSemaforo[];
}

type FilaDeGasto = {
  dia: string;
  monto: string;
  moneda: string;
  agendasMeta: number | null;
  campanaId: string | null;
  campanaIdMeta: string | null;
  campanaNombre: string | null;
  proposito: PropositoCampana | null;
};

async function sumarEnCop(db: Db, filas: FilaDeGasto[], idsCampanas: readonly string[]): Promise<{
  gasto: number;
  gastoTotal: number;
  agendasMeta: number | null;
  campanas: Array<{
    id: string;
    nombre: string;
    gasto: number;
    agendasMeta: number | null;
    codigo: string | null;
    proposito: PropositoCampana | null;
  }>;
  lanzamiento: { gasto: number; campanas: Array<{
    id: string;
    nombre: string;
    gasto: number;
    agendasMeta: number | null;
    codigo: string | null;
    proposito: PropositoCampana | null;
  }> };
  notas: NotaSemaforo[];
}> {
  let gasto = 0;
  let gastoTotal = 0;
  let gastoLanzamiento = 0;
  let agendasMeta = 0;
  let tieneAgendasMeta = false;
  const sinTrm = new Map<string, number>();
  const tasas = new Map<string, number | null>();
  const campanas = new Map<string, {
    idMeta: string;
    nombre: string;
    proposito: PropositoCampana | null;
    gasto: number;
    agendasMeta: number;
    tieneAgendasMeta: boolean;
  }>();

  for (const fila of filas) {
    const monto = Number(fila.monto);
    const esLanzamiento = fila.proposito === "lanzamiento";
    const claveCampana = fila.campanaId ?? "sin-campana";
    const campana = campanas.get(claveCampana) ?? {
      idMeta: fila.campanaIdMeta ?? "",
      nombre: fila.campanaNombre ?? "Sin campaña",
      proposito: fila.campanaId ? fila.proposito : "agenda",
      gasto: 0,
      agendasMeta: 0,
      tieneAgendasMeta: false,
    };
    let montoCop = 0;
    if (fila.moneda === "COP") {
      montoCop = monto;
    } else {
      if (!tasas.has(fila.dia)) {
        tasas.set(fila.dia, (await tasaDelDia(db, fila.dia))?.pesosPorDolar ?? null);
      }
      const tasa = tasas.get(fila.dia);
      if (tasa === null || tasa === undefined) {
        sinTrm.set(fila.dia, (sinTrm.get(fila.dia) ?? 0) + 1);
      } else {
        montoCop = monto * tasa;
      }
    }
    gastoTotal += montoCop;
    if (esLanzamiento) gastoLanzamiento += montoCop;
    else gasto += montoCop;
    campana.gasto += montoCop;
    if (!esLanzamiento && fila.agendasMeta !== null) {
      agendasMeta += fila.agendasMeta;
      tieneAgendasMeta = true;
    }
    if (fila.agendasMeta !== null) {
      campana.agendasMeta += fila.agendasMeta;
      campana.tieneAgendasMeta = true;
    }
    campanas.set(claveCampana, campana);
  }

  const notas: NotaSemaforo[] = [];
  for (const [dia, cantidad] of sinTrm) {
    notas.push({
      tipo: "problema",
      texto: `Sin TRM del ${dia}: ${cantidad} filas en USD no se sumaron.`,
    });
  }
  const todas = [...campanas].map(([id, campana]) => ({
    id,
    nombre: campana.nombre,
    gasto: campana.gasto,
    agendasMeta: campana.tieneAgendasMeta ? campana.agendasMeta : null,
    codigo: campana.idMeta ? codigoCortoDeCampana(campana.idMeta, idsCampanas) : null,
    proposito: campana.proposito,
  }));
  return {
    gasto, gastoTotal,
    agendasMeta: tieneAgendasMeta ? agendasMeta : null,
    campanas: todas.filter((campana) => campana.proposito !== "lanzamiento"),
    lanzamiento: {
      gasto: gastoLanzamiento,
      campanas: todas.filter((campana) => campana.proposito === "lanzamiento"),
    },
    notas,
  };
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
  campanasLeidas: Awaited<ReturnType<typeof sumarEnCop>>["campanas"],
  lanzamientoLeido: Awaited<ReturnType<typeof sumarEnCop>>["lanzamiento"],
  gastoTotal: number,
): CostoPorAgenda {
  const agendasMeta = agendasMetaLeidas === null && mideAgendasMeta ? 0 : agendasMetaLeidas;
  return {
    gasto,
    agendasMeta,
    agendasCrm,
    costo: agendasMeta !== null && agendasMeta > 0 ? gasto / agendasMeta : null,
    campanas: campanasLeidas
      .map((campana) => {
        const agendas = campana.agendasMeta === null && mideAgendasMeta ? 0 : campana.agendasMeta;
        return {
          codigo: campana.codigo,
          nombre: campana.nombre,
          gasto: campana.gasto,
          agendasMeta: agendas,
          costo: agendas !== null && agendas > 0 ? campana.gasto / agendas : null,
          proposito: campana.proposito,
        };
      })
      .filter((campana) => campana.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto),
    lanzamiento: {
      gasto: lanzamientoLeido.gasto,
      // Campo por campo, como las de agenda: el `id` interno no sale (el contrato del semáforo es estricto).
      campanas: lanzamientoLeido.campanas.map((campana) => ({
        codigo: campana.codigo,
        nombre: campana.nombre,
        gasto: campana.gasto,
        agendasMeta: campana.agendasMeta,
        costo: null,
        proposito: campana.proposito,
      })).filter((campana) => campana.gasto > 0).sort((a, b) => b.gasto - a.gasto),
    },
    gastoTotal,
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
    campanaId: fotosPauta.campanaId,
    campanaIdMeta: pautaObjetos.idMeta,
    campanaNombre: pautaObjetos.nombre,
    proposito: pautaObjetos.proposito,
  }).from(fotosPauta).where(and(
    eq(fotosPauta.programId, args.programId),
    eq(fotosPauta.fecha, args.dia),
    lte(fotosPauta.tomadaEn, args.hasta),
  )).innerJoin(pautaObjetos, eq(fotosPauta.campanaId, pautaObjetos.id))
    .orderBy(asc(fotosPauta.campanaId), desc(fotosPauta.tomadaEn));
  const [idsCampanas, agendasCrm, mide] = await Promise.all([
    idsDeCampanas(db),
    contarAgendas(db, {
      programId: args.programId,
      desde: args.dia,
      hasta: args.dia,
      creadaHasta: args.hasta,
    }),
    programaMideAgendasMeta(db, args.programId),
  ]);
  const suma = await sumarEnCop(db, fotos, idsCampanas);
  return completar(suma.gasto, agendasCrm, suma.agendasMeta, suma.notas, mide, suma.campanas, suma.lanzamiento, suma.gastoTotal);
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
    pautaObjetoId: gastoPauta.pautaObjetoId,
  }).from(gastoPauta).where(and(
    eq(gastoPauta.programId, args.programId),
    gte(gastoPauta.fecha, args.desde),
    lte(gastoPauta.fecha, args.hasta),
    or(
      eq(gastoPauta.origen, "meta_api"),
      and(eq(gastoPauta.origen, "manual"), eq(gastoPauta.area, "paid")),
    ),
  ));
  const objetos = await db.select({
    id: pautaObjetos.id,
    idMeta: pautaObjetos.idMeta,
    nivel: pautaObjetos.nivel,
    padreIdMeta: pautaObjetos.padreIdMeta,
    nombre: pautaObjetos.nombre,
    proposito: pautaObjetos.proposito,
  }).from(pautaObjetos).where(eq(pautaObjetos.programId, args.programId));
  const objetosPorId = new Map(objetos.map((objeto) => [objeto.id, objeto]));
  const objetosPorIdMeta = new Map(objetos.map((objeto) => [objeto.idMeta, objeto]));
  const filasConCampana: FilaDeGasto[] = filas.map((fila) => {
    const anuncio = fila.pautaObjetoId ? objetosPorId.get(fila.pautaObjetoId) : undefined;
    const conjunto = anuncio?.nivel === "anuncio" && anuncio.padreIdMeta
      ? objetosPorIdMeta.get(anuncio.padreIdMeta)
      : undefined;
    const campana = conjunto?.nivel === "conjunto" && conjunto.padreIdMeta
      ? objetosPorIdMeta.get(conjunto.padreIdMeta)
      : undefined;
    return {
      ...fila,
      campanaId: campana?.nivel === "campana" ? campana.id : null,
      campanaIdMeta: campana?.nivel === "campana" ? campana.idMeta : null,
      campanaNombre: campana?.nivel === "campana" ? campana.nombre : null,
      proposito: campana?.nivel === "campana" ? campana.proposito : null,
    };
  });
  const [idsCampanas, agendasCrm, mide] = await Promise.all([
    idsDeCampanas(db),
    contarAgendas(db, {
      programId: args.programId,
      desde: args.desde,
      hasta: args.hasta,
    }),
    programaMideAgendasMeta(db, args.programId),
  ]);
  const suma = await sumarEnCop(db, filasConCampana, idsCampanas);
  return completar(suma.gasto, agendasCrm, suma.agendasMeta, suma.notas, mide, suma.campanas, suma.lanzamiento, suma.gastoTotal);
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
