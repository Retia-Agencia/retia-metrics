import { and, between, eq, isNotNull, or, sql } from "drizzle-orm";
import { gastoPauta, pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Rango } from "@/lib/queries/dashboard";
import { coberturaDeGasto, type CoberturaDeGasto } from "@/lib/pauta/cobertura-de-gasto";
import { convertirGasto, type MonedaGasto } from "@/lib/pauta/convertir-gasto";
import { tasasDelRango } from "@/lib/trm/consultar";
import { aplicarPagina, condicionesDeFiltros, expresionDeOrden, seleccionarDimensiones, totalDeConsulta } from "@/lib/queries/hechos/consultar";
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";
import { dimensionesDeDate } from "@/lib/queries/hechos/fechas";

export type DimensionGasto = "dia" | "semana" | "mes" | "moneda" | "objeto_de_pauta";
export type MedidaGasto = "monto";

const dimensiones = {
  ...dimensionesDeDate(gastoPauta.fecha),
  moneda: gastoPauta.moneda,
  objeto_de_pauta: gastoPauta.pautaObjetoId,
} as const;

export interface FilaGastoNativo {
  gastoId: string;
  dia: string;
  semana: string;
  mes: string;
  moneda: string;
  objeto_de_pauta: string | null;
  monto: number;
}

function alcanceNativo(opciones: { programId: string; rango: Rango; filtros?: Partial<Record<DimensionGasto, readonly (string | null)[]>> }) {
  return and(eq(gastoPauta.programId, opciones.programId), between(gastoPauta.fecha, opciones.rango.desde, opciones.rango.hasta), esGastoPaid, condicionesDeFiltros(dimensiones, opciones.filtros));
}

function consultaAgrupada<D extends DimensionGasto>(db: Db, opciones: ConsultaAgrupada<D, D | MedidaGasto>) {
  const agruparPor = opciones.agruparPor.includes("moneda" as D) ? opciones.agruparPor : [...opciones.agruparPor, "moneda" as D];
  const elegidas = seleccionarDimensiones(dimensiones, agruparPor);
  const suma = sql<number>`sum(${gastoPauta.monto})::float8`;
  let consulta = db.select({ ...elegidas, monto: suma }).from(gastoPauta).where(alcanceNativo(opciones))
    .groupBy(...agruparPor.map((nombre) => dimensiones[nombre])).$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, monto: suma }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  return consulta;
}

export async function agrupar<D extends DimensionGasto>(db: Db, opciones: ConsultaAgrupada<D, D | MedidaGasto>) {
  return await aplicarPagina(consultaAgrupada(db, opciones), opciones.pagina);
}

export async function contarGrupos<D extends DimensionGasto>(db: Db, opciones: ConsultaAgrupada<D, D | MedidaGasto>): Promise<number> {
  return totalDeConsulta(db, consultaAgrupada(db, { ...opciones, pagina: undefined }));
}

export async function listar<D extends DimensionGasto = DimensionGasto>(db: Db, opciones: ConsultaDeLista<D, D | MedidaGasto>): Promise<ListaPaginada<FilaGastoNativo>> {
  const construir = () => db.select({ gastoId: gastoPauta.id, ...dimensiones, monto: sql<number>`${gastoPauta.monto}::float8` }).from(gastoPauta).where(alcanceNativo(opciones));
  let consulta = construir().$dynamic();
  const orden = expresionDeOrden({ ...dimensiones, monto: gastoPauta.monto }, opciones.orden);
  if (orden) consulta = consulta.orderBy(orden);
  consulta = aplicarPagina(consulta, opciones.pagina);
  const [filas, total] = await Promise.all([consulta, totalDeConsulta(db, construir())]);
  return { filas: filas as FilaGastoNativo[], total };
}

/**
 * El hecho de GASTO convertido (ticket 355, ADR 0115 N1): el gasto de pauta del rango, en una sola
 * moneda, con su cobertura. Una sola función convierte (reusa `convertirGasto`, nunca `monto * tasa`
 * a mano, AGENTS.md) y dice qué días quedan sin TRM y desde/hasta cuándo hay gasto cargado
 * (`coberturaDeGasto`). `cargarRoasDePauta` lo consume en vez de leer `gasto_pauta` por su cuenta,
 * así "cuánto se gastó" vive en un módulo y el ROAS lo importa.
 *
 * El gasto PAID del programa es el que trae `area = 'paid'` o está colgado de un objeto de pauta
 * (ADR 0062): la misma condición que usa `coberturaDeGasto`, para que cobertura y suma no divergan.
 */
export interface FilaGasto {
  fecha: string;
  montoUsd: number;
  /** El `idMeta` del anuncio al que está colgado el gasto, o null si solo trae `area`. */
  idMetaAnuncio: string | null;
}

export interface VistaGasto {
  filas: FilaGasto[];
  totalUsd: number;
  /** Suma USD por `idMeta` de anuncio (los que están colgados de un objeto de pauta). */
  porAnuncio: Map<string, number>;
  trmEtiqueta: string | null;
  diasSinTrm: string[];
  cobertura: CoberturaDeGasto;
}

export const esGastoPaid = or(eq(gastoPauta.area, "paid"), isNotNull(gastoPauta.pautaObjetoId));

/** El gasto PAID del rango convertido a `destino`, con la cobertura y la TRM que se usó. */
export async function gastoConvertido(
  db: Db,
  programId: string,
  rango: Rango,
  destino: MonedaGasto = "USD",
): Promise<VistaGasto> {
  const [crudos, tasas, cobertura] = await Promise.all([
    db
      .select({
        fecha: gastoPauta.fecha,
        monto: gastoPauta.monto,
        moneda: gastoPauta.moneda,
        idMetaAnuncio: pautaObjetos.idMeta,
      })
      .from(gastoPauta)
      .leftJoin(pautaObjetos, eq(pautaObjetos.id, gastoPauta.pautaObjetoId))
      .where(and(eq(gastoPauta.programId, programId), between(gastoPauta.fecha, rango.desde, rango.hasta), esGastoPaid)),
    tasasDelRango(db, rango.desde, rango.hasta),
    coberturaDeGasto(db, programId, rango),
  ]);
  const convertidos = convertirGasto(
    crudos.map((g) => ({ dia: g.fecha, monto: g.monto, moneda: g.moneda })),
    tasas.porDia,
    destino,
  );
  const filas: FilaGasto[] = crudos.map((g, i) => ({
    fecha: g.fecha,
    montoUsd: convertidos.montos[i] ?? 0,
    idMetaAnuncio: g.idMetaAnuncio ?? null,
  }));
  const porAnuncio = new Map<string, number>();
  let totalUsd = 0;
  for (const fila of filas) {
    totalUsd += fila.montoUsd;
    if (fila.idMetaAnuncio) porAnuncio.set(fila.idMetaAnuncio, (porAnuncio.get(fila.idMetaAnuncio) ?? 0) + fila.montoUsd);
  }
  return { filas, totalUsd, porAnuncio, trmEtiqueta: tasas.etiqueta, diasSinTrm: convertidos.diasSinTrm, cobertura };
}
