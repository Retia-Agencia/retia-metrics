import { and, between, count, eq, sql } from "drizzle-orm";
import { gastoPauta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { convertirGasto } from "@/lib/pauta/convertir-gasto";
import { motivoDeGasto } from "@/lib/pauta/cobertura-de-gasto";
import type { Rango } from "@/lib/queries/dashboard";
import { dineroDeVentas, type DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import * as agenda from "@/lib/queries/hechos/agenda";
import * as envio from "@/lib/queries/hechos/envio";
import { esGastoPaid, gastoConvertido, type VistaGasto } from "@/lib/queries/hechos/gasto";
import * as venta from "@/lib/queries/hechos/venta";
import { valoresVendidosDeDeals } from "@/lib/queries/saldo";
import { semanasDelRango } from "@/lib/rangos";
import { costoPorAgendaDelCrm, type CostoPorAgendaDelCrm } from "@/lib/queries/hechos/costo-agenda-crm";
import { costoPorAgendaDeVentana, type CostoPorAgenda } from "@/lib/semaforo/costo-por-agenda";
import { tasasDelRango } from "@/lib/trm/consultar";
import { sumarDias } from "@/lib/dias-habiles";
import { nombreCorto, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";
import { estadoDeCobertura, type RazonConCobertura } from "@/lib/cobertura";
import { cargarRoasDePauta, type RenglonRoas } from "@/lib/queries/roas-de-pauta";
import { grupoDeCitas, gruposPorTramo, type GrupoDeCitas } from "@/lib/queries/tasas-del-grupo";
import { EXPLICACIONES_DE_PAUTA } from "@/lib/metricas/explicaciones-de-pauta";

export type BloquePautaSemanal = "general" | "comercial" | "trafico";
/** Las columnas de la tabla: una por semana (lunes a domingo, Bogotá) o una por día (414). */
export const PASOS_DE_TABLA_DE_PAUTA = ["semana", "dia"] as const;
export type PasoDeTablaDePauta = (typeof PASOS_DE_TABLA_DE_PAUTA)[number];

/** `?tabla=dia` en la URL; cualquier otro valor es la tabla por semana (un filtro de lectura, no una escritura). */
export function pasoDeTablaDePauta(valor: string | string[] | undefined): PasoDeTablaDePauta {
  return valor === "dia" ? "dia" : "semana";
}
export type UnidadPautaSemanal = "COP" | "USD" | "conteo" | "razon" | "porcentaje";
export type ClavePautaSemanal =
  | "inversion" | "agendas" | "costo_agenda_crm" | "ventas" | "facturacion" | "roas" | "profit"
  | "show" | "cierre_ventas" | "agenda_venta"
  | "cpm" | "ctr" | "llegada_landing" | "conversion_landing" | "agendas_meta" | "costo_agenda_meta" | "frecuencia";

export interface CoberturaPautaSemanal {
  estado: "ok" | "parcial" | "sin_dato";
  razon: string | null;
}

export interface CeldaPautaSemanal {
  valor: number | null;
  cobertura: CoberturaPautaSemanal;
  /** Desglose que la UI formatea; hoy solo la inversión que no fue agenda ni lanzamiento. */
  otrasCampanasCop?: number;
  /**
   * Las dos partes con que se calculó una razón o una resta, en el orden de la fórmula de su explicación (419):
   * "Con los números de esta cifra". Solo en filas de razón o resta; `null` en una parte = no se tiene.
   */
  partes?: readonly [number | null, number | null];
}

export interface FilaPautaSemanal {
  clave: ClavePautaSemanal;
  bloque: BloquePautaSemanal;
  nombre: string;
  unidad: UnidadPautaSemanal;
  /** `porColumna[i]` es la celda de `columnas[i]` de la vista: una semana o un día, según el paso. */
  celdas: { total: CeldaPautaSemanal; porColumna: CeldaPautaSemanal[] };
}

export interface PuntoDiarioPautaSemanal {
  dia: string;
  inversionCop: number | null;
  agendas: number;
  /** Las ventas de Paid de ese día, las mismas que suma la celda Ventas (420, la gráfica diaria). */
  ventas: number;
  /** Su valor vendido en USD (`valoresVendidosDeDeals`); una venta sin valor suma 0 y se cuenta aparte. */
  vendidoUsd: number;
  ventasSinValor: number;
}

export interface VistaPautaSemanal {
  paso: PasoDeTablaDePauta;
  /** Por semana, las del rango; por día, cada día del rango hasta hoy (un día que no ha llegado no tiene nada que medir). */
  columnas: Rango[];
  filas: FilaPautaSemanal[];
  /** Serie diaria del mismo universo para la gráfica del contrato 370. */
  dias: PuntoDiarioPautaSemanal[];
}

type GastoAgrupado = {
  semana: string;
  fecha: string;
  moneda: string;
  filas: number;
  monto: number;
  montoConImpresiones: number;
  impresiones: number | null;
  filasImpresiones: number;
  impresionesConClics: number | null;
  clicsConImpresiones: number | null;
  filasClics: number;
  filasCtr: number;
  clicsConLanding: number | null;
  vistasLanding: number | null;
  vistasConClics: number | null;
  filasLanding: number;
  filasLlegada: number;
  impresionesConAlcance: number | null;
  alcance: number | null;
  filasAlcance: number;
};

type VentaLeida = { dealId: string; dia: string; semana: string; valor: number | null };
type Conteos = { agendas: number; ventas: number; vendido: number; ventasSinValor: number; registros: number };

const OK: CoberturaPautaSemanal = { estado: "ok", razon: null };
const celda = (valor: number | null, cobertura: CoberturaPautaSemanal = OK, otrasCampanasCop?: number): CeldaPautaSemanal =>
  ({ valor, cobertura, ...(otrasCampanasCop !== undefined ? { otrasCampanasCop } : {}) });
/** La celda con las partes de su fórmula; una celda sin valor no las lleva (no hay cuenta que mostrar). */
const conPartes = (c: CeldaPautaSemanal, partes: readonly [number | null, number | null]): CeldaPautaSemanal =>
  c.valor === null ? c : { ...c, partes };
const sinDato = (razon: string): CeldaPautaSemanal => celda(null, { estado: "sin_dato", razon });

function coberturaDeColumnas(filas: number, presentes: number, sinDatoMeta = true): CoberturaPautaSemanal {
  if (filas === 0 || presentes === 0) return { estado: "sin_dato", razon: sinDatoMeta ? "Sin dato de Meta" : "Sin datos" };
  if (presentes < filas) return { estado: "parcial", razon: "Meta no informó todas las filas" };
  return OK;
}

function sumarCampo(filas: readonly GastoAgrupado[], campo: keyof GastoAgrupado): number {
  return filas.reduce((total, fila) => total + Number(fila[campo] ?? 0), 0);
}

async function convertirFilas(
  db: Db,
  filas: readonly GastoAgrupado[],
  rango: Rango,
  campo: "monto" | "montoConImpresiones",
  destino: "COP" | "USD",
): Promise<{ valor: number | null; razon: string | null }> {
  if (filas.length === 0) return { valor: 0, razon: null };
  const tasas = await tasasDelRango(db, rango.desde, rango.hasta);
  const convertido = convertirGasto(
    filas.map((fila) => ({ dia: fila.fecha, monto: fila[campo], moneda: fila.moneda })),
    tasas.porDia,
    destino,
  );
  if (convertido.diasSinTrm.length > 0) {
    return { valor: null, razon: `Falta TRM para ${convertido.diasSinTrm.join(", ")}` };
  }
  return { valor: convertido.montos.reduce<number>((total, monto) => total + (monto ?? 0), 0), razon: null };
}

async function leerTodasLasVentas(
  db: Db,
  args: { programId: string; rango: Rango; cohorteId: string | null },
): Promise<VentaLeida[]> {
  const filas: Array<{ dealId: string; dia: string; semana: string }> = [];
  const tamano = 500;
  for (let offset = 0; ; offset += tamano) {
    const pagina = await venta.listar<"dia" | "semana" | "area" | "cohorte">(db, {
      programId: args.programId,
      rango: args.rango,
      filtros: { area: ["paid"], ...(args.cohorteId ? { cohorte: [args.cohorteId] } : {}) },
      orden: { campo: "dia", sentido: "asc" },
      pagina: { limite: tamano, offset },
    });
    filas.push(...pagina.filas.map(({ dealId, dia, semana }) => ({ dealId, dia, semana })));
    if (filas.length >= pagina.total) break;
  }
  const valores = await valoresVendidosDeDeals(db, filas.map((fila) => fila.dealId));
  return filas.map((fila) => ({ ...fila, valor: valores.get(fila.dealId) ?? null }));
}

function enRango(dia: string, rango: Rango): boolean {
  return dia >= rango.desde && dia <= rango.hasta;
}

function conteosDelRango(args: {
  rango: Rango;
  agendas: Array<{ dia: string; agendas: number }>;
  ventas: VentaLeida[];
  registros: Array<{ dia: string; envios: number }>;
  dinero: DineroDeVentas;
}): Conteos {
  const agendas = args.agendas.filter((fila) => enRango(fila.dia, args.rango)).reduce((n, fila) => n + fila.agendas, 0);
  const ventas = args.ventas.filter((fila) => enRango(fila.dia, args.rango));
  return {
    agendas,
    ventas: ventas.length,
    vendido: args.dinero.vendido,
    ventasSinValor: ventas.filter((fila) => fila.valor === null).length,
    registros: args.registros.filter((fila) => enRango(fila.dia, args.rango)).reduce((n, fila) => n + fila.envios, 0),
  };
}

function coberturaDeVenta(conteos: Conteos): CoberturaPautaSemanal {
  if (conteos.ventasSinValor === 0) return OK;
  return { estado: "parcial", razon: `${conteos.ventasSinValor} ventas sin valor vendido` };
}

function celdaDeRazonConCobertura(razon: RazonConCobertura, motivoVacio: string): CeldaPautaSemanal {
  const estado = estadoDeCobertura(razon);
  const motivo = razon.motivo ?? ((razon.agendasPendientes ?? 0) > 0
    ? `${razon.agendasPendientes} ${razon.agendasPendientes === 1 ? "agenda pendiente" : "agendas pendientes"}`
    : motivoVacio);
  if (estado === "no_calculable") return sinDato(motivo);
  return celda(razon.valor, estado === "parcial" ? { estado: "parcial", razon: motivo } : OK);
}

async function celdasDelRango(
  db: Db,
  rango: Rango,
  gastos: readonly GastoAgrupado[],
  conteos: Conteos,
  gastoUsd: VistaGasto,
  costoMeta: CostoPorAgenda,
  costoCrm: CostoPorAgendaDelCrm,
  grupo: GrupoDeCitas,
  roasDeCohorte: RenglonRoas | null,
): Promise<Record<ClavePautaSemanal, CeldaPautaSemanal>> {
  const filasGasto = gastos.reduce((n, fila) => n + fila.filas, 0);
  const inversionCop = await convertirFilas(db, gastos, rango, "monto", "COP");
  const gastoCpmCop = await convertirFilas(db, gastos.filter((fila) => fila.filasImpresiones > 0), rango, "montoConImpresiones", "COP");
  const otrasCampanasCop = inversionCop.valor === null ? undefined : costoCrm.gastoOtras;
  const coberturaVenta = coberturaDeVenta(conteos);
  const razonGasto = gastoUsd.diasSinTrm.length > 0
    ? `Falta TRM para ${gastoUsd.diasSinTrm.join(", ")}`
    : motivoDeGasto(gastoUsd.cobertura);
  const impresiones = sumarCampo(gastos, "impresiones");
  const presentesImpresiones = sumarCampo(gastos, "filasImpresiones");
  const clicsConImpresiones = sumarCampo(gastos, "clicsConImpresiones");
  const impresionesConClics = sumarCampo(gastos, "impresionesConClics");
  const landing = sumarCampo(gastos, "vistasLanding");
  const vistasConClics = sumarCampo(gastos, "vistasConClics");
  const clicsConLanding = sumarCampo(gastos, "clicsConLanding");
  const presentesLanding = sumarCampo(gastos, "filasLanding");
  const alcance = sumarCampo(gastos, "alcance");
  const impresionesConAlcance = sumarCampo(gastos, "impresionesConAlcance");
  const presentesAlcance = sumarCampo(gastos, "filasAlcance");
  const coberturaImpresiones = coberturaDeColumnas(filasGasto, presentesImpresiones);
  const coberturaCtr = coberturaDeColumnas(filasGasto, sumarCampo(gastos, "filasCtr"));
  const coberturaLanding = coberturaDeColumnas(filasGasto, sumarCampo(gastos, "filasLlegada"));
  const coberturaConversion = coberturaDeColumnas(filasGasto, presentesLanding);
  const costoCobertura = costoMeta.costoCobertura;
  const costoMetaCelda = costoCobertura.valor === null
    ? sinDato(costoCobertura.motivo ?? (costoMeta.agendasMeta === 0 ? "Sin agendas según Meta" : "Sin gasto de agenda"))
    : conPartes(celda(costoCobertura.valor, costoCobertura.faltan > 0
      ? { estado: "parcial", razon: costoCobertura.motivo }
      : OK), [costoMeta.gasto, costoMeta.agendasMeta]);

  return {
    inversion: filasGasto === 0
      ? sinDato(razonGasto)
      : inversionCop.valor === null
      ? sinDato(inversionCop.razon ?? "No se puede convertir la inversión")
      : celda(inversionCop.valor, OK, otrasCampanasCop),
    agendas: celda(conteos.agendas),
    costo_agenda_crm: costoCrm.costo.valor === null
      ? sinDato(costoCrm.costo.motivo ?? (costoCrm.agendasCrm === 0 ? "Sin agendas del CRM en el periodo" : "Sin gasto de agenda"))
      : conPartes(celda(costoCrm.costo.valor, costoCrm.costo.faltan > 0
        ? { estado: "parcial", razon: costoCrm.costo.motivo }
        : OK), [costoCrm.gasto, costoCrm.agendasCrm]),
    ventas: celda(conteos.ventas),
    facturacion: celda(conteos.vendido, coberturaVenta),
    roas: roasDeCohorte
      ? conPartes(celdaDeRazonConCobertura(roasDeCohorte.roas, "Sin datos para calcular ROAS"), [roasDeCohorte.valorVendidoUsd, roasDeCohorte.gastoUsd])
      : sinDato("ROAS por cohorte no disponible"),
    profit: roasDeCohorte
      ? (() => {
        const base = celdaDeRazonConCobertura(roasDeCohorte.roas, "Sin datos para calcular profit");
        return base.valor === null
          ? base
          : conPartes(celda(roasDeCohorte.valorVendidoUsd - (roasDeCohorte.gastoUsd ?? 0), base.cobertura), [roasDeCohorte.valorVendidoUsd, roasDeCohorte.gastoUsd ?? 0]);
      })()
      : sinDato("Profit por cohorte no disponible"),
    show: conPartes(celdaDeRazonConCobertura(grupo.tasas.razonShow, "Sin citas de Paid en el periodo"), [grupo.tasas.conShow, grupo.tasas.deals]),
    cierre_ventas: conPartes(celdaDeRazonConCobertura(grupo.tasas.razonCierre, "Sin shows de Paid en el periodo"), [grupo.tasas.vendidos, grupo.tasas.conShow]),
    agenda_venta: conPartes(celdaDeRazonConCobertura(grupo.tasas.razonAgendaAVenta, "Sin citas de Paid en el periodo"), [grupo.tasas.vendidos, grupo.tasas.deals]),
    cpm: filasGasto === 0
      ? sinDato(razonGasto)
      : gastoCpmCop.valor === null || impresiones === 0
      ? sinDato(gastoCpmCop.razon ?? "Sin dato de Meta")
      : conPartes(celda(gastoCpmCop.valor / impresiones * 1_000, coberturaImpresiones), [gastoCpmCop.valor, impresiones]),
    ctr: impresionesConClics === 0
      ? sinDato("Sin dato de Meta")
      : conPartes(celda(clicsConImpresiones / impresionesConClics, coberturaCtr), [clicsConImpresiones, impresionesConClics]),
    llegada_landing: clicsConLanding === 0
      ? sinDato("Sin dato de Meta")
      : conPartes(celda(vistasConClics / clicsConLanding, coberturaLanding), [vistasConClics, clicsConLanding]),
    conversion_landing: landing === 0
      ? sinDato("Sin dato de Meta")
      : conPartes(celda(conteos.registros / landing, coberturaConversion), [conteos.registros, landing]),
    agendas_meta: costoMeta.agendasMeta === null
      ? sinDato("Sin dato de Meta")
      : filasGasto === 0
      ? sinDato(razonGasto)
      : celda(costoMeta.agendasMeta),
    costo_agenda_meta: costoMetaCelda,
    frecuencia: rango.desde !== rango.hasta
      ? sinDato("Meta no da el alcance de varios días")
      : alcance === 0 || impresionesConAlcance === 0
        ? sinDato("Sin dato de Meta")
        : conPartes(celda(impresionesConAlcance / alcance, coberturaDeColumnas(filasGasto, presentesAlcance)), [impresionesConAlcance, alcance]),
  };
}

const DEFINICION_FILAS: Array<Pick<FilaPautaSemanal, "clave" | "bloque" | "nombre" | "unidad">> = [
  { clave: "inversion", bloque: "general", nombre: VOCABULARIO_PAUTA_SEMANAL.inversion, unidad: "COP" },
  { clave: "agendas", bloque: "general", nombre: nombreCorto("agendadas"), unidad: "conteo" },
  { clave: "costo_agenda_crm", bloque: "general", nombre: VOCABULARIO_PAUTA_SEMANAL.costo_agenda_crm, unidad: "COP" },
  { clave: "ventas", bloque: "general", nombre: nombreCorto("ventas"), unidad: "conteo" },
  { clave: "facturacion", bloque: "general", nombre: nombreCorto("vendido"), unidad: "USD" },
  { clave: "roas", bloque: "general", nombre: VOCABULARIO_PAUTA_SEMANAL.roas, unidad: "razon" },
  { clave: "profit", bloque: "general", nombre: VOCABULARIO_PAUTA_SEMANAL.profit, unidad: "USD" },
  { clave: "show", bloque: "comercial", nombre: nombreCorto("asistencia"), unidad: "porcentaje" },
  { clave: "cierre_ventas", bloque: "comercial", nombre: nombreCorto("cierre_de_ventas"), unidad: "porcentaje" },
  { clave: "agenda_venta", bloque: "comercial", nombre: nombreCorto("cita_a_venta"), unidad: "porcentaje" },
  { clave: "cpm", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.cpm, unidad: "COP" },
  { clave: "ctr", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.ctr, unidad: "porcentaje" },
  { clave: "llegada_landing", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.llegada_landing, unidad: "porcentaje" },
  { clave: "conversion_landing", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.conversion_landing, unidad: "porcentaje" },
  { clave: "agendas_meta", bloque: "trafico", nombre: EXPLICACIONES_DE_PAUTA.agendas_meta.rotulo, unidad: "conteo" },
  { clave: "costo_agenda_meta", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.costo_agenda_meta, unidad: "COP" },
  { clave: "frecuencia", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.frecuencia, unidad: "razon" },
];

/** Los días del rango, en orden, sin pasar de `hasta`. */
function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let dia = desde; dia <= hasta; dia = sumarDias(dia, 1)) dias.push(dia);
  return dias;
}

function columnasDelPaso(rango: Rango, paso: PasoDeTablaDePauta, hoy: string): Rango[] {
  if (paso === "semana") return semanasDelRango(rango);
  return diasEntre(rango.desde, rango.hasta < hoy ? rango.hasta : hoy).map((dia) => ({ desde: dia, hasta: dia }));
}

/**
 * Por día la tabla tiene hasta 31 columnas, y cada una lee su ROAS, su costo y su dinero: se leen de a pocas para no
 * llenar el pooler con cientos de consultas a la vez.
 */
const COLUMNAS_A_LA_VEZ = 4;
async function porColumnas<T, R>(items: readonly T[], leer: (item: T) => Promise<R>): Promise<R[]> {
  const salida = new Array<R>(items.length);
  let siguiente = 0;
  await Promise.all(Array.from({ length: Math.min(COLUMNAS_A_LA_VEZ, items.length) }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      salida[i] = await leer(items[i]);
    }
  }));
  return salida;
}

