import { createHash } from "node:crypto";
import { claveDeCloser } from "@/lib/closers/identidad";
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

/** Código estable del texto histórico: también sirve para closers sin cuenta actual. */
export function codigoDeCloser(closer: string): string {
  return createHash("sha256").update(claveDeCloser(closer)).digest("hex");
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

export type DetallesDelDashboard = Record<Metrica, DetalleDeCifra>;

export function urlDeLista(slug: string, metrica: Metrica, periodo: PeriodoResuelto, closer?: string | null, moneda?: string): string {
  const q = new URLSearchParams({ metrica, periodo: "custom", a_desde: periodo.a.desde, a_hasta: periodo.a.hasta });
  if (periodo.b) {
    q.set("b_desde", periodo.b.desde);
    q.set("b_hasta", periodo.b.hasta);
  }
  if (closer) q.set("closer", codigoDeCloser(closer));
  if (moneda) q.set("moneda", moneda);
  return `/p/${encodeURIComponent(slug)}/dashboard/lista?${q}`;
}

export interface EntradaDeDetalles {
  programId: string;
  slug: string;
  hoy: string;
  periodo: PeriodoResuelto;
  closerId: string | null;
}

/** Solo agregados SQL: abrir el diálogo nunca descarga filas de negocio. */
export async function detallesDelDashboard(entrada: EntradaDeDetalles, db: Db = dbDeLaApp): Promise<DetallesDelDashboard> {
  const metricas: Metrica[] = ["caja", "agendas", "shows", "cierres", "leads"];
  const entradas = await Promise.all(metricas.map(async (metrica) => {
    const [resumen] = await resumenDeMetrica(metrica, { ...entrada, rango: entrada.periodo.a }, db);
    return [metrica, {
      resumen,
      desgloses: desglosesDelResumen(resumen.grupos, nombreDeEtapa),
      href: urlDeLista(entrada.slug, metrica, entrada.periodo, entrada.closerId),
    }] as const;
  }));
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
  let closerId: string | null = null;
  if (codigoCloser) {
    const [sinFiltro] = await resumenDeMetrica(metrica, filtros, db);
    closerId = sinFiltro.grupos.map((g) => g.closer).find((c) => c && codigoDeCloser(c) === codigoCloser) ?? null;
    // Un código desconocido nunca ensancha el alcance al programa entero.
    if (closerId === null) return null;
  }
  const [lista] = await listaDeMetrica(metrica, { ...filtros, closerId }, pagina, db);
  return { lista, periodo, closerId };
}
