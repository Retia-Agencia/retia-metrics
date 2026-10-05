import { and, asc, eq } from "drizzle-orm";
import { cohorts, deals, dealEtapaHistorial, motivos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ETAPAS_EN_ORDEN, ETAPAS_VENDIDAS, type EtapaDeal } from "@/lib/deals/etapas";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { cerradosEn, esReversaDeVenta } from "@/lib/queries/metricas-filtros";
import { tasa, type Rango } from "@/lib/queries/dashboard";
import { vigente } from "@/lib/queries/vigente";

/**
 * Lecturas del embudo por etapas (ticket 065).
 *
 * El programa es frontera obligatoria y el loader solo carga deals vigentes. Los
 * rangos se aplican en memoria sobre dias de calendario de Bogota; los abiertos y
 * la antiguedad sin dueno son fotos de `ahora`, por lo que el rango no los filtra.
 * Cada cifra conserva sus ids para abrir exactamente la lista que la produjo.
 */

export const REGLA_TIEMPO_EN_ETAPA = "Suma todas las veces que el deal estuvo en esta etapa.";

export const PASOS_DE_CONVERSION = [
  "en_gestion",
  "contactado",
  "calificado",
  "agendado",
  "atendido",
  "compromiso_verbal",
  "vendido",
  "ganado_completo",
] as const;

export type PasoConversion = (typeof PASOS_DE_CONVERSION)[number];
export type BucketAntiguedad = "0-7" | "8-30" | "31-90" | ">90";

export interface DealParaEmbudo {
  id: string;
  etapa: EtapaDeal;
  ownerUserId: string | null;
  ownerNombre: string | null;
  createdAt: Date;
  precioUsd: number | null;
  motivoNombre: string | null;
  /** Una cortesía no es una venta (ADR 0071 punto 10): nunca llega a los pasos vendidos. */
  cortesia: boolean;
}

export interface HistorialParaEmbudo {
  id: string;
  dealId: string;
  de: EtapaDeal | null;
  a: EtapaDeal;
  fecha: Date;
}

export interface PasoDeConversion {
  paso: PasoConversion;
  llegaron: number;
  dealIds: string[];
  tasaDesdeAnterior: number | null;
  tasaDesdeEntrada: number | null;
}

export interface LecturaDeConversion {
  entraron: number;
  dealIds: string[];
  pasos: PasoDeConversion[];
}

export interface ConversionPorPuerta {
  puerta: EtapaDeal;
  deals: number;
  dealIds: string[];
}

export interface ConversionEmbudo {
  /**
   * "Setteo No Calificado" ya no es etapa; con el ADR 0069 los no calificados
   * entran por Potencial (parcial) y Registrado (completo sin High), y el ticket
   * 065 pide leer la conversion con y sin ellos, diciendo cual es cual.
   */
  todas: LecturaDeConversion;
  sinNoCalificados: LecturaDeConversion;
  porPuerta: ConversionPorPuerta[];
}

export interface TiempoEnEtapa {
  etapa: EtapaDeal;
  deals: number;
  dealIds: string[];
  promedioDias: number | null;
  dealsConVariosTramos: number;
}

export interface AbiertosPorEtapaYOwner {
  etapa: EtapaDeal;
  ownerUserId: string | null;
  ownerNombre: string | null;
  deals: number;
  dealIds: string[];
}

export interface SinDuenoPorAntiguedad {
  bucket: BucketAntiguedad;
  deals: number;
  dealIds: string[];
}

export interface MotivoDePerdida {
  motivo: string;
  deals: number;
  dealIds: string[];
  ticketPerdidoUsd: number;
  dealsSinTicket: number;
  moneda: "USD";
}

export interface ResultadoEmbudoEtapas {
  conversion: ConversionEmbudo;
  tiempoEnEtapa: TiempoEnEtapa[];
  abiertos: AbiertosPorEtapaYOwner[];
  sinDuenoPorAntiguedad: SinDuenoPorAntiguedad[];
  motivosDePerdida: MotivoDePerdida[];
}

export interface EntradaCalculoEmbudo {
  deals: readonly DealParaEmbudo[];
  historial: readonly HistorialParaEmbudo[];
  idsCerrados: readonly string[];
  rango: Rango;
  ahora: Date;
}

interface EntradaDeal {
  puerta: EtapaDeal;
  instante: Date;
}

