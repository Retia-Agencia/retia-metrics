import { fechaAnclaAgendaCreada } from "@/lib/queries/metricas-filtros";
import type { CortePauta } from "@/lib/queries/atribucion-de-pauta";
import { filtrarDealsDelCorte } from "@/lib/queries/deals-del-corte-de-pauta";
import { and, between, eq, lte, sql } from "drizzle-orm";
import { calls, definicionAgendas as definicion, deals, submissions } from "@/lib/db/schema";
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
import type { AlcanceDeHecho, ConsultaAgrupada, ConsultaDeLista, Filtros, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeFecha } from "@/lib/queries/hechos/fechas";
import { dimensionesDeOrigen } from "@/lib/queries/hechos/origen";
import { llamadaSinDealAnulado } from "@/lib/queries/llamada-sin-deal-anulado";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { columnasUtmDelEnvio } from "@/lib/atribucion/utm-del-envio";
import type { utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { condicionDeSkuParaDeal } from "@/lib/queries/filtros-de-sku";

export type DimensionAgenda = "dia" | "semana" | "mes" | "hora" | "area" | "canal" | "cuenta" | "utm_source" | "utm_medium" | "categoria" | "tiene_envio" | "dueno" | "cohorte" | "etapa";
export type MedidaAgenda = "agendas";

/**
 * LAS AGENDAS LEEN SU DEFINICIÓN ÚNICA (407 fase 2, migración 0160): `crm_definicion.agendas` ya trae la vigencia (llamada y
 * deal no anulados, la llamada suelta sí cuenta), el día de Bogotá de la creación, el origen (área, canal, cuenta, UTM) y el
 * dueño, la cohorte y la etapa del deal. Aquí solo van el filtro de programa, el de SKU, el corte `creadaHasta` y los filtros
 * del llamador. Las vistas del MCP leen la misma definición.
 */
const dimensiones = {
  dia: definicion.dia,
  semana: definicion.semana,
  mes: definicion.mes,
  hora: definicion.hora,
  area: definicion.area,
  canal: definicion.canal,
  cuenta: definicion.cuenta,
  utm_source: definicion.utmSource,
  utm_medium: definicion.utmMedium,
  categoria: definicion.categoria,
  tiene_envio: definicion.tieneEnvio,
  dueno: definicion.dueno,
  cohorte: definicion.cohorteId,
  etapa: definicion.etapa,
} as const;

/**
 * Las dos lecturas que siguen sobre las TABLAS (la traza UTM agregada y el predicado de área que otras consultas montan sobre
 * `calls`, `deals` y `submissions`) no pueden leer la vista: usan la misma definición de día y de origen en TypeScript
 * (`fechas.ts` y `origen.ts`, gemelas de `crm_definicion`, comparadas en `tests/mcp-definicion-unica.test.ts`).
 */
const diaDeCreacion = dimensionesDeFecha(calls.createdAt).dia;
const areaDeTablas = dimensionesDeOrigen(submissions.id, submissions.utmSource, submissions.utmMedium, calls.programId).area;

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
      between(diaDeCreacion, opciones.rango.desde, opciones.rango.hasta),
      vigente(calls),
      vigente(deals),
    ))
    .groupBy(...Object.values(columnasUtmDelEnvio));
}

function alcance(db: Db, opciones: AlcanceDeHecho & { filtros?: Filtros<DimensionAgenda>; creadaHasta?: Date }) {
  return and(
    eq(definicion.programaId, opciones.programId),
    condicionDeSkuParaDeal(db, opciones.programId, definicion.idDelDeal, opciones.filtrosDeSku),
    between(definicion.dia, opciones.rango.desde, opciones.rango.hasta),
    condicionesDeFiltros(dimensiones, opciones.filtros),
    opciones.creadaHasta ? lte(definicion.creadaEn, opciones.creadaHasta) : undefined,
  );
}

function consultaAgrupada<D extends DimensionAgenda>(
  db: Db,
  opciones: ConsultaAgendaAgrupada<D>,
) {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db.select({ ...elegidas, agendas: sql<number>`count(*)::int` }).from(definicion)
    .where(alcance(db, opciones))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, agendas: sql<number>`count(*)::int` }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  return consulta;
}

