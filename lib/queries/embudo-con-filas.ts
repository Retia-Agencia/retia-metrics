import type { Db } from "@/lib/db/tipos";
import { ETAPAS_EN_ORDEN, type EtapaDeal } from "@/lib/deals/etapas";
import { diaDeCalendario } from "@/lib/dias-habiles";
import type { Rango } from "@/lib/queries/dashboard";
import {
  calcularEmbudoEtapas,
  cargarEntradaDelEmbudo,
  entradasAlEmbudo,
  PASOS_DE_CONVERSION,
  type BucketAntiguedad,
  type ResultadoEmbudoEtapas,
} from "@/lib/queries/embudo-etapas";

/**
 * Qué deals forman cada cifra del embudo por etapas (ticket 188, ADR 0067).
 *
 * La cifra y su lista salen del MISMO cálculo (`calcularEmbudoEtapas` sobre lo que carga
 * `cargarEntradaDelEmbudo`): la lista no tiene un filtro propio que pueda discrepar. Los ids
 * no viajan en la URL; la lista se recalcula con la métrica, la etapa (o el paso) y el rango.
 */
export const METRICAS_DE_EMBUDO = [
  "etapa_entraron",
  "etapa_paso",
  "etapa_tiempo",
  "etapa_abiertos",
  "etapa_sin_dueno",
] as const;
export type MetricaDeEmbudo = (typeof METRICAS_DE_EMBUDO)[number];

/** Las métricas del embudo que son una foto de hoy: el periodo no las acota. */
export const METRICAS_DE_EMBUDO_SIN_PERIODO: readonly MetricaDeEmbudo[] = ["etapa_abiertos", "etapa_sin_dueno"];

export const BUCKETS_DE_ANTIGUEDAD: readonly BucketAntiguedad[] = ["0-7", "8-30", "31-90", ">90"];

export function esMetricaDeEmbudo(metrica: string): metrica is MetricaDeEmbudo {
  return (METRICAS_DE_EMBUDO as readonly string[]).includes(metrica);
}

/**
 * Qué parte del embudo pide la lista: el paso (`etapa_paso`), la etapa (`etapa_tiempo`,
 * `etapa_abiertos`) o el tramo de antigüedad (`etapa_sin_dueno`).
 */
export interface SubconjuntoDelEmbudo {
  etapa?: string;
  antiguedad?: string;
}

/** Un deal de la cifra, con lo que la lista muestra de él. */
export interface MiembroDelEmbudo {
  dealId: string;
  /** El día (Bogotá) en que el deal entró al embudo: de ahí sale su antigüedad en la lista. */
  fecha: string;
  closer: string | null;
  /** La clave del dueño (ticket 167): su `users.id`; sin dueño, la clave histórica vacía del SQL. */
  claveCloser: string;
  etapa: EtapaDeal;
}

/** La clave de un deal sin dueño: lo que da `claveCloserSql(users.id, users.closerId)` sin usuario. */
export const CLAVE_SIN_DUENO = "historico:";

export interface EmbudoConMiembros {
  resultado: ResultadoEmbudoEtapas;
  miembro: (dealId: string) => MiembroDelEmbudo;
}

/** Carga el embudo UNA vez y deja a mano cómo se lee cada uno de sus deals. */
export async function leerEmbudoConMiembros(
  db: Db,
  alcance: { programId: string; rango: Rango },
  ahora: Date = new Date(),
): Promise<EmbudoConMiembros> {
  const entrada = await cargarEntradaDelEmbudo(db, alcance, ahora);
  const resultado = calcularEmbudoEtapas(entrada);
  const entradas = entradasAlEmbudo(entrada.deals, entrada.historial);
  const porId = new Map(entrada.deals.map((deal) => [deal.id, deal]));
  return {
    resultado,
    miembro: (dealId) => {
      const deal = porId.get(dealId)!;
      return {
        dealId,
        fecha: diaDeCalendario(entradas.get(dealId)!),
        closer: deal.ownerNombre,
        claveCloser: deal.ownerUserId ?? CLAVE_SIN_DUENO,
        etapa: deal.etapa,
      };
    },
  };
}

function esEtapa(valor: string | undefined): valor is EtapaDeal {
  return (ETAPAS_EN_ORDEN as readonly string[]).includes(valor ?? "");
}

/**
 * Los ids de UNA cifra del embudo. Un subconjunto que no existe (un paso inventado, una etapa
 * que no es del embudo) da una lista vacía, nunca el embudo entero.
 */
export function idsDeLaCifra(
  resultado: ResultadoEmbudoEtapas,
  metrica: MetricaDeEmbudo,
  { etapa, antiguedad }: SubconjuntoDelEmbudo,
): string[] {
  switch (metrica) {
    case "etapa_entraron":
      return resultado.conversion.todas.dealIds;
    case "etapa_paso":
      return (PASOS_DE_CONVERSION as readonly string[]).includes(etapa ?? "")
        ? resultado.conversion.todas.pasos.find((paso) => paso.paso === etapa)!.dealIds
        : [];
    case "etapa_tiempo":
      return esEtapa(etapa) ? (resultado.tiempoEnEtapa.find((fila) => fila.etapa === etapa)?.dealIds ?? []) : [];
    case "etapa_abiertos":
      // El dueño no es parte del subconjunto: la celda "etapa × owner" lo pide con el filtro de
      // closer de la lista, el mismo código opaco de toda lista (ADR 0067).
      return esEtapa(etapa)
        ? resultado.abiertos.filter((fila) => fila.etapa === etapa).flatMap((fila) => fila.dealIds)
        : [];
    case "etapa_sin_dueno":
      return resultado.sinDuenoPorAntiguedad.find((fila) => fila.bucket === antiguedad)?.dealIds ?? [];
  }
}

/** Los deals de la cifra, más antiguos primero (como toda lista), acotados al closer si lo hay. */
export function miembrosDeLaCifra(
  embudo: EmbudoConMiembros,
  metrica: MetricaDeEmbudo,
  subconjunto: SubconjuntoDelEmbudo,
  claveCloser?: string | null,
): MiembroDelEmbudo[] {
  return idsDeLaCifra(embudo.resultado, metrica, subconjunto)
    .map(embudo.miembro)
    .filter((m) => !claveCloser || m.claveCloser === claveCloser)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.dealId.localeCompare(b.dealId));
}
