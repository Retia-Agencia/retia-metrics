import { and, between, eq, or, sql } from "drizzle-orm";
import { areaSql, canalSql, categoriaUtmSql, columnasIdMetaDelEnvio, cuentaSql, idEnArbolSql } from "@/lib/atribucion/canal-sql";
import { sources, submissions } from "@/lib/db/schema";
import { columnasUtmDelEnvio } from "@/lib/atribucion/utm-del-envio";
import type { utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import {
  aplicarPagina,
  condicionesDeFiltros,
  expresionDeOrden,
  filtrosEfectivos,
  seleccionarDimensiones,
  totalDeConsulta,
} from "@/lib/queries/hechos/consultar";
import type {
  ConsultaAgrupada,
  ConsultaDeLista,
  ListaPaginada,
} from "@/lib/queries/hechos/dimensiones";
import { anclaEnvio, dimensionesDeFecha } from "@/lib/queries/hechos/fechas";
import { fechaAnclaEnvio } from "@/lib/queries/metricas-filtros";

export type DimensionEnvio = "tipo" | "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "campana" | "fuente" | "utm_source" | "utm_medium" | "categoria";
export type MedidaEnvio = "envios";

/**
 * Qué cuenta como un envío (429, opción B de Mani, 14-nov): los completos y los parciales de quien se fue a mitad
 * del formulario. El parcial de una persona que luego completó (mismo formulario y mismo token) es la misma
 * aplicación: no cuenta aparte, o la persona valdría dos. UNA definición, para la cifra, la lista y el MCP.
 */
export const TIPOS_DE_ENVIO = ["completo", "parcial"] as const;
export type TipoDeEnvio = (typeof TIPOS_DE_ENVIO)[number];

const tipoSql = sql<TipoDeEnvio>`case when ${submissions.esParcial} then 'parcial' else 'completo' end`;
const parcialSinCompleto = sql`(${submissions.esParcial} and not exists (
  select 1 from submissions c
  where c.source_id = ${submissions.sourceId} and c.token = ${submissions.token} and not c.es_parcial
))`;
/**
 * El universo de una cifra de envíos, SIEMPRE explícito (Mani, 18-nov: ninguna cifra de envíos queda ambigua).
 * - `completos`: solo formularios terminados. Es lo que cuentan Meta y el Excel, y por tanto toda tabla de Pauta,
 *   el costo por registro, la conversión de la landing, la proyección y el reporte diario.
 * - `completos_y_parciales`: la cifra «Envíos»: completos más los parciales de quien nunca completó.
 */
export const UNIVERSOS_DE_ENVIO = ["completos", "completos_y_parciales"] as const;
export type UniversoDeEnvio = (typeof UNIVERSOS_DE_ENVIO)[number];
export const ROTULO_DE_UNIVERSO_DE_ENVIO: Record<UniversoDeEnvio, string> = {
  completos: "solo formularios completos",
  completos_y_parciales: "formularios completos más parciales sin completar",
};

const cuentaComoEnvio = (universo: UniversoDeEnvio) =>
  universo === "completos" ? eq(submissions.esParcial, false) : or(eq(submissions.esParcial, false), parcialSinCompleto);
type ConUniverso<T> = T & { universo: UniversoDeEnvio };

const columnas = { source: submissions.utmSource, medium: submissions.utmMedium };
const idEnArbol = idEnArbolSql({
  programId: sources.programId,
  ...columnasIdMetaDelEnvio,
});
const dimensiones = {
  tipo: tipoSql,
  ...dimensionesDeFecha(anclaEnvio()),
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
  tipo: TipoDeEnvio;
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
  opciones: { programId: string; rango: { desde: string; hasta: string }; hoy: string; universo: UniversoDeEnvio },
): Promise<{ grupos: GrupoDeTrazaDeEnvio[]; primeros: PrimerDiaDeParUtm[] }> {
  const dia = dimensiones.dia;
  const alcanceDelPrograma = and(
    eq(sources.programId, opciones.programId),
    cuentaComoEnvio(opciones.universo),
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

const alcance = (programId: string, rango: { desde: string; hasta: string }, universo: UniversoDeEnvio) => and(
  eq(sources.programId, programId),
  cuentaComoEnvio(universo),
  between(dimensiones.dia, rango.desde, rango.hasta),
);

export function filtroDeEnvios({
  programId,
  rango,
  filtros,
  universo,
}: {
  programId: string;
  rango: { desde: string; hasta: string };
  filtros?: Partial<Record<DimensionEnvio, readonly (string | null)[]>>;
  universo: UniversoDeEnvio;
}) {
  return and(alcance(programId, rango, universo), condicionesDeFiltros(dimensiones, filtros));
}

function consultaAgrupada<D extends DimensionEnvio>(
  db: Db,
  opciones: ConUniverso<ConsultaAgrupada<D, D | MedidaEnvio>>,
) {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db
    .select({ ...elegidas, envios: sql<number>`count(*)::int` })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(filtroDeEnvios(opciones))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre]))
    .$dynamic();
  const ordenables = { ...dimensiones, envios: sql<number>`count(*)::int` };
  const orden = expresionDeOrden(ordenables, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  return consulta;
}

export async function agrupar<D extends DimensionEnvio>(
  db: Db,
  opciones: ConUniverso<ConsultaAgrupada<D, D | MedidaEnvio>>,
): Promise<Array<Record<D, string | null> & { envios: number }>> {
  return unaVezPorSolicitud(db, claveDe("agruparEnvios", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, opciones.agruparPor, filtrosEfectivos(opciones.filtros), opciones.orden, opciones.pagina, opciones.universo), async () =>
    await aplicarPagina(consultaAgrupada(db, opciones), opciones.pagina) as Array<Record<D, string | null> & { envios: number }>);
}

export async function contarGrupos<D extends DimensionEnvio>(db: Db, opciones: ConUniverso<ConsultaAgrupada<D, D | MedidaEnvio>>): Promise<number> {
  return unaVezPorSolicitud(db, claveDe("contarGruposDeEnvios", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, opciones.agruparPor, filtrosEfectivos(opciones.filtros), opciones.orden, opciones.universo), () =>
    totalDeConsulta(db, consultaAgrupada(db, { ...opciones, pagina: undefined })));
}

export async function listar<D extends DimensionEnvio = DimensionEnvio>(
  db: Db,
  opciones: ConUniverso<ConsultaDeLista<D, D>>,
): Promise<ListaPaginada<FilaEnvio>> {
  return unaVezPorSolicitud(db, claveDe("listarEnvios", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, filtrosEfectivos(opciones.filtros), opciones.orden, opciones.pagina, opciones.universo), () => leerLista(db, opciones));
}

async function leerLista<D extends DimensionEnvio = DimensionEnvio>(
  db: Db,
  opciones: ConUniverso<ConsultaDeLista<D, D>>,
): Promise<ListaPaginada<FilaEnvio>> {
  const donde = filtroDeEnvios(opciones);
  const construir = () => db.select({ envioId: submissions.id, ...dimensiones }).from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId)).where(donde);
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden(dimensiones, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas, total };
}
