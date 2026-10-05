import { and, eq, inArray } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { cohorts, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario, diasHabilesEntre, metaDinamica, metaLineal } from "@/lib/dias-habiles";
import { ventasConDiaEn, type Rango } from "@/lib/queries/dashboard";
import { vistaDeCohorteActiva } from "@/lib/queries/dashboard";
import { contratadoDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

export interface CohorteParaMetas {
  id: string;
  codigo: string;
  metaCupos: number;
  precioUsd: number;
  fechaInicioVentas: string | null;
  fechaCierreVentas: string;
}

export interface VentaParaMetas {
  dealId: string;
  cohortId: string | null;
  dia: string;
}

export interface FilaMetaDelMes {
  cohorteId: string | null;
  codigo: string;
  metaCupos: number;
  metaUsd: number;
  vendidos: number;
  esperado: number;
  deuda: number;
  deudaPct: number | null;
  cumplimiento: number | null;
}

export interface CompensacionSemanal {
  desde: string;
  hasta: string;
  meta: number;
  vendidos: number;
  faltan: number;
  porDia: number;
  diasHabilesRestantes: number;
}

export interface CompensacionDeCohorte {
  codigo: string;
  porDia: number;
}

export interface MetasDelMesCalculadas {
  mes: string;
  periodoMes: Rango;
  filas: FilaMetaDelMes[];
  cohortesSinVentana: { id: string; codigo: string }[];
  mesSinVentana: boolean;
  metaCupos: number;
  metaUsd: number;
  vendidos: number;
  esperado: number;
  deuda: number;
  deudaPct: number | null;
  avancePct: number | null;
  cumplimiento: number | null;
  compensacionSemanal: CompensacionSemanal | null;
}

export interface MetasDelMes extends MetasDelMesCalculadas {
  contratadoUsd: number;
  ventasSinValorVendido: number;
  compensacionCohorte: CompensacionDeCohorte | null;
}

function fechaDeNumero(numero: number): string {
  const fecha = new Date(numero * 86_400_000);
  const anio = fecha.getUTCFullYear();
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function numeroDeFecha(fecha: string): number {
  const [anio, mes, dia] = diaDeCalendario(fecha).split("-").map(Number);
  return Math.floor(Date.UTC(anio, mes - 1, dia) / 86_400_000);
}

function rangoDelMes(mes: string): Rango {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const primeroSiguiente = Math.floor(Date.UTC(anio, numeroMes, 1) / 86_400_000);
  return { desde: `${mes}-01`, hasta: fechaDeNumero(primeroSiguiente - 1) };
}

function rangoDeLaSemana(hoy: string): Rango {
  const numero = numeroDeFecha(hoy);
  const dia = new Date(numero * 86_400_000).getUTCDay();
  const desde = numero - (dia === 0 ? 6 : dia - 1);
  return { desde: fechaDeNumero(desde), hasta: fechaDeNumero(desde + 6) };
}

function maxFecha(...fechas: string[]): string {
  return fechas.reduce((mayor, fecha) => (fecha > mayor ? fecha : mayor));
}

function minFecha(...fechas: string[]): string {
  return fechas.reduce((menor, fecha) => (fecha < menor ? fecha : menor));
}

function habilesDeInterseccion(inicio: string, cierre: string, rango: Rango): number {
  return diasHabilesEntre(maxFecha(inicio, rango.desde), minFecha(cierre, rango.hasta));
}

const NOMBRES_DE_MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export function nombreDelMes(mes: string): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  return `${NOMBRES_DE_MESES[numeroMes - 1]} ${anio}`;
}

export function moverMes(mes: string, delta: number): string {
  const [anio, numeroMes] = mes.split("-").map(Number);
  const indice = anio * 12 + numeroMes - 1 + delta;
  const nuevoAnio = Math.floor(indice / 12);
  const nuevoMes = indice - nuevoAnio * 12 + 1;
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, "0")}`;
}

/** Arma la meta mensual sin base, reloj ni I/O. Todas las fechas son días de Bogotá. */
export function armarMetasDelMes(args: {
  cohortes: readonly CohorteParaMetas[];
  ventas: readonly VentaParaMetas[];
  mes: string;
  hoy: string;
}): MetasDelMesCalculadas {
  const periodoMes = rangoDelMes(args.mes);
  const hoy = diaDeCalendario(args.hoy);
  const ventasDelMes = args.ventas.filter((venta) => venta.dia >= periodoMes.desde && venta.dia <= periodoMes.hasta);
  const vendidosPorCohorte = new Map<string, number>();
  for (const venta of ventasDelMes) {
    if (venta.cohortId) vendidosPorCohorte.set(venta.cohortId, (vendidosPorCohorte.get(venta.cohortId) ?? 0) + 1);
  }

  const filas = args.cohortes.filter((cohorte) => {
    const ventanaTocaElMes = cohorte.fechaInicioVentas !== null
      && cohorte.fechaInicioVentas <= periodoMes.hasta
      && cohorte.fechaCierreVentas >= periodoMes.desde;
    return ventanaTocaElMes || (vendidosPorCohorte.get(cohorte.id) ?? 0) > 0;
  }).map<FilaMetaDelMes>((cohorte) => {
    const vendidos = vendidosPorCohorte.get(cohorte.id) ?? 0;
    if (!cohorte.fechaInicioVentas) {
      return { cohorteId: cohorte.id, codigo: cohorte.codigo, metaCupos: 0, metaUsd: 0, vendidos, esperado: 0, deuda: 0, deudaPct: null, cumplimiento: null };
    }
    const habilesTotales = diasHabilesEntre(cohorte.fechaInicioVentas, cohorte.fechaCierreVentas);
    const ritmo = metaLineal({ meta: cohorte.metaCupos, diasHabilesTotales: habilesTotales });
    const metaCupos = ritmo * habilesDeInterseccion(cohorte.fechaInicioVentas, cohorte.fechaCierreVentas, periodoMes);
    const hastaHoy = minFecha(periodoMes.hasta, hoy);
    const esperado = ritmo * habilesDeInterseccion(
      cohorte.fechaInicioVentas,
      cohorte.fechaCierreVentas,
      { desde: periodoMes.desde, hasta: hastaHoy },
    );
    const deuda = Math.max(esperado - vendidos, 0);
    return {
      cohorteId: cohorte.id,
      codigo: cohorte.codigo,
      metaCupos,
      metaUsd: metaCupos * cohorte.precioUsd,
      vendidos,
      esperado,
      deuda,
      deudaPct: esperado === 0 ? null : deuda / esperado,
      cumplimiento: esperado === 0 ? null : vendidos / esperado,
    };
  });

  const vendidosSinCohorte = ventasDelMes.filter((venta) => venta.cohortId === null).length;
  if (vendidosSinCohorte > 0) {
    filas.push({
      cohorteId: null,
      codigo: "Sin cohorte",
      metaCupos: 0,
      metaUsd: 0,
      vendidos: vendidosSinCohorte,
      esperado: 0,
      deuda: 0,
      deudaPct: null,
      cumplimiento: null,
    });
  }

  const metaCupos = filas.reduce((total, fila) => total + fila.metaCupos, 0);
  const metaUsd = filas.reduce((total, fila) => total + fila.metaUsd, 0);
  const vendidos = ventasDelMes.length;
  const esperado = filas.reduce((total, fila) => total + fila.esperado, 0);
  const deuda = Math.max(esperado - vendidos, 0);
  const semana = rangoDeLaSemana(hoy);
  let compensacionSemanal: CompensacionSemanal | null = null;

  if (args.mes === hoy.slice(0, 7)) {
    const metaSemana = args.cohortes.reduce((total, cohorte) => {
      if (!cohorte.fechaInicioVentas) return total;
      const ritmo = metaLineal({
        meta: cohorte.metaCupos,
        diasHabilesTotales: diasHabilesEntre(cohorte.fechaInicioVentas, cohorte.fechaCierreVentas),
      });
      return total + ritmo * habilesDeInterseccion(cohorte.fechaInicioVentas, cohorte.fechaCierreVentas, semana);
    }, 0);
    const ventasSemana = args.ventas.filter((venta) => venta.dia >= semana.desde && venta.dia <= semana.hasta).length;
    const diasHabilesRestantes = diasHabilesEntre(hoy, semana.hasta);
    compensacionSemanal = {
      ...semana,
      meta: metaSemana,
      vendidos: ventasSemana,
      faltan: Math.max(metaSemana - ventasSemana, 0),
      diasHabilesRestantes,
      porDia: metaDinamica({ meta: metaSemana, vendidos: ventasSemana, diasHabilesRestantes }),
    };
  }

  return {
    mes: args.mes,
    periodoMes,
    filas,
    cohortesSinVentana: args.cohortes
      .filter((cohorte) => cohorte.fechaInicioVentas === null)
      .map(({ id, codigo }) => ({ id, codigo })),
    mesSinVentana: !args.cohortes.some((cohorte) =>
      cohorte.fechaInicioVentas !== null
      && cohorte.fechaInicioVentas <= periodoMes.hasta
      && cohorte.fechaCierreVentas >= periodoMes.desde),
    metaCupos,
    metaUsd,
    vendidos,
    esperado,
    deuda,
    deudaPct: esperado === 0 ? null : deuda / esperado,
    avancePct: metaCupos === 0 ? null : vendidos / metaCupos,
    cumplimiento: esperado === 0 ? null : vendidos / esperado,
    compensacionSemanal,
  };
}

/**
 * Las cohortes del programa y sus ventas con día en el rango: lo que `armarMetasDelMes` necesita.
 * Lo usan la meta del mes y las alertas por persistencia (147), así que las dos cuentan lo mismo.
 */
export async function leerCohortesYVentas(
  db: Db,
  programId: string,
  rangoLectura: Rango,
): Promise<{ cohortes: CohorteParaMetas[]; ventas: VentaParaMetas[] }> {
  const [filasCohortes, ventasConDia] = await Promise.all([
    db
      .select({
        id: cohorts.id,
        codigo: cohorts.codigo,
        metaCupos: cohorts.metaCupos,
        precioUsd: cohorts.precioUsd,
        fechaInicioVentas: cohorts.fechaInicioVentas,
        fechaCierreVentas: cohorts.fechaCierreVentas,
      })
      .from(cohorts)
      .where(eq(cohorts.programId, programId)),
    ventasConDiaEn(db, rangoLectura),
  ]);
  const idsVendidos = ventasConDia.map((venta) => venta.dealId);
  const dealsVendidos = idsVendidos.length === 0
    ? []
    : await db
      .select({ dealId: deals.id, cohortId: deals.cohortId })
      .from(deals)
      .where(and(inArray(deals.id, idsVendidos), eq(deals.programId, programId), vigente(deals)));

  const cohortes = filasCohortes.map<CohorteParaMetas>((cohorte) => ({
    ...cohorte,
    precioUsd: Number(cohorte.precioUsd),
  }));
  const diaPorDeal = new Map(ventasConDia.map((venta) => [venta.dealId, diaDeCalendario(venta.dia)]));
  const ventas = dealsVendidos.map<VentaParaMetas>((venta) => ({
    ...venta,
    dia: diaPorDeal.get(venta.dealId)!,
  }));
  return { cohortes, ventas };
}

export async function leerMetasDelMes(
  programId: string,
  mes: string,
  hoy: string,
  db: Db = dbDeLaApp,
): Promise<MetasDelMes> {
  const periodoMes = rangoDelMes(mes);
  const semana = rangoDeLaSemana(hoy);
  const rangoLectura = mes === hoy.slice(0, 7)
    ? { desde: minFecha(periodoMes.desde, semana.desde), hasta: maxFecha(periodoMes.hasta, semana.hasta) }
    : periodoMes;
  const { cohortes, ventas } = await leerCohortesYVentas(db, programId, rangoLectura);
  const resultado = armarMetasDelMes({ cohortes, ventas, mes, hoy });
  const idsDelMes = ventas
    .filter((venta) => venta.dia >= resultado.periodoMes.desde && venta.dia <= resultado.periodoMes.hasta)
    .map((venta) => venta.dealId);
  const [contratado, cohorteActiva] = await Promise.all([
    contratadoDeDeals(db, idsDelMes),
    vistaDeCohorteActiva({ programId, claveCloser: null }, hoy, db),
  ]);

  return {
    ...resultado,
    contratadoUsd: contratado.usd,
    ventasSinValorVendido: contratado.sinValorVendido,
    compensacionCohorte: cohorteActiva?.ventana
      ? { codigo: cohorteActiva.codigo, porDia: cohorteActiva.ventana.metaDinamica }
      : null,
  };
}
