import { and, between, eq, inArray, sql } from "drizzle-orm";
import { calls, deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import { fechaAnclaCall } from "@/lib/queries/dashboard";
import {
  aplicarPagina,
  condicionesDeFiltros,
  expresionDeOrden,
  seleccionarDimensiones,
  totalDeConsulta,
} from "@/lib/queries/hechos/consultar";
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeDate } from "@/lib/queries/hechos/fechas";
import { dimensionesDeOrigen } from "@/lib/queries/hechos/origen";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

export type DimensionCita = "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "dueno" | "cohorte" | "etapa" | "ocurrio";
export type MedidaCita = "citas" | "shows";

const resultadosQueOcurrieron = sql.raw(RESULTADOS_QUE_OCURRIERON.map((resultado) => `'${resultado}'`).join(", "));
const ocurrio = sql<string>`case when ${calls.resultado} in (${resultadosQueOcurrieron}) then 'si' else 'no' end`;
const dimensiones = {
  ...dimensionesDeDate(fechaAnclaCall()),
  ...dimensionesDeOrigen(submissions.id, submissions.utmSource, submissions.utmMedium),
  dueno: deals.ownerUserId,
  cohorte: deals.cohortId,
  etapa: deals.etapa,
  ocurrio,
} as const;

export interface FilaCita {
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
  ocurrio: string;
}

export async function agrupar<D extends DimensionCita>(
  db: Db,
  opciones: ConsultaAgrupada<D, D | MedidaCita>,
): Promise<Array<Record<D, string | null> & { citas: number; shows: number }>> {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db.select({
    ...elegidas,
    citas: sql<number>`count(*)::int`,
    shows: sql<number>`count(*) filter (where ${inArray(calls.resultado, [...RESULTADOS_QUE_OCURRIERON])})::int`,
  }).from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(
      eq(calls.programId, opciones.programId),
      between(fechaAnclaCall(), opciones.rango.desde, opciones.rango.hasta),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      vigente(calls),
    ))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({
    ...dimensiones,
    citas: sql<number>`count(*)::int`,
    shows: sql<number>`count(*) filter (where ${inArray(calls.resultado, [...RESULTADOS_QUE_OCURRIERON])})::int`,
  }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  return await consulta as Array<Record<D, string | null> & { citas: number; shows: number }>;
}

export async function listar<D extends DimensionCita = DimensionCita>(
  db: Db,
  opciones: ConsultaDeLista<D, D>,
): Promise<ListaPaginada<FilaCita>> {
  const construir = () => db.select({ callId: calls.id, dealId: calls.dealId, ...dimensiones }).from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId)).where(and(
      eq(calls.programId, opciones.programId),
      between(fechaAnclaCall(), opciones.rango.desde, opciones.rango.hasta),
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
