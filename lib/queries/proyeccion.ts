import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { cohorts, objetivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilAnterior, diaHabilSiguiente, diasHabilesEntre } from "@/lib/dias-habiles";
import { agrupar as agruparAgendas } from "@/lib/queries/hechos/agenda";
import { agrupar as agruparEnvios } from "@/lib/queries/hechos/envio";
import { agrupar as agruparVentas } from "@/lib/queries/hechos/venta";

export const VENTANA_RITMO_POR_DEFECTO = 10;

export interface ValorDeProyeccion {
  valor: number | null;
  razon: string | null;
}

export interface TramoSemanal {
  tipo: "resto_semana" | "semana" | "final";
  desde: string;
  hasta: string;
  diasHabiles: number;
  ventas: number;
}

export interface ProyeccionDeCohorte {
  cohorte: { codigo: string; metaCupos: number; metaLeadsDia: number | null } | null;
  vendidos: number;
  faltan: number;
  diasHabilesRestantes: number;
  ritmo: ValorDeProyeccion;
  proyeccion: ValorDeProyeccion;
  ventasRequeridasDia: ValorDeProyeccion;
  agendasRequeridasDia: ValorDeProyeccion;
  leadsRequeridosDia: ValorDeProyeccion;
  repartoSemanal: TramoSemanal[];
  supuestos: {
    ventanaDiasHabiles: number;
    ventanaDesde: string;
    ventanaHasta: string;
    conversionAgendaVenta: number | null;
    origenConversion: "objetivo_cohorte" | "cohorte_anterior" | "sin_conversion";
    cohorteAnteriorCodigo: string | null;
  };
}

export interface DatosParaProyeccion {
  hoy: string;
  cohorte: {
    codigo: string;
    metaCupos: number;
    metaLeadsDia: number | null;
    fechaCierreVentas: string;
  } | null;
  vendidos: number;
  ventasVentana: number;
  agendasVentana: number;
  registrosVentana: number;
  diasHabilesVentana: number;
  ventanaDiasHabiles: number;
  ventanaDesde: string;
  ventanaHasta: string;
  conversionAgendaVenta: number | null;
  origenConversion: ProyeccionDeCohorte["supuestos"]["origenConversion"];
  cohorteAnteriorCodigo?: string | null;
}

const disponible = (valor: number): ValorDeProyeccion => ({ valor, razon: null });
const noDisponible = (razon: string): ValorDeProyeccion => ({ valor: null, razon });

function fechaUtc(anio: number, mes: number, dia: number): string {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return fechaUtc(anio, mes, dia + dias);
}

function lunesDe(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const semana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return sumarDias(fecha, semana === 0 ? -6 : 1 - semana);
}

/** Reparte el faltante desde el siguiente día hábil, conservando exactamente el total. */
export function repartirFaltantePorSemana(args: {
  hoy: string;
  cierre: string;
  faltan: number;
}): TramoSemanal[] {
  const primero = diaHabilSiguiente(args.hoy);
  const dias = diasHabilesEntre(primero, args.cierre);
  if (dias === 0 || args.faltan <= 0) return [];

  const grupos = new Map<string, string[]>();
  let fecha = primero;
  while (fecha <= args.cierre) {
    const semana = lunesDe(fecha);
    grupos.set(semana, [...(grupos.get(semana) ?? []), fecha]);
    fecha = diaHabilSiguiente(fecha);
  }
  const semanaActual = lunesDe(args.hoy);
  return [...grupos.entries()].map(([semana, fechas]) => ({
    tipo: semana === semanaActual ? "resto_semana" : fechas.length === 5 ? "semana" : "final",
    desde: fechas[0],
    hasta: fechas.at(-1)!,
    diasHabiles: fechas.length,
    ventas: args.faltan * fechas.length / dias,
  }));
}

