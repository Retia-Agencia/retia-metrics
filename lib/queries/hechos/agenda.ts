import { and, between, eq, lte, sql } from "drizzle-orm";
import { calls, deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  aplicarPagina,
  condicionesDeFiltros,
  expresionDeOrden,
  seleccionarDimensiones,
  totalDeConsulta,
} from "@/lib/queries/hechos/consultar";
import type { ConsultaAgrupada, ConsultaDeLista, Filtros, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeFecha, horaMinutoEnBogota } from "@/lib/queries/hechos/fechas";
import { dimensionesDeOrigen } from "@/lib/queries/hechos/origen";
import { categoriaUtmSql } from "@/lib/atribucion/canal-sql";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { columnasUtmDelEnvio } from "@/lib/atribucion/utm-del-envio";
import type { utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

export type DimensionAgenda = "dia" | "semana" | "mes" | "hora" | "area" | "canal" | "cuenta" | "utm_source" | "utm_medium" | "categoria" | "tiene_envio" | "dueno" | "cohorte" | "etapa";
export type MedidaAgenda = "agendas";

const dimensiones = {
  ...dimensionesDeFecha(calls.createdAt),
  ...dimensionesDeOrigen(
    submissions.id,
    submissions.utmSource,
    submissions.utmMedium,
    calls.programId,
  ),
  utm_source: submissions.utmSource,
  utm_medium: submissions.utmMedium,
  categoria: categoriaUtmSql(),
  tiene_envio: sql<string>`case when ${submissions.id} is null then 'no' else 'si' end`,
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
  hora: string;
  horaMinuto: string;
  area: string;
  canal: string | null;
  cuenta: string | null;
  dueno: string | null;
  cohorte: string | null;
  etapa: string | null;
}

type ConsultaAgendaAgrupada<D extends DimensionAgenda> = ConsultaAgrupada<D, D | MedidaAgenda> & {
  creadaHasta?: Date;
};

type ConsultaAgendaLista<D extends DimensionAgenda> = ConsultaDeLista<D, D | "horaMinuto"> & {
  creadaHasta?: Date;
};

export type GrupoDeTrazaDeAgenda = Parameters<typeof utmsDelEnvio>[0] & { agendas: number };

/** Agendas con envío de origen, agregadas en SQL por la tupla UTM que consume el emparejador. */
export async function agruparTrazas(
  db: Db,
  opciones: { programId: string; rango: { desde: string; hasta: string } },
): Promise<GrupoDeTrazaDeAgenda[]> {
  return await db.select({
    ...columnasUtmDelEnvio,
    agendas: sql<number>`count(*)::int`,
  }).from(calls)
    .innerJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .innerJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(
      eq(calls.programId, opciones.programId),
      between(dimensiones.dia, opciones.rango.desde, opciones.rango.hasta),
      vigente(calls),
    ))
    .groupBy(...Object.values(columnasUtmDelEnvio));
}

export async function agrupar<D extends DimensionAgenda>(
  db: Db,
  opciones: ConsultaAgendaAgrupada<D>,
): Promise<Array<Record<D, string | null> & { agendas: number }>> {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db.select({ ...elegidas, agendas: sql<number>`count(*)::int` }).from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(
      eq(calls.programId, opciones.programId),
      between(dimensiones.dia, opciones.rango.desde, opciones.rango.hasta),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      opciones.creadaHasta ? lte(calls.createdAt, opciones.creadaHasta) : undefined,
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
  opciones: ConsultaAgendaLista<D>,
): Promise<ListaPaginada<FilaAgenda>> {
  const horaMinuto = horaMinutoEnBogota(calls.createdAt);
  const construir = () => db.select({ callId: calls.id, dealId: calls.dealId, ...dimensiones, horaMinuto }).from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId)).where(and(
      eq(calls.programId, opciones.programId),
      between(dimensiones.dia, opciones.rango.desde, opciones.rango.hasta),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      opciones.creadaHasta ? lte(calls.createdAt, opciones.creadaHasta) : undefined,
      vigente(calls),
    ));
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, horaMinuto }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas, total };
}

/**
 * LAS DOS PREGUNTAS DE AGENDAS (412 F, contrato de unicidad pedido por Mani el 10-nov, ADR 0115 N1).
 * Ninguna otra función escribe el filtro de área para agendas: quien cuente agendas de pauta llama
 * `agendasDePauta`; quien cuente las de una cohorte (todos los orígenes) llama `agendasDeLaCohorte`.
 * `tests/agendas-una-pregunta.test.ts` hace divergir las dos y vigila que el filtro no se escriba fuera.
 */
const AREA_DE_PAUTA: string[] = ["paid"];

type FilaAgrupada<D extends DimensionAgenda> = Record<D, string | null> & { agendas: number };

/** Agendas de área Paid: citas vigentes creadas en el rango; con `cohorteId` solo las de esa cohorte. */
export async function agendasDePauta<D extends DimensionAgenda = "dia">(
  db: Db,
  opciones: {
    programId: string;
    rango: { desde: string; hasta: string };
    cohorteId?: string | null;
    creadaHasta?: Date;
    agruparPor?: readonly D[];
  },
): Promise<Array<FilaAgrupada<D>>> {
  return await agrupar<D | "area" | "cohorte">(db, {
    programId: opciones.programId,
    rango: opciones.rango,
    agruparPor: (opciones.agruparPor ?? ["dia"]) as readonly D[],
    filtros: { area: AREA_DE_PAUTA, ...(opciones.cohorteId ? { cohorte: [opciones.cohorteId] } : {}) } as Filtros<D | "area" | "cohorte">,
    creadaHasta: opciones.creadaHasta,
  }) as Array<FilaAgrupada<D>>;
}

/** Total de agendas de una cohorte, de TODOS los orígenes (la meta de agendas es de la cohorte, no de Paid). */
export async function agendasDeLaCohorte(
  db: Db,
  opciones: { programId: string; rango: { desde: string; hasta: string }; cohorteId: string },
): Promise<number> {
  const filas = await agrupar<"cohorte">(db, {
    programId: opciones.programId,
    rango: opciones.rango,
    agruparPor: [],
    filtros: { cohorte: [opciones.cohorteId] },
  });
  return filas.reduce((total, fila) => total + fila.agendas, 0);
}

/** Lista de las agendas de pauta (la misma pregunta de `agendasDePauta`, fila por fila). */
export async function listarAgendasDePauta(
  db: Db,
  opciones: Omit<ConsultaAgendaLista<"area">, "filtros">,
): Promise<ListaPaginada<FilaAgenda>> {
  return await listar<"area">(db, { ...opciones, filtros: { area: AREA_DE_PAUTA } });
}
