import { and, eq, sql } from "drizzle-orm";
import { deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ventasConDiaEn } from "@/lib/queries/dashboard";
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

export type DimensionVenta = "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "dueno" | "cohorte";
export type MedidaVenta = "ventas";

/**
 * El dia de la venta por deal viene de `ventasConDiaEn` (la UNICA definicion de venta, ADR 0024):
 * una fila por deal vendido en el rango, con `vigente(deals)` aplicado dentro. Se une a `deals`
 * —tabla real, con `vigente(deals)` INLINE en el JOIN para el guardian de vigencia— y a su envio
 * de origen para las dimensiones de atribucion. El subconsulta no se correlaciona: es un conjunto
 * cerrado que se une por `dealId` (AGENTS.md).
 */
function fuente(db: Db, rango: { desde: string; hasta: string }) {
  const dias = ventasConDiaEn(db, rango).as("ventas_con_dia");
  const dimensiones = {
    ...dimensionesDeDate(dias.dia),
    ...dimensionesDeOrigen(
      submissions.id,
      submissions.utmSource,
      submissions.utmMedium,
      deals.programId,
    ),
    dueno: deals.ownerUserId,
    cohorte: deals.cohortId,
  } as const;
  return { dias, dimensiones };
}

export interface FilaVenta {
  dealId: string;
  dia: string;
  semana: string;
  mes: string;
  area: string;
  canal: string | null;
  cuenta: string | null;
  dueno: string | null;
  cohorte: string | null;
}

export async function agrupar<D extends DimensionVenta>(
  db: Db,
  opciones: ConsultaAgrupada<D, D | MedidaVenta>,
): Promise<Array<Record<D, string | null> & { ventas: number }>> {
  const { dias, dimensiones } = fuente(db, opciones.rango);
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db.select({ ...elegidas, ventas: sql<number>`count(*)::int` }).from(dias)
    .innerJoin(deals, and(eq(deals.id, dias.dealId), vigente(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(
      eq(deals.programId, opciones.programId),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      incluyendoAnulados(dias),
    ))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, ventas: sql<number>`count(*)::int` }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  return await consulta as Array<Record<D, string | null> & { ventas: number }>;
}

export async function listar<D extends DimensionVenta = DimensionVenta>(
  db: Db,
  opciones: ConsultaDeLista<D, D>,
): Promise<ListaPaginada<FilaVenta>> {
  const construir = () => {
    const { dias, dimensiones } = fuente(db, opciones.rango);
    const donde = and(eq(deals.programId, opciones.programId), condicionesDeFiltros(dimensiones, opciones.filtros));
    return {
      dimensiones,
      consulta: db.select({ dealId: deals.id, ...dimensiones }).from(dias)
        .innerJoin(deals, and(eq(deals.id, dias.dealId), vigente(deals)))
        .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId)).where(and(
          donde,
          incluyendoAnulados(dias),
        )),
    };
  };
  const principal = construir();
  let consulta = principal.consulta.$dynamic();
  const orden = expresionDeOrden(principal.dimensiones, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir().consulta)]);
  return { filas, total };
}