/** Fórmulas de Planeación de `docs/metricas.md`, sin I/O ni redondeos de presentación. */
export function calcularProyeccion(datos: DatosParaProyeccion): ProyeccionDeCohorte {
  const base = {
    cohorte: datos.cohorte && {
      codigo: datos.cohorte.codigo,
      metaCupos: datos.cohorte.metaCupos,
      metaLeadsDia: datos.cohorte.metaLeadsDia,
    },
    supuestos: {
      ventanaDiasHabiles: datos.ventanaDiasHabiles,
      ventanaDesde: datos.ventanaDesde,
      ventanaHasta: datos.ventanaHasta,
      conversionAgendaVenta: datos.conversionAgendaVenta,
      origenConversion: datos.origenConversion,
      cohorteAnteriorCodigo: datos.cohorteAnteriorCodigo ?? null,
    },
  };
  if (!datos.cohorte) {
    const valor = noDisponible("No hay una cohorte activa.");
    return {
      ...base,
      vendidos: 0,
      faltan: 0,
      diasHabilesRestantes: 0,
      ritmo: valor,
      proyeccion: valor,
      ventasRequeridasDia: valor,
      agendasRequeridasDia: valor,
      leadsRequeridosDia: valor,
      repartoSemanal: [],
    };
  }

  const faltan = Math.max(datos.cohorte.metaCupos - datos.vendidos, 0);
  const manana = diaHabilSiguiente(datos.hoy);
  const diasHabilesRestantes = diasHabilesEntre(manana, datos.cohorte.fechaCierreVentas);
  const ritmo = datos.ventasVentana > 0 && datos.diasHabilesVentana > 0
    ? disponible(datos.ventasVentana / datos.diasHabilesVentana)
    : noDisponible("No hay ventas en la ventana de ritmo.");
  const proyeccion = ritmo.valor === null
    ? noDisponible(ritmo.razon!)
    : disponible(datos.vendidos + ritmo.valor * diasHabilesRestantes);
  const ventasRequeridasDia = faltan === 0
    ? disponible(0)
    : diasHabilesRestantes > 0
      ? disponible(faltan / diasHabilesRestantes)
      : noDisponible("No quedan días hábiles en la cohorte.");
  const agendasRequeridasDia = ventasRequeridasDia.valor === null
    ? noDisponible(ventasRequeridasDia.razon!)
    : ventasRequeridasDia.valor === 0
      ? disponible(0)
      : datos.conversionAgendaVenta && datos.conversionAgendaVenta > 0
        ? disponible(ventasRequeridasDia.valor / datos.conversionAgendaVenta)
        : noDisponible("No hay una conversión agenda → venta mayor que cero.");
  const leadsRequeridosDia = agendasRequeridasDia.valor === null
    ? noDisponible(agendasRequeridasDia.razon!)
    : agendasRequeridasDia.valor === 0
      ? disponible(0)
      : datos.agendasVentana > 0 && datos.registrosVentana > 0
        ? disponible(agendasRequeridasDia.valor / (datos.agendasVentana / datos.registrosVentana))
        : noDisponible("No hay agendas y registros suficientes en la ventana.");

  return {
    ...base,
    vendidos: datos.vendidos,
    faltan,
    diasHabilesRestantes,
    ritmo,
    proyeccion,
    ventasRequeridasDia,
    agendasRequeridasDia,
    leadsRequeridosDia,
    repartoSemanal: repartirFaltantePorSemana({
      hoy: datos.hoy,
      cierre: datos.cohorte.fechaCierreVentas,
      faltan,
    }),
  };
}

function inicioDeVentana(hoy: string, diasHabiles: number): string {
  let fecha = hoy;
  for (let i = 1; i < diasHabiles; i++) fecha = diaHabilAnterior(fecha);
  return fecha;
}

const total = <T extends "ventas" | "agendas" | "envios">(
  filas: Array<Record<T, number>>,
  medida: T,
) => filas.reduce((suma, fila) => suma + fila[medida], 0);

