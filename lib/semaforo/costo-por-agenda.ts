import { and, asc, desc, eq, gte, isNotNull, lte, or } from "drizzle-orm";
import { razon, type RazonConCobertura } from "@/lib/cobertura";
import { fotosPauta, gastoPauta, pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilAnterior } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";
import { coberturaDeGasto, diaCubierto, motivoDeGasto } from "@/lib/pauta/cobertura-de-gasto";
import { convertirGasto } from "@/lib/pauta/convertir-gasto";
import * as agenda from "@/lib/queries/hechos/agenda";
import { sumarDias } from "@/lib/rangos";
import { tasasDelRango } from "@/lib/trm/consultar";
import { codigoCortoDeCampana, idsDeCampanas, type PropositoCampana } from "@/lib/pauta/proposito";

export interface NotaSemaforo {
  tipo: "problema" | "info";
  texto: string;
}

export interface CampanaSemaforo {
  codigo: string | null;
  nombre: string;
  activa: boolean;
  gasto: number;
  agendasMeta: number | null;
  costo: number | null;
  registrosMeta: number | null;
  costoPorRegistro: number | null;
  proposito: PropositoCampana | null;
}

export interface CostoPorAgenda {
  gasto: number;
  agendasMeta: number | null;
  agendasCrm: number;
  costo: number | null;
  costoCobertura: RazonConCobertura;
  campanas: CampanaSemaforo[];
  lanzamiento: {
    gasto: number;
    registrosMeta: number | null;
    costoPorRegistro: number | null;
    campanas: CampanaSemaforo[];
  };
  gastoTotal: number;
  notas: NotaSemaforo[];
}

type FilaDeGasto = {
  dia: string;
  monto: string;
  moneda: string;
  agendasMeta: number | null;
  registrosMeta: number | null;
  campanaId: string | null;
  campanaIdMeta: string | null;
  campanaNombre: string | null;
  campanaEstado: string | null;
  proposito: PropositoCampana | null;
};

