import { and, between, eq, sql } from "drizzle-orm";
import { calls, deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  aplicarPagina,
  condicionesDeFiltros,
  expresionDeOrden,
  seleccionarDimensiones,
  totalDeConsulta,
} from "@/lib/queries/hechos/consultar";
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeFecha } from "@/lib/queries/hechos/fechas";
import { dimensionesDeOrigen } from "@/lib/queries/hechos/origen";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

export type DimensionAgenda = "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "dueno" | "cohorte" | "etapa";
export type MedidaAgenda = "agendas";

const dimensiones = {
  ...dimensionesDeFecha(calls.createdAt),
  ...dimensionesDeOrigen(
    submissions.id,
    submissions.utmSource,
    submissions.utmMedium,
    calls.programId,
  ),
  dueno: deals.ownerUserId,
  cohorte: deals.cohortId,
  etapa: deals.etapa,
} as const;

export interface FilaAgenda {
  callId: string;
  dealId: string | null;
  dia: string;
  semana: string;
  mes: string;
  area: string;
  canal: string | null;
  cuenta: string | null;
  dueno: string | null;
  cohorte: string | null;
  etapa: string | null;
}

export async function agrupar<D extends DimensionAgenda>(
  db: Db,
  opciones: ConsultaAgrupada<D, D | MedidaAgenda>,
): Promise<Array<Record<D, string | null> & { agendas: number }>> {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db.select({ ...elegidas, agendas: sql<number>`count(*)::int` }).from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(
      eq(calls.programId, opciones.programId),
      between(dimensiones.dia, opciones.rango.desde, opciones.rango.hasta),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      vigente(calls),
    ))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, agendas: sql<number>`count(*)::int` }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  return await consulta as Array<Record<D, string | null> & { agendas: number }>;
}

export async function listar<D extends DimensionAgenda = DimensionAgenda>(
  db: Db,
  opciones: ConsultaDeLista<D, D>,
): Promise<ListaPaginada<FilaAgenda>> {
  const construir = () => db.select({ callId: calls.id, dealId: calls.dealId, ...dimensiones }).from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId)).where(and(
      eq(calls.programId, opciones.programId),
      between(dimensiones.dia, opciones.rango.desde, opciones.rango.hasta),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      vigente(calls),
    ));
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden(dimensiones, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas, total };
}