/** Lee una sola frontera de programa y delega todos los conteos a la capa de hechos. */
export async function leerProyeccion(
  { programId, hoy, ventanaDiasHabiles = VENTANA_RITMO_POR_DEFECTO }: {
    programId: string;
    hoy: string;
    ventanaDiasHabiles?: number;
  },
  db: Db = dbDeLaApp,
): Promise<ProyeccionDeCohorte> {
  const ventanaInicial = inicioDeVentana(hoy, ventanaDiasHabiles);
  const [cohorte] = await db.select({
    id: cohorts.id,
    codigo: cohorts.codigo,
    metaCupos: cohorts.metaCupos,
    metaLeadsDia: cohorts.metaLeadsDia,
    fechaInicioVentas: cohorts.fechaInicioVentas,
    fechaCierreVentas: cohorts.fechaCierreVentas,
  }).from(cohorts).where(and(eq(cohorts.programId, programId), eq(cohorts.estado, "activo"))).limit(1);

  if (!cohorte?.fechaInicioVentas || !cohorte.fechaCierreVentas) {
    return calcularProyeccion({
      hoy,
      cohorte: null,
      vendidos: 0,
      ventasVentana: 0,
      agendasVentana: 0,
      registrosVentana: 0,
      diasHabilesVentana: 0,
      ventanaDiasHabiles,
      ventanaDesde: ventanaInicial,
      ventanaHasta: hoy,
      conversionAgendaVenta: null,
      origenConversion: "sin_conversion",
    });
  }

  const ventanaDesde = cohorte.fechaInicioVentas > ventanaInicial ? cohorte.fechaInicioVentas : ventanaInicial;
  const ventanaHasta = cohorte.fechaCierreVentas < hoy ? cohorte.fechaCierreVentas : hoy;
  const [objetivo] = await db.select({ meta: objetivos.meta }).from(objetivos).where(and(
    eq(objetivos.cohortId, cohorte.id),
    eq(objetivos.metrica, "conversion_agenda_venta"),
    isNull(objetivos.area),
    eq(objetivos.activo, true),
  )).limit(1);
  const [anterior] = objetivo ? [] : await db.select({
    id: cohorts.id,
    codigo: cohorts.codigo,
    fechaInicioVentas: cohorts.fechaInicioVentas,
    fechaCierreVentas: cohorts.fechaCierreVentas,
  }).from(cohorts).where(and(
    eq(cohorts.programId, programId),
    eq(cohorts.estado, "cerrado"),
    lt(cohorts.fechaCierreVentas, cohorte.fechaInicioVentas),
  )).orderBy(desc(cohorts.fechaCierreVentas)).limit(1);

  const rangoVentana = { desde: ventanaDesde, hasta: ventanaHasta };
  const rangoCohorte = { desde: cohorte.fechaInicioVentas, hasta: ventanaHasta };
  const consultas = [
    agruparVentas(db, { programId, rango: rangoCohorte, agruparPor: [], filtros: { cohorte: [cohorte.id] } }),
    agruparVentas(db, { programId, rango: rangoVentana, agruparPor: [], filtros: { cohorte: [cohorte.id] } }),
    agruparAgendas(db, { programId, rango: rangoVentana, agruparPor: [], filtros: { cohorte: [cohorte.id] } }),
    agruparEnvios(db, { programId, rango: rangoVentana, agruparPor: [] }),
  ] as const;
  const [ventas, ventasVentana, agendasVentana, registrosVentana] = await Promise.all(consultas);

  let conversionAgendaVenta = objetivo ? Number(objetivo.meta) / 100 : null;
  let origenConversion: ProyeccionDeCohorte["supuestos"]["origenConversion"] = objetivo
    ? "objetivo_cohorte"
    : "sin_conversion";
  if (!objetivo && anterior?.fechaInicioVentas && anterior.fechaCierreVentas) {
    const rangoAnterior = { desde: anterior.fechaInicioVentas, hasta: anterior.fechaCierreVentas };
    const [ventasAnteriores, agendasAnteriores] = await Promise.all([
      agruparVentas(db, { programId, rango: rangoAnterior, agruparPor: [], filtros: { cohorte: [anterior.id] } }),
      agruparAgendas(db, { programId, rango: rangoAnterior, agruparPor: [], filtros: { cohorte: [anterior.id] } }),
    ]);
    const agendas = total(agendasAnteriores, "agendas");
    conversionAgendaVenta = agendas > 0 ? total(ventasAnteriores, "ventas") / agendas : null;
    origenConversion = conversionAgendaVenta === null ? "sin_conversion" : "cohorte_anterior";
  }

  return calcularProyeccion({
    hoy,
    cohorte: {
      codigo: cohorte.codigo,
      metaCupos: cohorte.metaCupos,
      metaLeadsDia: cohorte.metaLeadsDia,
      fechaCierreVentas: cohorte.fechaCierreVentas,
    },
    vendidos: total(ventas, "ventas"),
    ventasVentana: total(ventasVentana, "ventas"),
    agendasVentana: total(agendasVentana, "agendas"),
    registrosVentana: total(registrosVentana, "envios"),
    diasHabilesVentana: diasHabilesEntre(ventanaDesde, ventanaHasta),
    ventanaDiasHabiles,
    ventanaDesde,
    ventanaHasta,
    conversionAgendaVenta,
    origenConversion,
    cohorteAnteriorCodigo: anterior?.codigo ?? null,
  });
}
