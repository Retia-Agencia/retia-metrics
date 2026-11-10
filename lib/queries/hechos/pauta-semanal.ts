import { and, between, count, eq, sql } from "drizzle-orm";
import { showPorCita } from "@/lib/deals/resultados-de-llamada";
import { gastoPauta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { convertirGasto } from "@/lib/pauta/convertir-gasto";
import { diaCubierto, motivoDeGasto } from "@/lib/pauta/cobertura-de-gasto";
import type { Rango } from "@/lib/queries/dashboard";
import { dineroDeVentas, type DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import * as agenda from "@/lib/queries/hechos/agenda";
import * as cita from "@/lib/queries/hechos/cita";
import * as envio from "@/lib/queries/hechos/envio";
import { esGastoPaid, gastoConvertido, type VistaGasto } from "@/lib/queries/hechos/gasto";
import * as venta from "@/lib/queries/hechos/venta";
import { valoresVendidosDeDeals } from "@/lib/queries/saldo";
import { semanasDelRango } from "@/lib/rangos";
import { costoPorAgendaDelCrm, type CostoPorAgendaDelCrm } from "@/lib/queries/hechos/costo-agenda-crm";
import { costoPorAgendaDeVentana, type CostoPorAgenda } from "@/lib/semaforo/costo-por-agenda";
import { tasasDelRango } from "@/lib/trm/consultar";
import { sumarDias } from "@/lib/dias-habiles";
import { VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";

export type BloquePautaSemanal = "general" | "comercial" | "trafico";
export type UnidadPautaSemanal = "COP" | "USD" | "conteo" | "razon" | "porcentaje";
export type ClavePautaSemanal =
  | "inversion" | "agendas" | "costo_agenda_crm" | "ventas" | "facturacion" | "roas" | "profit"
  | "show" | "cierre_ventas" | "agenda_venta"
  | "cpm" | "ctr" | "llegada_landing" | "conversion_landing" | "costo_agenda_meta" | "frecuencia";

export interface CoberturaPautaSemanal {
  estado: "ok" | "parcial" | "sin_dato";
  razon: string | null;
}

export interface CeldaPautaSemanal {
  valor: number | null;
  cobertura: CoberturaPautaSemanal;
  /** Desglose que la UI formatea; hoy solo la inversión que no fue agenda ni lanzamiento. */
  otrasCampanasCop?: number;
}

export interface FilaPautaSemanal {
  clave: ClavePautaSemanal;
  bloque: BloquePautaSemanal;
  nombre: string;
  unidad: UnidadPautaSemanal;
  celdas: { total: CeldaPautaSemanal; porSemana: CeldaPautaSemanal[] };
}

export interface PuntoDiarioPautaSemanal {
  dia: string;
  inversionCop: number | null;
  agendas: number;
}

export interface VistaPautaSemanal {
  semanas: Rango[];
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
type Conteos = { agendas: number; ventas: number; vendido: number; ventasSinValor: number; diasDeVentas: string[]; citas: number; shows: number; registros: number };

const OK: CoberturaPautaSemanal = { estado: "ok", razon: null };
const celda = (valor: number | null, cobertura: CoberturaPautaSemanal = OK, otrasCampanasCop?: number): CeldaPautaSemanal =>
  ({ valor, cobertura, ...(otrasCampanasCop !== undefined ? { otrasCampanasCop } : {}) });
const sinDato = (razon: string): CeldaPautaSemanal => celda(null, { estado: "sin_dato", razon });
const dividir = (numerador: number, denominador: number, razon: string): CeldaPautaSemanal =>
  denominador === 0 ? sinDato(razon) : celda(numerador / denominador);

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
  citas: Array<{ dia: string; citas: number; shows: number }>;
  registros: Array<{ dia: string; envios: number }>;
  dinero: DineroDeVentas;
}): Conteos {
  const agendas = args.agendas.filter((fila) => enRango(fila.dia, args.rango)).reduce((n, fila) => n + fila.agendas, 0);
  const ventas = args.ventas.filter((fila) => enRango(fila.dia, args.rango));
  const citas = args.citas.filter((fila) => enRango(fila.dia, args.rango));
  return {
    agendas,
    ventas: ventas.length,
    vendido: args.dinero.vendido,
    ventasSinValor: ventas.filter((fila) => fila.valor === null).length,
    diasDeVentas: ventas.map((fila) => fila.dia),
    citas: citas.reduce((n, fila) => n + fila.citas, 0),
    shows: citas.reduce((n, fila) => n + fila.shows, 0),
    registros: args.registros.filter((fila) => enRango(fila.dia, args.rango)).reduce((n, fila) => n + fila.envios, 0),
  };
}

function coberturaDeVenta(conteos: Conteos): CoberturaPautaSemanal {
  if (conteos.ventasSinValor === 0) return OK;
  return { estado: "parcial", razon: `${conteos.ventasSinValor} ventas sin valor vendido` };
}

function celdaDeRazon(valor: number | null, razon: string, cobertura: CoberturaPautaSemanal = OK): CeldaPautaSemanal {
  if (valor === null) return sinDato(razon);
  return celda(valor, cobertura);
}

async function celdasDelRango(
  db: Db,
  rango: Rango,
  gastos: readonly GastoAgrupado[],
  conteos: Conteos,
  gastoUsd: VistaGasto,
  costoMeta: CostoPorAgenda,
  costoCrm: CostoPorAgendaDelCrm,
): Promise<Record<ClavePautaSemanal, CeldaPautaSemanal>> {
  const filasGasto = gastos.reduce((n, fila) => n + fila.filas, 0);
  const inversionCop = await convertirFilas(db, gastos, rango, "monto", "COP");
  const gastoCpmCop = await convertirFilas(db, gastos.filter((fila) => fila.filasImpresiones > 0), rango, "montoConImpresiones", "COP");
  const otras = costoMeta.gastoTotal - costoMeta.gasto - costoMeta.lanzamiento.gasto;
  const otrasCampanasCop = inversionCop.valor === null ? undefined : Math.max(0, otras);
  const coberturaVenta = coberturaDeVenta(conteos);
  const ventasFueraDeCobertura = conteos.diasDeVentas.filter((dia) => !diaCubierto(dia, gastoUsd.cobertura)).length;
  const gastoIncompleto = gastoUsd.diasSinTrm.length > 0 || ventasFueraDeCobertura > 0;
  const razonGasto = gastoUsd.diasSinTrm.length > 0
    ? `Falta TRM para ${gastoUsd.diasSinTrm.join(", ")}`
    : motivoDeGasto(gastoUsd.cobertura);
  const gastoUsdValido = gastoIncompleto ? null : gastoUsd.totalUsd;
  const roas = gastoUsdValido === null || conteos.ventasSinValor > 0 || gastoUsdValido === 0
    ? null
    : conteos.vendido / gastoUsdValido;
  const profit = gastoUsdValido === null || conteos.ventasSinValor > 0 ? null : conteos.vendido - gastoUsdValido;
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
  const show = showPorCita(conteos.shows, conteos.citas);
  const costoCobertura = costoMeta.costoCobertura;
  const costoMetaCelda = costoCobertura.valor === null
    ? sinDato(costoCobertura.motivo ?? (costoMeta.agendasMeta === 0 ? "Sin agendas según Meta" : "Sin gasto de agenda"))
    : celda(costoCobertura.valor, costoCobertura.faltan > 0
      ? { estado: "parcial", razon: costoCobertura.motivo }
      : OK);

  return {
    inversion: inversionCop.valor === null
      ? sinDato(inversionCop.razon ?? "No se puede convertir la inversión")
      : celda(inversionCop.valor, OK, otrasCampanasCop),
    agendas: celda(conteos.agendas),
    costo_agenda_crm: costoCrm.costo.valor === null
      ? sinDato(costoCrm.costo.motivo ?? (costoCrm.agendasCrm === 0 ? "Sin agendas del CRM en el periodo" : "Sin gasto de agenda"))
      : celda(costoCrm.costo.valor, costoCrm.costo.faltan > 0
        ? { estado: "parcial", razon: costoCrm.costo.motivo }
        : OK),
    ventas: celda(conteos.ventas),
    facturacion: celda(conteos.vendido, coberturaVenta),
    roas: roas === null
      ? sinDato(conteos.ventasSinValor > 0 ? coberturaVenta.razon! : gastoUsdValido === 0 ? "Sin pauta" : razonGasto)
      : celda(roas),
    profit: profit === null
      ? sinDato(conteos.ventasSinValor > 0 ? coberturaVenta.razon! : razonGasto)
      : celda(profit),
    show: celdaDeRazon(show, "Sin citas de Paid en el periodo"),
    cierre_ventas: dividir(conteos.ventas, conteos.shows, "Sin shows de Paid en el periodo"),
    agenda_venta: dividir(conteos.ventas, conteos.citas, "Sin citas de Paid en el periodo"),
    cpm: gastoCpmCop.valor === null || impresiones === 0
      ? sinDato(gastoCpmCop.razon ?? "Sin dato de Meta")
      : celda(gastoCpmCop.valor / impresiones * 1_000, coberturaImpresiones),
    ctr: impresionesConClics === 0
      ? sinDato("Sin dato de Meta")
      : celda(clicsConImpresiones / impresionesConClics, coberturaCtr),
    llegada_landing: clicsConLanding === 0
      ? sinDato("Sin dato de Meta")
      : celda(vistasConClics / clicsConLanding, coberturaLanding),
    conversion_landing: landing === 0
      ? sinDato("Sin dato de Meta")
      : celda(conteos.registros / landing, coberturaConversion),
    costo_agenda_meta: costoMetaCelda,
    frecuencia: rango.desde !== rango.hasta
      ? sinDato("Meta no da el alcance de varios días")
      : alcance === 0 || impresionesConAlcance === 0
        ? sinDato("Sin dato de Meta")
        : celda(impresionesConAlcance / alcance, coberturaDeColumnas(filasGasto, presentesAlcance)),
  };
}

const DEFINICION_FILAS: Array<Pick<FilaPautaSemanal, "clave" | "bloque" | "nombre" | "unidad">> = [
  { clave: "inversion", bloque: "general", nombre: "Inversión", unidad: "COP" },
  { clave: "agendas", bloque: "general", nombre: "Agendas", unidad: "conteo" },
  { clave: "costo_agenda_crm", bloque: "general", nombre: "Costo por agenda", unidad: "COP" },
  { clave: "ventas", bloque: "general", nombre: "Ventas", unidad: "conteo" },
  { clave: "facturacion", bloque: "general", nombre: "Facturación", unidad: "USD" },
  { clave: "roas", bloque: "general", nombre: "ROAS", unidad: "razon" },
  { clave: "profit", bloque: "general", nombre: VOCABULARIO_PAUTA_SEMANAL.profit, unidad: "USD" },
  { clave: "show", bloque: "comercial", nombre: "% de show", unidad: "porcentaje" },
  { clave: "cierre_ventas", bloque: "comercial", nombre: "Cierre de ventas", unidad: "porcentaje" },
  { clave: "agenda_venta", bloque: "comercial", nombre: "Agenda → venta", unidad: "porcentaje" },
  { clave: "cpm", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.cpm, unidad: "COP" },
  { clave: "ctr", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.ctr, unidad: "porcentaje" },
  { clave: "llegada_landing", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.llegada_landing, unidad: "porcentaje" },
  { clave: "conversion_landing", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.conversion_landing, unidad: "porcentaje" },
  { clave: "costo_agenda_meta", bloque: "trafico", nombre: "Costo por agenda (según Meta)", unidad: "COP" },
  { clave: "frecuencia", bloque: "trafico", nombre: VOCABULARIO_PAUTA_SEMANAL.frecuencia, unidad: "razon" },
];

export async function cargarPautaSemanal(
  db: Db,
  args: { programId: string; rango: Rango; hoy: string; cohorteId: string | null },
): Promise<VistaPautaSemanal> {
  const semanas = semanasDelRango(args.rango);
  const [gastos, agendas, ventas, citas, registros] = await Promise.all([
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
    agenda.agrupar<"dia" | "semana" | "area" | "cohorte">(db, {
      programId: args.programId,
      rango: args.rango,
      agruparPor: ["dia", "semana"],
      filtros: { area: ["paid"], ...(args.cohorteId ? { cohorte: [args.cohorteId] } : {}) },
    }).then((filas) => filas.map((fila) => ({ dia: fila.dia!, agendas: fila.agendas }))),
    leerTodasLasVentas(db, args),
    cita.agrupar<"dia" | "semana" | "area" | "cohorte">(db, {
      programId: args.programId,
      rango: args.rango,
      agruparPor: ["dia", "semana"],
      filtros: { area: ["paid"], ...(args.cohorteId ? { cohorte: [args.cohorteId] } : {}) },
    }).then((filas) => filas.map((fila) => ({ dia: fila.dia!, citas: fila.citas, shows: fila.shows }))),
    envio.agrupar<"dia" | "semana" | "area">(db, {
      programId: args.programId,
      rango: args.rango,
      agruparPor: ["dia", "semana"],
      filtros: { area: ["paid"] },
    }).then((filas) => filas.map((fila) => ({ dia: fila.dia!, envios: fila.envios }))),
  ]);
  const rangos = [args.rango, ...semanas];
  const [gastosUsd, costosMeta, costosCrm, dineros] = await Promise.all([
    Promise.all(rangos.map((rango) => gastoConvertido(db, args.programId, rango))),
    Promise.all(rangos.map((rango) => costoPorAgendaDeVentana(db, {
      programId: args.programId,
      desde: rango.desde,
      hasta: rango.hasta,
    }))),
    Promise.all(rangos.map((rango) => costoPorAgendaDelCrm(db, {
      programId: args.programId,
      desde: rango.desde,
      hasta: rango.hasta,
    }))),
    Promise.all(rangos.map((rango) => dineroDeVentas(
      db,
      ventas.filter((fila) => enRango(fila.dia, rango)).map((fila) => fila.dealId),
    ))),
  ]);
  const celdas = await Promise.all(rangos.map((rango, i) => celdasDelRango(
    db,
    rango,
    gastos.filter((fila) => enRango(fila.fecha, rango)),
    conteosDelRango({ rango, agendas, ventas, citas, registros, dinero: dineros[i] }),
    gastosUsd[i],
    costosMeta[i],
    costosCrm[i],
  )));
  const filas = DEFINICION_FILAS.map((definicion) => ({
    ...definicion,
    celdas: { total: celdas[0][definicion.clave], porSemana: celdas.slice(1).map((grupo) => grupo[definicion.clave]) },
  }));
  const diasDelRango: string[] = [];
  for (let dia = args.rango.desde; dia <= args.rango.hasta; dia = sumarDias(dia, 1)) diasDelRango.push(dia);
  const dias = await Promise.all(diasDelRango.map(async (dia) => {
    const inversion = await convertirFilas(db, gastos.filter((fila) => fila.fecha === dia), { desde: dia, hasta: dia }, "monto", "COP");
    return { dia, inversionCop: inversion.valor, agendas: agendas.find((fila) => fila.dia === dia)?.agendas ?? 0 };
  }));
  return { semanas, filas, dias };
}