async function sumarEnCop(db: Db, filas: FilaDeGasto[], idsCampanas: readonly string[]): Promise<{
  gasto: number;
  gastoTotal: number;
  agendasMeta: number | null;
  campanas: Array<{
    id: string;
    nombre: string;
    activa: boolean;
    gasto: number;
    agendasMeta: number | null;
    registrosMeta: number | null;
    codigo: string | null;
    proposito: PropositoCampana | null;
  }>;
  lanzamiento: { gasto: number; registrosMeta: number | null; campanas: Array<{
    id: string;
    nombre: string;
    activa: boolean;
    gasto: number;
    agendasMeta: number | null;
    registrosMeta: number | null;
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
  let registrosMetaLanzamiento = 0;
  let tieneRegistrosMetaLanzamiento = false;
  const sinTrm = new Map<string, number>();
  const desde = filas.reduce<string | null>((menor, fila) => menor === null || fila.dia < menor ? fila.dia : menor, null);
  const hasta = filas.reduce<string | null>((mayor, fila) => mayor === null || fila.dia > mayor ? fila.dia : mayor, null);
  const tasas = desde === null || hasta === null
    ? { porDia: new Map<string, number>() }
    : await tasasDelRango(db, desde, hasta);
  const convertidos = convertirGasto(filas, tasas.porDia, "COP");
  const campanas = new Map<string, {
    idMeta: string;
    nombre: string;
    activa: boolean;
    proposito: PropositoCampana | null;
    gasto: number;
    agendasMeta: number;
    tieneAgendasMeta: boolean;
    registrosMeta: number;
    tieneRegistrosMeta: boolean;
  }>();

  for (const [i, fila] of filas.entries()) {
    const esLanzamiento = fila.proposito === "lanzamiento";
    const claveCampana = fila.campanaId ?? "sin-campana";
    const campana = campanas.get(claveCampana) ?? {
      idMeta: fila.campanaIdMeta ?? "",
      nombre: fila.campanaNombre ?? "Sin campaña",
      activa: fila.campanaId === null || fila.campanaEstado === "ACTIVE",
      proposito: fila.campanaId ? fila.proposito : "agenda",
      gasto: 0,
      agendasMeta: 0,
      tieneAgendasMeta: false,
      registrosMeta: 0,
      tieneRegistrosMeta: false,
    };
    const convertido = convertidos.montos[i];
    const montoCop = convertido ?? 0;
    if (convertido === null) sinTrm.set(fila.dia, (sinTrm.get(fila.dia) ?? 0) + 1);
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
    if (fila.registrosMeta !== null) {
      campana.registrosMeta += fila.registrosMeta;
      campana.tieneRegistrosMeta = true;
      if (esLanzamiento) {
        registrosMetaLanzamiento += fila.registrosMeta;
        tieneRegistrosMetaLanzamiento = true;
      }
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
    activa: campana.activa,
    gasto: campana.gasto,
    agendasMeta: campana.tieneAgendasMeta ? campana.agendasMeta : null,
    registrosMeta: campana.tieneRegistrosMeta ? campana.registrosMeta : null,
    codigo: campana.idMeta ? codigoCortoDeCampana(campana.idMeta, idsCampanas) : null,
    proposito: campana.proposito,
  }));
  return {
    gasto, gastoTotal,
    agendasMeta: tieneAgendasMeta ? agendasMeta : null,
    campanas: todas.filter((campana) => campana.proposito !== "lanzamiento"),
    lanzamiento: {
      gasto: gastoLanzamiento,
      registrosMeta: tieneRegistrosMetaLanzamiento ? registrosMetaLanzamiento : null,
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
  cobertura: { base: number; faltan: number; motivo: string | null; calculable: boolean },
): CostoPorAgenda {
  const agendasMeta = agendasMetaLeidas === null && mideAgendasMeta ? 0 : agendasMetaLeidas;
  const costoCobertura = razon(gasto, agendasMeta ?? 0, cobertura);
  return {
    gasto,
    agendasMeta,
    agendasCrm,
    costo: costoCobertura.valor,
    costoCobertura,
    campanas: campanasLeidas
      .map((campana) => {
        const agendas = campana.agendasMeta === null && mideAgendasMeta ? 0 : campana.agendasMeta;
        return {
          codigo: campana.codigo,
          nombre: campana.nombre,
          activa: campana.activa,
          gasto: campana.gasto,
          agendasMeta: agendas,
          costo: agendas !== null && agendas > 0 ? campana.gasto / agendas : null,
          registrosMeta: campana.registrosMeta,
          costoPorRegistro: campana.registrosMeta !== null && campana.registrosMeta > 0
            ? campana.gasto / campana.registrosMeta
            : null,
          proposito: campana.proposito,
        };
      })
      .filter((campana) => campana.gasto > 0)
      .sort((a, b) => b.gasto - a.gasto),
    lanzamiento: {
      gasto: lanzamientoLeido.gasto,
      registrosMeta: lanzamientoLeido.registrosMeta,
      costoPorRegistro: lanzamientoLeido.registrosMeta !== null && lanzamientoLeido.registrosMeta > 0
        ? lanzamientoLeido.gasto / lanzamientoLeido.registrosMeta
        : null,
      // Campo por campo, como las de agenda: el `id` interno no sale (el contrato del semáforo es estricto).
      campanas: lanzamientoLeido.campanas.map((campana) => ({
        codigo: campana.codigo,
        nombre: campana.nombre,
        activa: campana.activa,
        gasto: campana.gasto,
        agendasMeta: campana.agendasMeta,
        costo: null,
        registrosMeta: campana.registrosMeta,
        costoPorRegistro: campana.registrosMeta !== null && campana.registrosMeta > 0
          ? campana.gasto / campana.registrosMeta
          : null,
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
    registrosMeta: fotosPauta.registrosMeta,
    campanaId: fotosPauta.campanaId,
    campanaIdMeta: pautaObjetos.idMeta,
    campanaNombre: pautaObjetos.nombre,
    campanaEstado: pautaObjetos.estado,
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
  return completar(suma.gasto, agendasCrm, suma.agendasMeta, suma.notas, mide, suma.campanas, suma.lanzamiento, suma.gastoTotal,
    { base: 1, faltan: 0, motivo: null, calculable: true });
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
    registrosMeta: gastoPauta.registrosMeta,
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
    estado: pautaObjetos.estado,
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
      campanaEstado: campana?.nivel === "campana" ? campana.estado : null,
      proposito: campana?.nivel === "campana" ? campana.proposito : null,
    };
  });
  const [idsCampanas, agendasCrm, mide, coberturaGasto] = await Promise.all([
    idsDeCampanas(db),
    contarAgendas(db, {
      programId: args.programId,
      desde: args.desde,
      hasta: args.hasta,
    }),
    programaMideAgendasMeta(db, args.programId),
    coberturaDeGasto(db, args.programId, { desde: args.desde, hasta: args.hasta }),
  ]);
  const suma = await sumarEnCop(db, filasConCampana, idsCampanas);
  let base = 0;
  let faltan = 0;
  for (let dia = args.desde; dia <= args.hasta; dia = sumarDias(dia, 1)) {
    if (diaCubierto(dia, coberturaGasto)) base++;
    else faltan++;
  }
  return completar(suma.gasto, agendasCrm, suma.agendasMeta, suma.notas, mide, suma.campanas, suma.lanzamiento, suma.gastoTotal,
    { base, faltan, motivo: faltan > 0 ? motivoDeGasto(coberturaGasto) : null, calculable: faltan === 0 });
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