export async function agrupar<D extends DimensionAgenda>(
  db: Db,
  opciones: ConsultaAgendaAgrupada<D>,
): Promise<Array<Record<D, string | null> & { agendas: number }>> {
  return unaVezPorSolicitud(db, claveDe("agruparAgendas", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, opciones.agruparPor, filtrosEfectivos(opciones.filtros), opciones.filtrosDeSku, opciones.orden, opciones.pagina,
    opciones.creadaHasta), async () =>
    await aplicarPagina(consultaAgrupada(db, opciones), opciones.pagina) as Array<Record<D, string | null> & { agendas: number }>);
}

export async function contarGrupos<D extends DimensionAgenda>(db: Db, opciones: ConsultaAgendaAgrupada<D>): Promise<number> {
  return unaVezPorSolicitud(db, claveDe("contarGruposDeAgendas", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, opciones.agruparPor, filtrosEfectivos(opciones.filtros), opciones.filtrosDeSku, opciones.orden, opciones.creadaHasta), () =>
    totalDeConsulta(db, consultaAgrupada(db, { ...opciones, pagina: undefined })));
}

export async function listar<D extends DimensionAgenda = DimensionAgenda>(
  db: Db,
  opciones: ConsultaAgendaLista<D>,
): Promise<ListaPaginada<FilaAgenda>> {
  return unaVezPorSolicitud(db, claveDe("listarAgendas", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, filtrosEfectivos(opciones.filtros), opciones.filtrosDeSku, opciones.orden, opciones.pagina, opciones.creadaHasta), () =>
    leerLista(db, opciones));
}

async function leerLista<D extends DimensionAgenda = DimensionAgenda>(
  db: Db,
  opciones: ConsultaAgendaLista<D>,
): Promise<ListaPaginada<FilaAgenda>> {
  const construir = () => db.select({
    callId: definicion.idDeLaLlamada,
    dealId: definicion.idDelDeal,
    ...dimensiones,
    horaMinuto: definicion.horaMinuto,
  }).from(definicion).where(alcance(db, opciones));
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, horaMinuto: definicion.horaMinuto }, opciones.orden);
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

function filtrosDeAreaDePauta() {
  return { area: AREA_DE_PAUTA };
}

/** El predicado canónico del área Paid para cualquier lectura de citas. */
export function condicionDeAreaDePauta() {
  return condicionesDeFiltros({ area: areaDeTablas }, filtrosDeAreaDePauta());
}

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
    filtros: { ...filtrosDeAreaDePauta(), ...(opciones.cohorteId ? { cohorte: [opciones.cohorteId] } : {}) } as Filtros<D | "area" | "cohorte">,
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

/** Las agendas creadas del corte heredan el envío del deal; conserva el ancla de agendasDePauta. */
export async function agendasPorDiaDelCorte(db: Db, args: {
  programId: string; desde: string; hasta: string; creadaHasta?: Date; cohorteId?: string | null; corte: CortePauta;
}) {
  const dia = fechaAnclaAgendaCreada();
  const citas = await db.select({ dia, dealId: deals.id, envioId: deals.submissionOrigenId }).from(calls)
    .innerJoin(deals, and(eq(deals.id, calls.dealId), eq(deals.programId, args.programId), vigente(deals)))
    .where(and(eq(calls.programId, args.programId), vigente(calls), llamadaSinDealAnulado(db),
      between(dia, args.desde, args.hasta),
      args.creadaHasta ? lte(calls.createdAt, args.creadaHasta) : undefined,
      args.cohorteId ? eq(deals.cohortId, args.cohorteId) : undefined));
  const ids = await filtrarDealsDelCorte(db, args.programId, args.corte,
    citas.map((c) => ({ id: c.dealId, submissionOrigenId: c.envioId })));
  const porDia = new Map<string, number>();
  for (const cita of citas) {
    if (ids.has(cita.dealId)) porDia.set(cita.dia, (porDia.get(cita.dia) ?? 0) + 1);
  }
  return [...porDia].map(([dia, agendas]) => ({ dia, agendas }));
}

export async function agendasDelCorte(db: Db, args: Parameters<typeof agendasPorDiaDelCorte>[1]): Promise<number> {
  return (await agendasPorDiaDelCorte(db, args)).reduce((total, dia) => total + dia.agendas, 0);
}
