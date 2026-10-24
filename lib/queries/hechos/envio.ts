import { and, between, eq, sql } from "drizzle-orm";
import { areaSql, canalSql, categoriaUtmSql, columnasIdMetaDelEnvio, cuentaSql, idEnArbolSql } from "@/lib/atribucion/canal-sql";
import { sources, submissions } from "@/lib/db/schema";
import { columnasUtmDelEnvio } from "@/lib/atribucion/utm-del-envio";
import type { utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
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
import { fechaAnclaEnvio } from "@/lib/queries/metricas-filtros";

export type DimensionEnvio = "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "campana" | "fuente" | "utm_source" | "utm_medium" | "categoria";
export type MedidaEnvio = "envios";

const columnas = { source: submissions.utmSource, medium: submissions.utmMedium };
const idEnArbol = idEnArbolSql({
  programId: sources.programId,
  ...columnasIdMetaDelEnvio,
});
const dimensiones = {
  ...dimensionesDeFecha(submissions.fechaEnvio),
  dia: fechaAnclaEnvio(),
  area: areaSql(columnas, idEnArbol),
  canal: canalSql(columnas),
  cuenta: cuentaSql(columnas),
  campana: submissions.utmCampaign,
  fuente: submissions.sourceId,
  utm_source: submissions.utmSource,
  utm_medium: submissions.utmMedium,
  categoria: categoriaUtmSql(),
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
  utm_source: string | null;
  utm_medium: string | null;
  categoria: string;
}

export type GrupoDeTrazaDeEnvio = Parameters<typeof utmsDelEnvio>[0] & {
  envios: number;
};

export interface PrimerDiaDeParUtm {
  utmSource: string | null;
  utmMedium: string | null;
  primero: string;
  nuevo: boolean;
}

/**
 * Tuplas UTM agregadas en SQL. El llamador aplica `emparejar` porque el significado de
 * content/term pertenece exclusivamente a atribución; nunca transfiere una fila por envío.
 */
export async function agruparTrazas(
  db: Db,
  opciones: { programId: string; rango: { desde: string; hasta: string }; hoy: string },
): Promise<{ grupos: GrupoDeTrazaDeEnvio[]; primeros: PrimerDiaDeParUtm[] }> {
  const dia = dimensiones.dia;
  const alcanceDelPrograma = and(
    eq(sources.programId, opciones.programId),
    eq(submissions.esParcial, false),
  );
  const grupos = db.select({
    ...columnasUtmDelEnvio,
    envios: sql<number>`count(*) filter (where ${dia} between ${opciones.rango.desde} and ${opciones.rango.hasta})::int`,
  }).from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(alcanceDelPrograma)
    .groupBy(...Object.values(columnasUtmDelEnvio))
    .having(sql`count(*) filter (where ${dia} between ${opciones.rango.desde} and ${opciones.rango.hasta}) > 0`);
  // Consulta separada, agrupada solo por el par: un anuncio nuevo no rejuvenece el par.
  const primeros = db.select({
    utmSource: submissions.utmSource,
    utmMedium: submissions.utmMedium,
    primero: sql<string>`min(${dia})::text`,
    nuevo: sql<boolean>`min(${dia}) >= ${opciones.hoy}::date - 6`,
  }).from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(alcanceDelPrograma)
    .groupBy(submissions.utmSource, submissions.utmMedium);
  const [filasDeTraza, primerosPorPar] = await Promise.all([grupos, primeros]);
  return { grupos: filasDeTraza, primeros: primerosPorPar };
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
