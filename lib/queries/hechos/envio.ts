import { and, between, eq, sql } from "drizzle-orm";
import { areaSql, canalSql, cuentaSql } from "@/lib/atribucion/canal-sql";
import { sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  aplicarPagina,
  condicionesDeFiltros,
  expresionDeOrden,
  seleccionarDimensiones,
  totalDeConsulta,
} from "@/lib/queries/hechos/consultar";
import type {
  ConsultaAgrupada,
  ConsultaDeLista,
  ListaPaginada,
} from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeFecha } from "@/lib/queries/hechos/fechas";

export type DimensionEnvio = "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "campana" | "fuente";
export type MedidaEnvio = "envios";

const dimensiones = {
  ...dimensionesDeFecha(submissions.fechaEnvio),
  area: areaSql({ source: submissions.utmSource, medium: submissions.utmMedium }),
  canal: canalSql({ source: submissions.utmSource, medium: submissions.utmMedium }),
  cuenta: cuentaSql({ source: submissions.utmSource, medium: submissions.utmMedium }),
  campana: submissions.utmCampaign,
  fuente: submissions.sourceId,
} as const;

export interface FilaEnvio {
  envioId: string;
  dia: string;
  semana: string;
  mes: string;
  area: string;
  canal: string | null;
  cuenta: string | null;
  campana: string | null;
  fuente: string;
}

const alcance = (programId: string, rango: { desde: string; hasta: string }) => and(
  eq(sources.programId, programId),
  eq(submissions.esParcial, false),
  between(dimensiones.dia, rango.desde, rango.hasta),
);

export async function agrupar<D extends DimensionEnvio>(
  db: Db,
  opciones: ConsultaAgrupada<D, D | MedidaEnvio>,
): Promise<Array<Record<D, string | null> & { envios: number }>> {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db
    .select({ ...elegidas, envios: sql<number>`count(*)::int` })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(and(alcance(opciones.programId, opciones.rango), condicionesDeFiltros(dimensiones, opciones.filtros)))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre]))
    .$dynamic();
  const ordenables = { ...dimensiones, envios: sql<number>`count(*)::int` };
  const orden = expresionDeOrden(ordenables, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  return await consulta as Array<Record<D, string | null> & { envios: number }>;
}

export async function listar<D extends DimensionEnvio = DimensionEnvio>(
  db: Db,
  opciones: ConsultaDeLista<D, D>,
): Promise<ListaPaginada<FilaEnvio>> {
  const donde = and(alcance(opciones.programId, opciones.rango), condicionesDeFiltros(dimensiones, opciones.filtros));
  const construir = () => db.select({ envioId: submissions.id, ...dimensiones }).from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId)).where(donde);
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden(dimensiones, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas, total };
}
