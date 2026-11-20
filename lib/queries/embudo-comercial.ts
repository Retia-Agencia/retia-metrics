import { and, eq, inArray, lte } from "drizzle-orm";
import { calls, deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import type { Area } from "@/lib/atribucion/canal";
import type { Alcance } from "@/lib/queries/dashboard";
import { dimensionesDeOrigen } from "@/lib/queries/hechos/origen";
import {
  fechaAnclaCall,
  filtroDealsCreados,
  filtroDealsDesde,
  filtroDealsQueAgendaron,
  llamadaOcurrio,
  ventasConDiaEn,
  type OrigenDeDeal,
} from "@/lib/queries/metricas-filtros";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

export type OrigenEmbudoComercial = OrigenDeDeal | "manual";
export type AreaEmbudoComercial = Area;
export type PasoEmbudoComercial = "creados" | "agendaron" | "tuvieron_show" | "compraron";

export interface DealParaEmbudoComercial {
  dealId: string;
  origen: OrigenEmbudoComercial;
  area: string | null;
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
  composicion?: { completo: number; parcial: number; manual: number };
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
  area?: AreaEmbudoComercial,
): PasoDelEmbudoComercial[] {
  const creados = dealsDelRango.filter((deal) =>
    (origen === undefined || deal.origen === origen) && (area === undefined || deal.area === area));
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
      ...(paso === "creados" ? { composicion: {
        completo: deals.filter((deal) => deal.origen === "completo").length,
        parcial: deals.filter((deal) => deal.origen === "parcial").length,
        manual: deals.filter((deal) => deal.origen === "manual").length,
      } } : {}),
    };
  });
}

/** Carga los hechos una vez y delega la aritmética al núcleo puro. */
export function cargarEmbudoComercial(
  db: Db,
  alcance: Alcance,
  origen?: OrigenEmbudoComercial,
  area?: AreaEmbudoComercial,
): Promise<PasoDelEmbudoComercial[]> {
  return dealsDelEmbudoComercial(db, alcance).then((filas) => pasosDelEmbudoComercial(filas, origen, area));
}

async function dealsDelEmbudoComercial(
  db: Db,
  alcance: Alcance,
): Promise<DealParaEmbudoComercial[]> {
  return unaVezPorSolicitud(db, claveDe("dealsDelEmbudoComercial", alcance.programId, alcance.rango.desde,
    alcance.rango.hasta, alcance.claveCloser, alcance.cohorteId), () => leerDealsDelEmbudoComercial(db, alcance));
}

async function leerDealsDelEmbudoComercial(
  db: Db,
  alcance: Alcance,
): Promise<DealParaEmbudoComercial[]> {
  const ventasDelRango = ventasConDiaEn(db, alcance.rango).as("ventas_embudo_comercial");
  const { area: areaDelDeal } = dimensionesDeOrigen(
    submissions.id, submissions.utmSource, submissions.utmMedium, deals.programId,
  );
  const base = () => db.select({ dealId: deals.id, area: areaDelDeal })
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
    // `ventasConDiaEn` ya excluye lo anulado por dentro; aquí se declara para el guardián.
    db.select({ dealId: ventasDelRango.dealId }).from(ventasDelRango).where(incluyendoAnulados(ventasDelRango)),
  ]);

  const idsCompletos = new Set(completos.map((fila) => fila.dealId));
  const idsParciales = new Set(parciales.map((fila) => fila.dealId));
  const idsAgendaron = new Set(agendaron.map((fila) => fila.dealId));
  const idsShows = new Set(shows.flatMap((fila) => fila.dealId ? [fila.dealId] : []));
  const idsVentas = new Set(ventas.map((fila) => fila.dealId));

  return creados.map(({ dealId, area }) => ({
    dealId,
    origen: idsCompletos.has(dealId) ? "completo" : idsParciales.has(dealId) ? "parcial" : "manual",
    area,
    agendo: idsAgendaron.has(dealId),
    tuvoShow: idsShows.has(dealId),
    compro: idsVentas.has(dealId),
  }));
}

function creadosIdsSubquery(db: Db, alcance: Alcance) {
  return db.select({ dealId: deals.id })
    .from(deals)
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(filtroDealsCreados(alcance), vigente(deals)));
}
