import { and, eq, inArray, lte } from "drizzle-orm";
import { calls, deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Alcance } from "@/lib/queries/dashboard";
import {
  fechaAnclaCall,
  filtroDealsCreados,
  filtroDealsDesde,
  filtroDealsQueAgendaron,
  llamadaOcurrio,
  ventasConDiaEn,
  type OrigenDeDeal,
} from "@/lib/queries/metricas-filtros";
import { vigente } from "@/lib/queries/vigente";

export type OrigenEmbudoComercial = OrigenDeDeal | "manual";
export type PasoEmbudoComercial = "creados" | "agendaron" | "tuvieron_show" | "compraron";

export interface DealParaEmbudoComercial {
  dealId: string;
  origen: OrigenEmbudoComercial;
  agendo: boolean;
  tuvoShow: boolean;
  compro: boolean;
}

export interface PasoDelEmbudoComercial {
  paso: PasoEmbudoComercial;
  cantidad: number;
  dealIds: string[];
  pctDelPaso: number | null;
  perdidos: number;
}

export const METRICAS_DEL_EMBUDO_COMERCIAL = [
  "embudo_comercial_creados",
  "embudo_comercial_agendaron",
  "embudo_comercial_shows",
  "embudo_comercial_compraron",
] as const;
export type MetricaDelEmbudoComercial = (typeof METRICAS_DEL_EMBUDO_COMERCIAL)[number];

export function esMetricaDelEmbudoComercial(metrica: string): metrica is MetricaDelEmbudoComercial {
  return (METRICAS_DEL_EMBUDO_COMERCIAL as readonly string[]).includes(metrica);
}

/** Un solo universo: cada paso es un subconjunto del anterior y puede filtrarse por origen. */
export function pasosDelEmbudoComercial(
  dealsDelRango: readonly DealParaEmbudoComercial[],
  origen?: OrigenEmbudoComercial,
): PasoDelEmbudoComercial[] {
  const creados = dealsDelRango.filter((deal) => origen === undefined || deal.origen === origen);
  const grupos: Array<{ paso: PasoEmbudoComercial; deals: DealParaEmbudoComercial[] }> = [
    { paso: "creados", deals: creados },
    { paso: "agendaron", deals: creados.filter((deal) => deal.agendo) },
    { paso: "tuvieron_show", deals: creados.filter((deal) => deal.agendo && deal.tuvoShow) },
    { paso: "compraron", deals: creados.filter((deal) => deal.agendo && deal.tuvoShow && deal.compro) },
  ];
  return grupos.map(({ paso, deals }, indice) => {
    const anterior = indice === 0 ? deals.length : grupos[indice - 1]!.deals.length;
    return {
      paso,
      cantidad: deals.length,
      dealIds: deals.map((deal) => deal.dealId),
      pctDelPaso: anterior === 0 ? null : deals.length / anterior,
      perdidos: anterior - deals.length,
    };
  });
}

/** Carga los hechos una vez y delega la aritmética al núcleo puro. */
export async function cargarEmbudoComercial(
  db: Db,
  alcance: Alcance,
  origen?: OrigenEmbudoComercial,
): Promise<PasoDelEmbudoComercial[]> {
  const ventasDelRango = ventasConDiaEn(db, alcance.rango).as("ventas_embudo_comercial");
  const base = () => db.select({ dealId: deals.id })
    .from(deals)
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(filtroDealsCreados(alcance), vigente(deals)));

  const [creados, completos, parciales, agendaron, shows, ventas] = await Promise.all([
    base(),
    db.select({ dealId: deals.id }).from(deals)
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(and(filtroDealsDesde("completo", alcance), vigente(deals))),
    db.select({ dealId: deals.id }).from(deals)
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(and(filtroDealsDesde("parcial", alcance), vigente(deals))),
    db.select({ dealId: deals.id }).from(deals)
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(and(filtroDealsQueAgendaron(alcance, db), vigente(deals))),
    db.selectDistinct({ dealId: calls.dealId }).from(calls).where(and(
      inArray(calls.dealId, creadosIdsSubquery(db, alcance)),
      lte(fechaAnclaCall(), alcance.rango.hasta),
      llamadaOcurrio(),
      vigente(calls),
    )),
    db.select({ dealId: ventasDelRango.dealId }).from(ventasDelRango),
  ]);

  const idsCompletos = new Set(completos.map((fila) => fila.dealId));
  const idsParciales = new Set(parciales.map((fila) => fila.dealId));
  const idsAgendaron = new Set(agendaron.map((fila) => fila.dealId));
  const idsShows = new Set(shows.flatMap((fila) => fila.dealId ? [fila.dealId] : []));
  const idsVentas = new Set(ventas.map((fila) => fila.dealId));

  return pasosDelEmbudoComercial(creados.map(({ dealId }) => ({
    dealId,
    origen: idsCompletos.has(dealId) ? "completo" : idsParciales.has(dealId) ? "parcial" : "manual",
    agendo: idsAgendaron.has(dealId),
    tuvoShow: idsShows.has(dealId),
    compro: idsVentas.has(dealId),
  })), origen);
}

function creadosIdsSubquery(db: Db, alcance: Alcance) {
  return db.select({ dealId: deals.id })
    .from(deals)
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(filtroDealsCreados(alcance), vigente(deals)));
}