const MS_POR_DIA = 86_400_000;
const ETAPAS_ABIERTAS: readonly EtapaDeal[] = ETAPAS_EN_ORDEN.filter(
  (etapa) => etapa !== "ganado_completo" && etapa !== "cierre_perdido",
);
const ETAPAS_DE_TIEMPO = ETAPAS_ABIERTAS;
const BUCKETS: readonly BucketAntiguedad[] = ["0-7", "8-30", "31-90", ">90"];
const indiceEtapa: ReadonlyMap<EtapaDeal, number> = new Map<EtapaDeal, number>(
  ETAPAS_EN_ORDEN.filter((etapa) => etapa !== "cierre_perdido").map((etapa, indice) => [etapa, indice]),
);

/** Calcula todas las lecturas sin acceder a la base. */
export function calcularEmbudoEtapas({
  deals: filasDeal,
  historial: filasHistorial,
  idsCerrados,
  rango,
  ahora,
}: EntradaCalculoEmbudo): ResultadoEmbudoEtapas {
  const historialPorDeal = agruparHistorial(filasHistorial);
  const entradaPorDeal = new Map<string, EntradaDeal>();
  for (const deal of filasDeal) {
    const primera = historialPorDeal.get(deal.id)?.[0];
    entradaPorDeal.set(deal.id, primera
      ? { puerta: primera.a, instante: primera.fecha }
      : { puerta: deal.etapa, instante: deal.createdAt });
  }

  const cohorte = filasDeal.filter((deal) => {
    const dia = diaDeCalendario(entradaPorDeal.get(deal.id)!.instante);
    return dia >= rango.desde && dia <= rango.hasta;
  });
  const sinNoCalificados = cohorte.filter((deal) => {
    const puerta = entradaPorDeal.get(deal.id)!.puerta;
    return puerta !== "potencial" && puerta !== "registrado";
  });

  const porPuerta = [...agrupar(cohorte, (deal) => entradaPorDeal.get(deal.id)!.puerta)]
    .map(([puerta, grupo]) => ({ puerta, deals: grupo.length, dealIds: ids(grupo) }))
    .sort((a, b) => posicion(a.puerta) - posicion(b.puerta));

  const abiertosBase = filasDeal.filter((deal) => ETAPAS_ABIERTAS.includes(deal.etapa));
  const abiertos = [...agrupar(abiertosBase, (deal) => `${deal.etapa}\u0000${deal.ownerUserId ?? ""}`)]
    .map(([, grupo]) => ({
      etapa: grupo[0]!.etapa,
      ownerUserId: grupo[0]!.ownerUserId,
      ownerNombre: grupo[0]!.ownerNombre,
      deals: grupo.length,
      dealIds: ids(grupo),
    }))
    .sort((a, b) => posicion(a.etapa) - posicion(b.etapa) || compararOwner(a, b));

  const sinDueno = abiertosBase.filter((deal) => deal.ownerUserId === null);
  const porAntiguedad = agrupar(sinDueno, (deal) => bucketDeAntiguedad(
    Math.max(0, Math.floor((ahora.getTime() - entradaPorDeal.get(deal.id)!.instante.getTime()) / MS_POR_DIA)),
  ));
  const sinDuenoPorAntiguedad = BUCKETS.map((bucket) => {
    const grupo = porAntiguedad.get(bucket) ?? [];
    return { bucket, deals: grupo.length, dealIds: ids(grupo) };
  });

  const cerrados = new Set(idsCerrados);
  const perdidos = filasDeal.filter((deal) => deal.etapa === "cierre_perdido" && cerrados.has(deal.id));
  const motivosDePerdida = [...agrupar(perdidos, (deal) => deal.motivoNombre ?? "Sin motivo")]
    .map(([motivo, grupo]) => ({
      motivo,
      deals: grupo.length,
      dealIds: ids(grupo),
      ticketPerdidoUsd: grupo.reduce((total, deal) => total + (deal.precioUsd ?? 0), 0),
      dealsSinTicket: grupo.filter((deal) => deal.precioUsd === null).length,
      moneda: "USD" as const,
    }))
    .sort((a, b) => b.deals - a.deals || a.motivo.localeCompare(b.motivo, "es"));

  return {
    conversion: {
      todas: lecturaConversion(cohorte, historialPorDeal),
      sinNoCalificados: lecturaConversion(sinNoCalificados, historialPorDeal),
      porPuerta,
    },
    tiempoEnEtapa: calcularTiempos(filasDeal, historialPorDeal, rango),
    abiertos,
    sinDuenoPorAntiguedad,
    motivosDePerdida,
  };
}

