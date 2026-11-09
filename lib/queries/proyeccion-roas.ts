import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { claveCloserSql, etiquetaDeCloserSql } from "@/lib/closers/identidad";
import type { RazonConCobertura } from "@/lib/cobertura";
import { calls, cohorts, deals, programs, proyeccionesRoas, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { citaPorVenirDeDealAbierto } from "@/lib/deals/resultados-de-llamada";
import { sumarDias } from "@/lib/dias-habiles";
import type { Rango } from "@/lib/queries/dashboard";
import { cargarRoasDePauta, type VistaRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { grupoDeCitas, type TasasDelGrupo } from "@/lib/queries/tasas-del-grupo";
import { vigente } from "@/lib/queries/vigente";

/**
 * El ROAS proyectado (ticket 375, Daniel Tovar 3-nov): lo vendido a hoy más lo que se espera de las citas que
 * todavía no ocurren, entre el gasto. Por cada cita pendiente: prob. de show × prob. de cierre × precio de la
 * cohorte de su deal, con las probabilidades de SU closer en las últimas semanas. Un closer con menos de la
 * muestra mínima del programa usa la tasa del programa y lo dice; sin muestra o sin gasto completo el proyectado
 * es `null` con su motivo, nunca un número a secas (ADR 0115 N3). Todo en USD; un programa, nunca cruzado.
 */

/** Las semanas de historia con las que se miden show y cierre. Mani, 9-nov: 3. ponytail: sin columna en `programs` todavía; si Gerencia lo quiere editable, es una columna y esta constante pasa a ser su valor por defecto. */
export const SEMANAS_DE_MUESTRA = 3;

export interface CitaPendiente {
  callId: string;
  claveCloser: string;
  closer: string | null;
  fecha: Date;
  /** Precio de la cohorte del deal; `null` si el deal no tiene cohorte. */
  ticketUsd: number | null;
}

/** Lo que mide un grupo de citas ocurridas: personas con cita, con show y con venta. */
export interface MuestraDeTasas {
  deals: number;
  conShow: number;
  vendidos: number;
}

export interface SupuestoDeCloser {
  clave: string;
  closer: string | null;
  citas: number;
  /** Personas con cita del closer en la ventana. */
  muestra: number;
  pShow: number | null;
  pCierre: number | null;
  /** `true` si el closer no llega a la muestra mínima y se usó la tasa del programa. */
  usaPrograma: boolean;
  esperadoUsd: number;
}

export interface SupuestosDeProyeccion {
  semanas: number;
  muestraMinima: number;
  programa: { muestra: number; pShow: number | null; pCierre: number | null };
  porCloser: SupuestoDeCloser[];
  citasPendientesIds: string[];
  sinTicket: number;
}

export interface ProyeccionPura {
  valor: number | null;
  motivo: string | null;
  esperadoUsd: number;
  supuestos: SupuestosDeProyeccion;
}

const cociente = (n: number, d: number): number | null => (d === 0 ? null : n / d);
const usable = (m: MuestraDeTasas, minima: number) => m.deals >= minima && m.conShow > 0;

/** La cuenta, sin base ni reloj. */
export function proyectarRoas(args: {
  vendidoUsd: number;
  gastoUsd: number | null;
  roasAHoy: RazonConCobertura;
  pendientes: readonly CitaPendiente[];
  porCloser: ReadonlyMap<string, MuestraDeTasas>;
  programa: MuestraDeTasas;
  muestraMinima: number;
}): ProyeccionPura {
  const { programa, muestraMinima } = args;
  const supuestos: SupuestosDeProyeccion = {
    semanas: SEMANAS_DE_MUESTRA,
    muestraMinima,
    programa: { muestra: programa.deals, pShow: cociente(programa.conShow, programa.deals), pCierre: cociente(programa.vendidos, programa.conShow) },
    porCloser: [],
    citasPendientesIds: args.pendientes.map((c) => c.callId),
    sinTicket: args.pendientes.filter((c) => c.ticketUsd === null).length,
  };
  const sin = (motivo: string): ProyeccionPura => ({ valor: null, motivo, esperadoUsd: 0, supuestos });
  if (args.roasAHoy.valor === null || args.gastoUsd === null || args.gastoUsd <= 0) {
    return sin(args.roasAHoy.motivo ?? "El ROAS a hoy no se puede calcular");
  }
  if (args.pendientes.length === 0) {
    return { valor: args.roasAHoy.valor, motivo: null, esperadoUsd: 0, supuestos };
  }
  if (supuestos.sinTicket > 0) {
    return sin(`${supuestos.sinTicket} ${supuestos.sinTicket === 1 ? "cita pendiente es de una persona sin cohorte" : "citas pendientes son de personas sin cohorte"}: no hay precio con qué proyectar`);
  }
  const grupos = new Map<string, CitaPendiente[]>();
  for (const cita of args.pendientes) grupos.set(cita.claveCloser, [...(grupos.get(cita.claveCloser) ?? []), cita]);
  let esperadoUsd = 0;
  for (const [clave, citas] of grupos) {
    const propia = args.porCloser.get(clave) ?? { deals: 0, conShow: 0, vendidos: 0 };
    const usaPrograma = !usable(propia, muestraMinima);
    const medida = usaPrograma ? programa : propia;
    if (!usable(medida, muestraMinima)) {
      return sin(`Sin historial suficiente: el programa tiene ${programa.deals} ${programa.deals === 1 ? "persona" : "personas"} con cita en las últimas ${SEMANAS_DE_MUESTRA} semanas y se piden ${muestraMinima}`);
    }
    const pShow = cociente(medida.conShow, medida.deals)!;
    const pCierre = cociente(medida.vendidos, medida.conShow)!;
    const esperado = citas.reduce((suma, c) => suma + pShow * pCierre * c.ticketUsd!, 0);
    esperadoUsd += esperado;
    supuestos.porCloser.push({ clave, closer: citas[0]!.closer, citas: citas.length, muestra: propia.deals,
      pShow, pCierre, usaPrograma, esperadoUsd: esperado });
  }
  supuestos.porCloser.sort((a, b) => (a.closer ?? "").localeCompare(b.closer ?? "", "es"));
  return { valor: (args.vendidoUsd + esperadoUsd) / args.gastoUsd, motivo: null, esperadoUsd, supuestos };
}

export interface ProyeccionDeRoas extends ProyeccionPura {
  rango: Rango;
  gastoUsd: number | null;
  vendidoUsd: number;
  roasAHoy: RazonConCobertura;
  citasPendientes: number;
  /** La hora de la última cita pendiente; `null` si no hay. */
  ultimaCitaEn: Date | null;
}

const muestraDe = (t: Pick<TasasDelGrupo, "deals" | "conShow" | "vendidos">): MuestraDeTasas =>
  ({ deals: t.deals, conShow: t.conShow, vendidos: t.vendidos });

/** Las citas pendientes del universo del ROAS (las de 355: por venir de deals abiertos sin venta). */
export function citasPendientesDeLaVista(vista: VistaRoasDePauta, ahora: Date) {
  return vista.envios.flatMap((e) => e.citas
    .filter((c) => citaPorVenirDeDealAbierto(c, { etapa: e.etapa, tieneVenta: e.venta !== null }, ahora))
    .map((c) => ({ callId: c.id, dealId: c.dealId, fecha: c.fecha })));
}

/** Calcula la proyección del rango con el ROAS vivo. No escribe. */
export async function calcularProyeccionDeRoas(
  db: Db,
  { programId, rango, hoy, ahora, vista }: { programId: string; rango: Rango; hoy: string; ahora: Date; vista?: VistaRoasDePauta },
): Promise<ProyeccionDeRoas> {
  const roas = vista ?? await cargarRoasDePauta(db, programId, rango, hoy, ahora);
  const pendientes = citasPendientesDeLaVista(roas, ahora);
  const ids = pendientes.map((p) => p.callId);
  const [duenos, grupo, [programa]] = await Promise.all([
    ids.length === 0 ? [] : db.select({
      callId: calls.id, clave: claveCloserSql(users.id), closer: etiquetaDeCloserSql(),
      precio: cohorts.precioUsd,
    }).from(calls)
      .innerJoin(deals, and(eq(deals.id, calls.dealId), eq(deals.programId, calls.programId), vigente(deals)))
      .leftJoin(cohorts, and(eq(cohorts.id, deals.cohortId), eq(cohorts.programId, deals.programId)))
      .leftJoin(users, eq(users.id, calls.closerUserId))
      .where(and(eq(calls.programId, programId), inArray(calls.id, ids), vigente(calls))),
    grupoDeCitas(db, { programId, rango: { desde: sumarDias(hoy, -7 * SEMANAS_DE_MUESTRA), hasta: hoy }, ahora }),
    db.select({ minima: programs.muestraMinimaConversion }).from(programs).where(eq(programs.id, programId)),
  ]);
  const dueno = new Map(duenos.map((d) => [d.callId, d]));
  const citas: CitaPendiente[] = pendientes.flatMap((p) => {
    const d = dueno.get(p.callId);
    return d ? [{ callId: p.callId, claveCloser: d.clave, closer: d.closer, fecha: p.fecha,
      ticketUsd: d.precio === null ? null : Number(d.precio) }] : [];
  });
  const pura = proyectarRoas({
    vendidoUsd: roas.total.valorVendidoUsd, gastoUsd: roas.total.gastoUsd, roasAHoy: roas.total.roas,
    pendientes: citas, programa: muestraDe(grupo.tasas),
    porCloser: new Map([...grupo.porCloser].map(([clave, t]) => [clave, muestraDe(t)])),
    muestraMinima: programa?.minima ?? 20,
  });
  const fechas = citas.map((c) => c.fecha.getTime());
  return { ...pura, rango, gastoUsd: roas.total.gastoUsd, vendidoUsd: roas.total.valorVendidoUsd, roasAHoy: roas.total.roas,
    citasPendientes: citas.length, ultimaCitaEn: fechas.length === 0 ? null : new Date(Math.max(...fechas)) };
}

/** El mes en curso de Bogotá hasta hoy: el periodo que guarda el cron. */
export function rangoDelMesHastaHoy(hoy: string): Rango {
  return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
}

const numerico = (n: number | null) => (n === null ? null : n.toFixed(4));

/**
 * Guarda la proyección del día (una por programa y día, índice único). Idempotente: si ya existe no se
 * reescribe, porque una proyección que cambia al verla no sirve para confirmarla. Devuelve si escribió.
 */
export async function guardarProyeccionDelDia(db: Db, programId: string, hoy: string, ahora: Date): Promise<boolean> {
  const rango = rangoDelMesHastaHoy(hoy);
  const p = await calcularProyeccionDeRoas(db, { programId, rango, hoy, ahora });
  const escritas = await db.insert(proyeccionesRoas).values({
    programId, dia: hoy, desde: rango.desde, hasta: rango.hasta,
    gastoUsd: p.gastoUsd === null ? null : p.gastoUsd.toFixed(2), vendidoUsd: p.vendidoUsd.toFixed(2),
    roasAHoy: numerico(p.roasAHoy.valor), roasProyectado: numerico(p.valor), motivo: p.motivo,
    citasPendientes: p.citasPendientes, ultimaCitaEn: p.ultimaCitaEn, supuestos: p.supuestos,
  }).onConflictDoNothing().returning();
  return escritas.length > 0;
}

/**
 * Confirma las proyecciones cuyas citas pendientes ya tienen resultado: recalcula el MISMO rango y guarda el
 * ROAS real. Una cita reagendada no cuenta como resuelta (la representa su cita nueva, que la proyección no
 * conocía): la fila espera. Una cita anulada sí (ya no existe para ninguna métrica). Devuelve cuántas confirmó.
 */
export async function confirmarProyecciones(db: Db, programId: string, hoy: string, ahora: Date): Promise<number> {
  const abiertas = await db.select().from(proyeccionesRoas).where(and(
    eq(proyeccionesRoas.programId, programId), isNull(proyeccionesRoas.confirmadaEn),
  ));
  let confirmadas = 0;
  for (const fila of abiertas) {
    const ids = (fila.supuestos as Partial<SupuestosDeProyeccion>).citasPendientesIds ?? [];
    if (ids.length === 0 || !fila.ultimaCitaEn || fila.ultimaCitaEn.getTime() > ahora.getTime()) continue;
    const citas = await db.select({ id: calls.id, resultado: calls.resultado }).from(calls)
      .where(and(eq(calls.programId, programId), inArray(calls.id, ids), vigente(calls)));
    if (citas.some((c) => c.resultado === "agendada" || c.resultado === "reagendada")) continue;
    const real = await cargarRoasDePauta(db, programId, { desde: fila.desde, hasta: fila.hasta }, hoy, ahora);
    const marcadas = await db.update(proyeccionesRoas).set({
      confirmadaEn: ahora, roasReal: numerico(real.total.roas.valor),
    }).where(and(eq(proyeccionesRoas.id, fila.id), isNull(proyeccionesRoas.confirmadaEn))).returning();
    confirmadas += marcadas.length;
  }
  return confirmadas;
}

export interface ProyeccionGuardada {
  dia: string;
  desde: string;
  hasta: string;
  roasProyectado: number | null;
  motivo: string | null;
  citasPendientes: number;
  confirmadaEn: Date | null;
  roasReal: number | null;
}

/** Las últimas proyecciones ya confirmadas del programa, para decir «Proyectado el 6-nov: 2,4× · Real: 2,1×». */
export async function proyeccionesConfirmadas(db: Db, programId: string, limite = 3): Promise<ProyeccionGuardada[]> {
  const filas = await db.select().from(proyeccionesRoas).where(and(
    eq(proyeccionesRoas.programId, programId), isNotNull(proyeccionesRoas.confirmadaEn),
  )).orderBy(desc(proyeccionesRoas.dia)).limit(limite);
  const num = (v: string | null) => (v === null ? null : Number(v));
  return filas.map((f) => ({
    dia: f.dia, desde: f.desde, hasta: f.hasta, roasProyectado: num(f.roasProyectado), motivo: f.motivo,
    citasPendientes: f.citasPendientes, confirmadaEn: f.confirmadaEn, roasReal: num(f.roasReal),
  }));
}
