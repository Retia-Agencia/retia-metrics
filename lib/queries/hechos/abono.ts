import { and, eq, isNull, or, sql } from "drizzle-orm";
import { abonos, deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveCloserSql, claveDeCloserSql } from "@/lib/closers/identidad";
import { aplicarPagina, condicionesDeFiltros, expresionDeOrden, seleccionarDimensiones, totalDeConsulta } from "@/lib/queries/hechos/consultar";
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeDate } from "@/lib/queries/hechos/fechas";
import { closerDeAbono, filtroCaja } from "@/lib/queries/metricas-filtros";
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

/**
 * Caja agrupada por la identidad reconciliada del comparativo. Una fila histórica sin FK toma el
 * `users.id` cuya clave normalizada coincide, igual que `porClaveConFk` al filtrar por esa cuenta.
 */
export async function gruposDeCajaPorCloser(
  db: Db,
  opciones: { programId: string; rango: { desde: string; hasta: string }; cohorteId?: string | null; hoy: string },
) {
  const edad = sql<number>`greatest(0, ${opciones.hoy}::date - (${abonos.fecha})::date)`;
  const bucket = sql<string>`case
    when ${edad} <= 7 then '0-7'
    when ${edad} <= 30 then '8-30'
    when ${edad} <= 90 then '31-90'
    else '>90' end`;
  const claveDeReparto = claveCloserSql(users.id, abonos.closerId);
  const claveOriginal = claveCloserSql(abonos.registradoPorUserId, abonos.closerId);
  return db
    .select({
      dealId: sql<null>`null::text`,
      closer: sql<string | null>`min(${closerDeAbono()})`,
      claveReparto: sql<string>`min(${claveDeReparto})`,
      claveCloser: sql<string>`min(${claveOriginal})`,
      etapa: sql<string | null>`${deals.etapa}::text`,
      bucket: bucket.as("bucket_antiguedad"),
      moneda: abonos.moneda,
      monto: sql<number>`${sumaDeAbonos()}::float8`,
      cantidad: sql<number>`count(*)::int`,
      persona: sql<null>`null::jsonb`,
    })
    .from(abonos)
    .leftJoin(deals, and(eq(deals.id, abonos.dealId), eq(deals.programId, abonos.programId), vigente(deals)))
    .leftJoin(
      users,
      or(
        eq(users.id, abonos.registradoPorUserId),
        and(
          isNull(abonos.registradoPorUserId),
          eq(claveDeCloserSql(users.closerId), claveDeCloserSql(abonos.closerId)),
        ),
      ),
    )
    .where(and(
      filtroCaja({ programId: opciones.programId, rango: opciones.rango, cohorteId: opciones.cohorteId }, db),
      vigente(abonos),
      vigente(deals),
    ))
    .groupBy(claveDeReparto, claveOriginal, deals.etapa, sql`"bucket_antiguedad"`, abonos.moneda);
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
