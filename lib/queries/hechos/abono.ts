import { and, between, eq, sql } from "drizzle-orm";
import { abonos, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  aplicarPagina,
  condicionesDeFiltros,
  expresionDeOrden,
  seleccionarDimensiones,
  totalDeConsulta,
} from "@/lib/queries/hechos/consultar";
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeDate } from "@/lib/queries/hechos/fechas";
import { sumaDeAbonos } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

export type DimensionAbono = "dia" | "semana" | "mes" | "dueno" | "cohorte" | "moneda";
export type MedidaAbono = "abonos" | "monto";

const dimensiones = {
  ...dimensionesDeDate(abonos.fecha),
  dueno: deals.ownerUserId,
  cohorte: deals.cohortId,
  moneda: abonos.moneda,
} as const;

export interface FilaAbono {
  abonoId: string;
  dealId: string;
  dia: string;
  semana: string;
  mes: string;
  dueno: string | null;
  cohorte: string | null;
  moneda: string;
  monto: string;
}

export async function agrupar<D extends DimensionAbono>(
  db: Db,
  opciones: ConsultaAgrupada<D, D | MedidaAbono>,
): Promise<Array<Record<D, string | null> & { abonos: number; monto: number }>> {
  const elegidas = seleccionarDimensiones(dimensiones, opciones.agruparPor);
  let consulta = db.select({
    ...elegidas,
    abonos: sql<number>`count(*)::int`,
    monto: sql<number>`${sumaDeAbonos()}::float8`,
  }).from(abonos)
    .leftJoin(deals, and(eq(deals.id, abonos.dealId), vigente(deals)))
    .where(and(
      eq(abonos.programId, opciones.programId),
      between(abonos.fecha, opciones.rango.desde, opciones.rango.hasta),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      vigente(abonos),
    ))
    .groupBy(...opciones.agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({
    ...dimensiones,
    abonos: sql<number>`count(*)::int`,
    monto: sql<number>`${sumaDeAbonos()}::float8`,
  }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  return await consulta as Array<Record<D, string | null> & { abonos: number; monto: number }>;
}

export async function listar<D extends DimensionAbono = DimensionAbono>(
  db: Db,
  opciones: ConsultaDeLista<D, D>,
): Promise<ListaPaginada<FilaAbono>> {
  const construir = () => db.select({
    abonoId: abonos.id,
    dealId: abonos.dealId,
    ...dimensiones,
    monto: abonos.monto,
  }).from(abonos)
    .leftJoin(deals, and(eq(deals.id, abonos.dealId), vigente(deals))).where(and(
      eq(abonos.programId, opciones.programId),
      between(abonos.fecha, opciones.rango.desde, opciones.rango.hasta),
      condicionesDeFiltros(dimensiones, opciones.filtros),
      vigente(abonos),
    ));
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden(dimensiones, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas, total };
}