/** Las tasas de Comercial esperan citas que todavía no ocurren: en un tramo que sigue en curso son parciales (diseño §4.3). */
const CLAVES_COMERCIALES: readonly ClavePautaSemanal[] = ["show", "cierre_ventas", "agenda_venta"];
function marcarEnCurso(celdas: Record<ClavePautaSemanal, CeldaPautaSemanal>, rango: Rango, hoy: string, paso: PasoDeTablaDePauta, esTotal: boolean) {
  if (rango.desde > hoy || rango.hasta < hoy) return celdas;
  const tramo = esTotal ? "El periodo sigue" : paso === "dia" ? "El día sigue" : "La semana sigue";
  const razon = `${tramo} en curso: faltan citas por ocurrir.`;
  const salida = { ...celdas };
  for (const clave of CLAVES_COMERCIALES) {
    const c = salida[clave];
    if (c.valor !== null && c.cobertura.estado === "ok") salida[clave] = { ...c, cobertura: { estado: "parcial", razon } };
  }
  return salida;
}

export async function cargarPautaSemanal(
  db: Db,
  args: { programId: string; rango: Rango; hoy: string; cohorteId: string | null; paso?: PasoDeTablaDePauta },
): Promise<VistaPautaSemanal> {
  const paso = args.paso ?? "semana";
  const columnas = columnasDelPaso(args.rango, paso, args.hoy);
  const [gastos, agendas, ventas, registros] = await Promise.all([
    db.select({
      semana: sql<string>`date_trunc('week', ${gastoPauta.fecha}::timestamp)::date`,
      fecha: gastoPauta.fecha,
      moneda: gastoPauta.moneda,
      filas: count(),
      monto: sql<number>`sum(${gastoPauta.monto})::double precision`,
      montoConImpresiones: sql<number>`coalesce(sum(${gastoPauta.monto}) filter (where ${gastoPauta.impresiones} is not null), 0)::double precision`,
      impresiones: sql<number | null>`sum(${gastoPauta.impresiones})::double precision`,
      filasImpresiones: sql<number>`count(${gastoPauta.impresiones})::int`,
      impresionesConClics: sql<number | null>`sum(${gastoPauta.impresiones}) filter (where ${gastoPauta.clicsEnlace} is not null)::double precision`,
      clicsConImpresiones: sql<number | null>`sum(${gastoPauta.clicsEnlace}) filter (where ${gastoPauta.impresiones} is not null)::double precision`,
      filasClics: sql<number>`count(${gastoPauta.clicsEnlace})::int`,
      filasCtr: sql<number>`count(*) filter (where ${gastoPauta.impresiones} is not null and ${gastoPauta.clicsEnlace} is not null)::int`,
      clicsConLanding: sql<number | null>`sum(${gastoPauta.clicsEnlace}) filter (where ${gastoPauta.vistasLanding} is not null)::double precision`,
      vistasLanding: sql<number | null>`sum(${gastoPauta.vistasLanding})::double precision`,
      vistasConClics: sql<number | null>`sum(${gastoPauta.vistasLanding}) filter (where ${gastoPauta.clicsEnlace} is not null)::double precision`,
      filasLanding: sql<number>`count(${gastoPauta.vistasLanding})::int`,
      filasLlegada: sql<number>`count(*) filter (where ${gastoPauta.clicsEnlace} is not null and ${gastoPauta.vistasLanding} is not null)::int`,
      impresionesConAlcance: sql<number | null>`sum(${gastoPauta.impresiones}) filter (where ${gastoPauta.alcance} is not null)::double precision`,
      alcance: sql<number | null>`sum(${gastoPauta.alcance})::double precision`,
      filasAlcance: sql<number>`count(${gastoPauta.alcance})::int`,
    }).from(gastoPauta).where(and(
      eq(gastoPauta.programId, args.programId),
      between(gastoPauta.fecha, args.rango.desde, args.rango.hasta),
      esGastoPaid,
    )).groupBy(
      sql`date_trunc('week', ${gastoPauta.fecha}::timestamp)::date`,
      gastoPauta.fecha,
      gastoPauta.moneda,
    ) as Promise<GastoAgrupado[]>,
    agenda.agendasDePauta(db, {
      programId: args.programId,
      rango: args.rango,
      cohorteId: args.cohorteId,
    }).then((filas) => filas.map((fila) => ({ dia: fila.dia!, agendas: fila.agendas }))),
    leerTodasLasVentas(db, args),
    envio.agrupar<"dia" | "semana" | "area">(db, {
      programId: args.programId,
      rango: args.rango,
      agruparPor: ["dia", "semana"],
      filtros: { area: ["paid"] },
    }).then((filas) => filas.map((fila) => ({ dia: fila.dia!, envios: fila.envios }))),
  ]);
  const rangos = [args.rango, ...columnas];
  const ahora = new Date(`${args.hoy}T23:59:59-05:00`);
  const [porRango, grupoTotal, gruposDeColumnas] = await Promise.all([
    porColumnas(rangos, async (rango) => {
      const [gastoUsd, costoMeta, costoCrm, dinero, roas] = await Promise.all([
        gastoConvertido(db, args.programId, rango),
        costoPorAgendaDeVentana(db, {
          programId: args.programId,
          desde: rango.desde,
          hasta: rango.hasta,
          cohorteId: args.cohorteId,
        }),
        // El denominador del costo es la MISMA cifra que pinta la celda "Agendadas" de ese rango (412 F).
        costoPorAgendaDelCrm(db, {
          programId: args.programId,
          desde: rango.desde,
          hasta: rango.hasta,
          agendasCrm: agendas.filter((fila) => enRango(fila.dia, rango)).reduce((n, fila) => n + fila.agendas, 0),
        }),
        dineroDeVentas(db, ventas.filter((fila) => enRango(fila.dia, rango)).map((fila) => fila.dealId)),
        cargarRoasDePauta(db, args.programId, rango, args.hoy, ahora, args.cohorteId),
      ]);
      return { gastoUsd, costoMeta, costoCrm, dinero, roas };
    }),
    grupoDeCitas(db, {
      programId: args.programId,
      rango: args.rango,
      ahora,
      cohorteId: args.cohorteId,
      area: "paid",
    }),
    gruposPorTramo(db, {
      programId: args.programId,
      rango: args.rango,
      ahora,
      cohorteId: args.cohorteId,
      area: "paid",
      tramos: columnas,
    }),
  ]);
  const grupos = [grupoTotal, ...gruposDeColumnas.map(({ grupo }) => grupo)];
  const celdas = await Promise.all(rangos.map(async (rango, i) => marcarEnCurso(await celdasDelRango(
    db,
    rango,
    gastos.filter((fila) => enRango(fila.fecha, rango)),
    conteosDelRango({ rango, agendas, ventas, registros, dinero: porRango[i].dinero }),
    porRango[i].gastoUsd,
    porRango[i].costoMeta,
    porRango[i].costoCrm,
    grupos[i],
    porRango[i].roas?.total ?? null,
  ), rango, args.hoy, paso, i === 0)));
  const filas = DEFINICION_FILAS.map((definicion) => ({
    ...definicion,
    celdas: { total: celdas[0][definicion.clave], porColumna: celdas.slice(1).map((grupo) => grupo[definicion.clave]) },
  }));
  const dias = await Promise.all(diasEntre(args.rango.desde, args.rango.hasta).map(async (dia) => {
    const inversion = await convertirFilas(db, gastos.filter((fila) => fila.fecha === dia), { desde: dia, hasta: dia }, "monto", "COP");
    const delDia = ventas.filter((fila) => fila.dia === dia);
    return {
      dia,
      inversionCop: inversion.valor,
      agendas: agendas.find((fila) => fila.dia === dia)?.agendas ?? 0,
      ventas: delDia.length,
      vendidoUsd: delDia.reduce((n, fila) => n + (fila.valor ?? 0), 0),
      ventasSinValor: delDia.filter((fila) => fila.valor === null).length,
    };
  }));
  return { paso, columnas, filas, dias };
}