function lecturaConversion(
  cohorte: readonly DealParaEmbudo[],
  historial: ReadonlyMap<string, readonly HistorialParaEmbudo[]>,
): LecturaDeConversion {
  let denominadorAnterior = cohorte.length;
  const pasos = PASOS_DE_CONVERSION.map((paso) => {
    const objetivo: EtapaDeal = paso === "vendido" ? "ganado_parcial" : paso;
    const llegaron = cohorte.filter((deal) => etapaMasLejana(deal, historial.get(deal.id) ?? []) >= posicion(objetivo));
    const fila = {
      paso,
      llegaron: llegaron.length,
      dealIds: ids(llegaron),
      tasaDesdeAnterior: tasa(llegaron.length, denominadorAnterior),
      tasaDesdeEntrada: tasa(llegaron.length, cohorte.length),
    };
    denominadorAnterior = llegaron.length;
    return fila;
  });
  return { entraron: cohorte.length, dealIds: ids(cohorte), pasos };
}

/**
 * La etapa mas lejana a la que llego el deal. Una entrada a Abonado o Completo que una reversa
 * posterior deshizo (anular su abono, ticket 200) no cuenta, y una cortesia no pasa de
 * Compromiso Verbal: los pasos vendidos dicen lo mismo que `vendidosEn`.
 */
function etapaMasLejana(deal: DealParaEmbudo, historial: readonly HistorialParaEmbudo[]): number {
  const ultimaReversa = historial.reduce(
    (ultima, fila) => (esReversaDeVenta(fila.de, fila.a) ? Math.max(ultima, fila.fecha.getTime()) : ultima),
    -Infinity,
  );
  const alcanzadas = [
    deal.etapa,
    ...historial
      // Misma regla que el SQL de `esMovimientoDeVenta`: solo una reversa ESTRICTAMENTE posterior
      // deshace la venta, asi que en un empate de instante la venta se conserva en los dos lados.
      .filter((fila) => !ETAPAS_VENDIDAS.includes(fila.a) || fila.fecha.getTime() >= ultimaReversa)
      .map((fila) => fila.a),
  ];
  const maximo = alcanzadas.reduce((max, etapa) => Math.max(max, posicion(etapa)), -1);
  return deal.cortesia ? Math.min(maximo, posicion("compromiso_verbal")) : maximo;
}

function calcularTiempos(
  filasDeal: readonly DealParaEmbudo[],
  historial: ReadonlyMap<string, readonly HistorialParaEmbudo[]>,
  rango: Rango,
): TiempoEnEtapa[] {
  const acumulados = new Map<EtapaDeal, { dealId: string; ms: number; tramos: number }[]>();
  for (const deal of filasDeal) {
    const filas = historial.get(deal.id) ?? [];
    if (filas.length === 0) continue;

    const porEtapa = new Map<EtapaDeal, { ms: number; tramos: number; ultimaSalida: Date | null; abierto: boolean }>();
    let etapaAbierta = filas[0]!.a;
    let inicio = filas[0]!.fecha;
    for (const fila of filas.slice(1)) {
      if (fila.a === etapaAbierta) continue;
      const valor = porEtapa.get(etapaAbierta) ?? { ms: 0, tramos: 0, ultimaSalida: null, abierto: false };
      valor.ms += fila.fecha.getTime() - inicio.getTime();
      valor.tramos += 1;
      valor.ultimaSalida = fila.fecha;
      porEtapa.set(etapaAbierta, valor);
      etapaAbierta = fila.a;
      inicio = fila.fecha;
    }
    if (deal.etapa === etapaAbierta) {
      const valor = porEtapa.get(etapaAbierta) ?? { ms: 0, tramos: 0, ultimaSalida: null, abierto: false };
      valor.abierto = true;
      porEtapa.set(etapaAbierta, valor);
    }

    for (const [etapa, valor] of porEtapa) {
      if (valor.abierto || !valor.ultimaSalida) continue;
      const diaSalida = diaDeCalendario(valor.ultimaSalida);
      if (diaSalida < rango.desde || diaSalida > rango.hasta) continue;
      const grupo = acumulados.get(etapa) ?? [];
      grupo.push({ dealId: deal.id, ms: valor.ms, tramos: valor.tramos });
      acumulados.set(etapa, grupo);
    }
  }

  return ETAPAS_DE_TIEMPO.map((etapa) => {
    const grupo = acumulados.get(etapa) ?? [];
    return {
      etapa,
      deals: grupo.length,
      dealIds: grupo.map((fila) => fila.dealId),
      promedioDias: grupo.length === 0
        ? null
        : grupo.reduce((total, fila) => total + fila.ms, 0) / grupo.length / MS_POR_DIA,
      dealsConVariosTramos: grupo.filter((fila) => fila.tramos > 1).length,
    };
  });
}

