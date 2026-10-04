import { createHash } from "node:crypto";
import { parsearPeriodoUrl, resolverPeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { ventanasAnterioresDeCohorte } from "@/lib/queries/ventanas-de-cohortes";
import {
  desglosesDelResumen,
  listaDeMetrica,
  resumenDeMetrica,
  type DesglosesDelResumen,
  type Metrica,
  type ResumenDeMetrica,
} from "@/lib/queries/metricas-con-filas";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";

/**
 * Codigo opaco estable de una CLAVE de closer (ticket 167): el sha256 de la
 * `claveCloser` (`users.id` o `historico:<texto>`). Viaja en el href de la lista sin
 * exponer el id interno ni el texto. Para un closer historico sin cuenta sigue
 * sirviendo, porque la clave ya trae su texto normalizado.
 */
export function codigoDeCloser(claveCloser: string): string {
  return createHash("sha256").update(claveCloser).digest("hex");
}

export interface DetalleDeCifra {
  resumen: ResumenDeMetrica;
  /** El resumen partido por closer, etapa y antigüedad (ADR 0067 punto 5), ya legible. */
  desgloses: DesglosesDelResumen;
  href: string;
}

/** Cómo se lee una etapa en el resumen y en la lista. */
export function nombreDeEtapa(etapa: string): string {
  return NOMBRE_DE_ETAPA[etapa as EtapaDeal] ?? etapa;
}

/** Las cifras de las tarjetas del dashboard; las del 138 viven en su propia vista. */
const METRICAS_DEL_TABLERO = ["caja", "agendas", "shows", "shows_sin_grain", "cierres", "cortesias", "leads"] as const;
export type DetallesDelDashboard = Record<(typeof METRICAS_DEL_TABLERO)[number], DetalleDeCifra>;

export function urlDeLista(slug: string, metrica: Metrica, periodo: PeriodoResuelto, claveCloser?: string | null, moneda?: string): string {
  const q = new URLSearchParams({ metrica, periodo: "custom", a_desde: periodo.a.desde, a_hasta: periodo.a.hasta });
  if (periodo.b) {
    q.set("b_desde", periodo.b.desde);
    q.set("b_hasta", periodo.b.hasta);
  }
  if (claveCloser) q.set("closer", codigoDeCloser(claveCloser));
  if (moneda) q.set("moneda", moneda);
  return `/p/${encodeURIComponent(slug)}/dashboard/lista?${q}`;
}

export interface EntradaDeDetalles {
  programId: string;
  slug: string;
  hoy: string;
  periodo: PeriodoResuelto;
  /** La clave de identidad del closer (ticket 167): `users.id` o `historico:<texto>`. */
  claveCloser: string | null;
}

/** El resumen de UNA cifra del periodo A y el enlace a su lista. Solo agregados SQL. */
export async function detalleDeCifra(metrica: Metrica, entrada: EntradaDeDetalles, db: Db = dbDeLaApp): Promise<DetalleDeCifra> {
  const [resumen] = await resumenDeMetrica(metrica, { ...entrada, rango: entrada.periodo.a }, db);
  return {
    resumen,
    desgloses: desglosesDelResumen(resumen.grupos, nombreDeEtapa),
    href: urlDeLista(entrada.slug, metrica, entrada.periodo, entrada.claveCloser),
  };
}

/** Solo agregados SQL: abrir el diálogo nunca descarga filas de negocio. */
export async function detallesDelDashboard(entrada: EntradaDeDetalles, db: Db = dbDeLaApp): Promise<DetallesDelDashboard> {

  const entradas = await Promise.all(
    METRICAS_DEL_TABLERO.map(async (metrica) => [metrica, await detalleDeCifra(metrica, entrada, db)] as const),
  );
  return Object.fromEntries(entradas) as DetallesDelDashboard;
}

export interface EntradaDeLista {
  programId: string;
  metrica: Metrica;
  busqueda: Record<string, unknown>;
  hoy: string;
  codigoCloser?: string;
  moneda?: string;
  pagina: number;
}

/** Resuelve el mismo periodo del dashboard, sin cargar el resto de sus métricas. */
export async function vistaDeLista(entrada: EntradaDeLista, db: Db = dbDeLaApp) {
  const { programId, hoy, metrica, codigoCloser, moneda, pagina } = entrada;
  const seleccion = parsearPeriodoUrl(entrada.busqueda);
  const cohorte = seleccion.preset.startsWith("cohorte") ? await cohorteActiva(programId, db) : null;
  const ventanas = cohorte ? await ventanasAnterioresDeCohorte(db, programId, cohorte.id) : {};
  const periodo = resolverPeriodo(seleccion, {
    hoy,
    actual: cohorte?.fechaInicioVentas ? { inicio: cohorte.fechaInicioVentas, cierre: cohorte.fechaCierreVentas } : null,
    ...ventanas,
  });
  const filtros = { programId, hoy, rango: periodo.a, moneda };
  let claveCloser: string | null = null;
  if (codigoCloser) {
    const [sinFiltro] = await resumenDeMetrica(metrica, filtros, db);
    claveCloser = sinFiltro.grupos.map((g) => g.claveCloser).find((c) => codigoDeCloser(c) === codigoCloser) ?? null;
    // Un código desconocido nunca ensancha el alcance al programa entero.
    if (claveCloser === null) return null;
  }
  const [lista] = await listaDeMetrica(metrica, { ...filtros, claveCloser }, pagina, db);
  return { lista, periodo, claveCloser };
}
