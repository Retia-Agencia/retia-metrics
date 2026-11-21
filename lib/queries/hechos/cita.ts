import { and, between, eq, sql } from "drizzle-orm";
import { definicionCitas } from "@/lib/db/schema";
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
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { condicionDeSkuParaDeal } from "@/lib/queries/filtros-de-sku";

export type DimensionCita = "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "dueno" | "cohorte" | "etapa" | "ocurrio";
export type MedidaCita = "citas" | "shows";

/**
 * LAS CITAS LEEN SU DEFINICIÓN ÚNICA (407 fase 2, migración 0160): `crm_definicion.citas` ya trae la vigencia (llamada y deal
 * no anulados, la llamada suelta sí cuenta), el día de Bogotá de la agenda, área, canal y cuenta del envío de origen, y si la
 * cita ocurrió. Aquí solo van el filtro de programa, el de SKU y los filtros del llamador. Las vistas del MCP leen la misma.
 */
const dimensiones = {
  dia: definicionCitas.dia,
  semana: definicionCitas.semana,
  mes: definicionCitas.mes,
  area: definicionCitas.area,
  canal: definicionCitas.canal,
  cuenta: definicionCitas.cuenta,
  dueno: definicionCitas.dueno,
  cohorte: definicionCitas.cohorteId,
  etapa: definicionCitas.etapa,
  ocurrio: definicionCitas.ocurrio,
} as const;

const medidaDeShows = sql<number>`count(*) filter (where ${eq(definicionCitas.ocurrio, "si")})::int`;

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

function alcance(db: Db, opciones: Pick<ConsultaDeLista<DimensionCita, string>, "programId" | "rango" | "filtros" | "filtrosDeSku">) {
  return and(
    eq(definicionCitas.programaId, opciones.programId),
    condicionDeSkuParaDeal(db, opciones.programId, definicionCitas.idDelDeal, opciones.filtrosDeSku),
    between(definicionCitas.dia, opciones.rango.desde, opciones.rango.hasta),
    condicionesDeFiltros(dimensiones, opciones.filtros),
  );
}

function consultaAgrupada<D extends DimensionCita>(
  db: Db,
  opciones: ConsultaAgrupada<D, D | MedidaCita>,
) {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db.select({
    ...elegidas,
    citas: sql<number>`count(*)::int`,
    shows: medidaDeShows,
  }).from(definicionCitas)
    .where(alcance(db, opciones))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({
    ...dimensiones,
    citas: sql<number>`count(*)::int`,
    shows: medidaDeShows,
  }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  return consulta;
}

export async function agrupar<D extends DimensionCita>(
  db: Db,
  opciones: ConsultaAgrupada<D, D | MedidaCita>,
): Promise<Array<Record<D, string | null> & { citas: number; shows: number }>> {
  return unaVezPorSolicitud(db, claveDe("agruparCitas", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, opciones.agruparPor, filtrosEfectivos(opciones.filtros), opciones.filtrosDeSku, opciones.orden, opciones.pagina), async () =>
    await aplicarPagina(consultaAgrupada(db, opciones), opciones.pagina) as Array<Record<D, string | null> & { citas: number; shows: number }>);
}

export async function contarGrupos<D extends DimensionCita>(db: Db, opciones: ConsultaAgrupada<D, D | MedidaCita>): Promise<number> {
  return unaVezPorSolicitud(db, claveDe("contarGruposDeCitas", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, opciones.agruparPor, filtrosEfectivos(opciones.filtros), opciones.filtrosDeSku, opciones.orden), () =>
    totalDeConsulta(db, consultaAgrupada(db, { ...opciones, pagina: undefined })));
}

export async function listar<D extends DimensionCita = DimensionCita>(
  db: Db,
  opciones: ConsultaDeLista<D, D>,
): Promise<ListaPaginada<FilaCita>> {
  return unaVezPorSolicitud(db, claveDe("listarCitas", opciones.programId, opciones.rango.desde,
    opciones.rango.hasta, filtrosEfectivos(opciones.filtros), opciones.filtrosDeSku, opciones.orden, opciones.pagina), () =>
    leerLista(db, opciones));
}

async function leerLista<D extends DimensionCita = DimensionCita>(
  db: Db,
  opciones: ConsultaDeLista<D, D>,
): Promise<ListaPaginada<FilaCita>> {
  const construir = () => db.select({ callId: definicionCitas.idDeLaLlamada, dealId: definicionCitas.idDelDeal, ...dimensiones }).from(definicionCitas)
    .where(alcance(db, opciones));
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden(dimensiones, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas, total };
}