/** Carga las filas del programa y delega todas las reglas al nucleo puro. */
export async function embudoPorEtapas(
  db: Db,
  { programId, rango }: { programId: string; rango: Rango },
  ahora: Date = new Date(),
): Promise<ResultadoEmbudoEtapas> {
  const [filasDeal, filasHistorial, idsCerrados] = await Promise.all([
    db.select({
      id: deals.id,
      etapa: deals.etapa,
      ownerUserId: deals.ownerUserId,
      ownerNombre: users.nombre,
      ownerEmail: users.email,
      createdAt: deals.createdAt,
      precioUsd: cohorts.precioUsd,
      motivoNombre: motivos.nombre,
      cortesia: deals.cortesia,
    })
      .from(deals)
      .leftJoin(users, eq(users.id, deals.ownerUserId))
      .leftJoin(cohorts, eq(cohorts.id, deals.cohortId))
      .leftJoin(motivos, eq(motivos.id, deals.motivoId))
      .where(and(eq(deals.programId, programId), vigente(deals))),
    db.select({
      id: dealEtapaHistorial.id,
      dealId: dealEtapaHistorial.dealId,
      de: dealEtapaHistorial.de,
      a: dealEtapaHistorial.a,
      fecha: dealEtapaHistorial.fecha,
    })
      .from(dealEtapaHistorial)
      .innerJoin(deals, and(
        eq(deals.id, dealEtapaHistorial.dealId),
        eq(deals.programId, programId),
        vigente(deals),
      ))
      .orderBy(asc(dealEtapaHistorial.fecha), asc(dealEtapaHistorial.id)),
    cerradosEn(db, programId, rango),
  ]);

  return calcularEmbudoEtapas({
    deals: filasDeal.map((deal) => ({
      id: deal.id,
      etapa: deal.etapa,
      ownerUserId: deal.ownerUserId,
      ownerNombre: deal.ownerNombre ?? deal.ownerEmail ?? null,
      createdAt: deal.createdAt,
      precioUsd: deal.precioUsd === null ? null : Number(deal.precioUsd),
      motivoNombre: deal.motivoNombre,
      cortesia: deal.cortesia,
    })),
    historial: filasHistorial,
    idsCerrados,
    rango,
    ahora,
  });
}

function agrupar<T, K>(filas: readonly T[], clave: (fila: T) => K): Map<K, T[]> {
  const grupos = new Map<K, T[]>();
  for (const fila of filas) {
    const key = clave(fila);
    const grupo = grupos.get(key) ?? [];
    grupo.push(fila);
    grupos.set(key, grupo);
  }
  return grupos;
}

function agruparHistorial(filas: readonly HistorialParaEmbudo[]): Map<string, HistorialParaEmbudo[]> {
  const grupos = agrupar(filas, (fila) => fila.dealId);
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id.localeCompare(b.id));
  }
  return grupos;
}

function ids(filas: readonly DealParaEmbudo[]): string[] {
  return filas.map((deal) => deal.id);
}

function posicion(etapa: EtapaDeal): number {
  return indiceEtapa.get(etapa) ?? -1;
}

function compararOwner(a: AbiertosPorEtapaYOwner, b: AbiertosPorEtapaYOwner): number {
  if (a.ownerUserId === null) return b.ownerUserId === null ? 0 : 1;
  if (b.ownerUserId === null) return -1;
  return (a.ownerNombre ?? "").localeCompare(b.ownerNombre ?? "", "es");
}

function bucketDeAntiguedad(dias: number): BucketAntiguedad {
  if (dias <= 7) return "0-7";
  if (dias <= 30) return "8-30";
  if (dias <= 90) return "31-90";
  return ">90";
}
