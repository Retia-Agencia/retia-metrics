import { and, eq, sql } from "drizzle-orm";
import { abonos, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { aplicarPagina, condicionesDeFiltros, expresionDeOrden, seleccionarDimensiones, totalDeConsulta } from "@/lib/queries/hechos/consultar";
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeDate } from "@/lib/queries/hechos/fechas";
import { filtroCaja } from "@/lib/queries/metricas-filtros";
import { sumaDeAbonos } from "@/lib/queries/saldo";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

export type DimensionAbono = "dia" | "semana" | "mes" | "moneda" | "plataforma" | "registrado_por" | "dueno" | "cohorte";
export type MedidaAbono = "abonos" | "monto";

const dimensiones = {
  ...dimensionesDeDate(abonos.fecha),
  moneda: abonos.moneda,
  plataforma: abonos.plataformaId,
  registrado_por: abonos.registradoPorUserId,
  dueno: deals.ownerUserId,
  cohorte: deals.cohortId,
} as const;

export interface FilaAbono {
  abonoId: string;
  dealId: string;
  dia: string;
  semana: string;
  mes: string;
  moneda: string;
  plataforma: string | null;
  registrado_por: string | null;
  dueno: string | null;
  cohorte: string | null;
  monto: number;
}

function alcance(db: Db, opciones: { programId: string; rango: { desde: string; hasta: string }; filtros?: Partial<Record<DimensionAbono, readonly (string | null)[]>> }) {
  return and(
    filtroCaja({ programId: opciones.programId, rango: opciones.rango }, db),
    condicionesDeFiltros(dimensiones, opciones.filtros),
  );
}

function consultaAgrupada<D extends DimensionAbono>(db: Db, opciones: ConsultaAgrupada<D, D | MedidaAbono>) {
  const agruparPor = opciones.agruparPor.includes("moneda" as D) ? opciones.agruparPor : [...opciones.agruparPor, "moneda" as D];
  const elegidas = seleccionarDimensiones(dimensiones, agruparPor);
  let consulta = db.select({ ...elegidas, abonos: sql<number>`count(*)::int`, monto: sql<number>`${sumaDeAbonos()}::float8` })
    .from(abonos).innerJoin(deals, and(eq(deals.id, abonos.dealId), incluyendoAnulados(deals)))
    .where(and(alcance(db, opciones), vigente(abonos))).groupBy(...agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, abonos: sql<number>`count(*)::int`, monto: sql<number>`${sumaDeAbonos()}::float8` }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  return consulta;
}

export async function agrupar<D extends DimensionAbono>(db: Db, opciones: ConsultaAgrupada<D, D | MedidaAbono>) {
  return await aplicarPagina(consultaAgrupada(db, opciones), opciones.pagina);
}

export async function contarGrupos<D extends DimensionAbono>(db: Db, opciones: ConsultaAgrupada<D, D | MedidaAbono>): Promise<number> {
  return totalDeConsulta(db, consultaAgrupada(db, { ...opciones, pagina: undefined }));
}

export async function listar<D extends DimensionAbono = DimensionAbono>(db: Db, opciones: ConsultaDeLista<D, D | "monto">): Promise<ListaPaginada<FilaAbono>> {
  const construir = () => db.select({ abonoId: abonos.id, dealId: abonos.dealId, ...dimensiones, monto: sql<number>`${abonos.monto}::float8` })
    .from(abonos).innerJoin(deals, and(eq(deals.id, abonos.dealId), incluyendoAnulados(deals))).where(and(alcance(db, opciones), vigente(abonos)));
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, monto: abonos.monto }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas: filas as FilaAbono[], total };
}
