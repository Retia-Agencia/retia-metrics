import { createHash } from "node:crypto";
import { parsearPeriodoUrl, resolverPeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { ventanasAnterioresDeCohorte } from "@/lib/queries/ventanas-de-cohortes";
import {
  desglosesDelResumen,
  listaDeMetrica,
  resumenDeDeals,
  resumenDeMetrica,
  type DesglosesDelResumen,
  type Metrica,
  type ResumenDeMetrica,
} from "@/lib/queries/metricas-con-filas";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import {
  BUCKETS_DE_ANTIGUEDAD,
  CLAVE_SIN_DUENO,
  leerEmbudoConMiembros,
  miembrosDeLaCifra,
  type MetricaDeEmbudo,
  type SubconjuntoDelEmbudo,
} from "@/lib/queries/embudo-con-filas";
import { PASOS_DE_CONVERSION } from "@/lib/queries/embudo-etapas";
import { grupoDeCitas, miembrosDe } from "@/lib/queries/tasas-del-grupo";
import { db as dbDeLaApp } from "@/lib/db";
import { users } from "@/lib/db/schema";
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
const METRICAS_DEL_TABLERO = [
  "caja",
  "agendas",
  "shows",
  "shows_sin_grain",
  "cierres",
  "cortesias",
  "leads",
  "contratado",
  "sin_resultado",
  "cartera",
  "grupo_citas",
  "grupo_shows",
  "grupo_vendidos",
] as const;
export type DetallesDelDashboard = Record<(typeof METRICAS_DEL_TABLERO)[number], DetalleDeCifra>;

export function urlDeLista(
  slug: string,
  metrica: Metrica,
  periodo: PeriodoResuelto,
  claveCloser?: string | null,
  moneda?: string,
  cohorteId?: string,
  subconjunto?: SubconjuntoDelEmbudo,
): string {
  const q = new URLSearchParams({ metrica, periodo: "custom", a_desde: periodo.a.desde, a_hasta: periodo.a.hasta });
  if (subconjunto?.etapa) q.set("etapa", subconjunto.etapa);
  if (subconjunto?.antiguedad) q.set("antiguedad", subconjunto.antiguedad);
  if (periodo.b) {
    q.set("b_desde", periodo.b.desde);
    q.set("b_hasta", periodo.b.hasta);
  } else {
    // Sin comparación en el origen, la lista no inventa una (ticket 188): sin esta marca,
    // `resolverPeriodo` le calcularía un B por hábiles al rango libre.
    q.set("sin_b", "1");
  }
  if (claveCloser) q.set("closer", codigoDeCloser(claveCloser));
  if (moneda) q.set("moneda", moneda);
  if (cohorteId) q.set("cohorte", cohorteId);
  return `/p/${encodeURIComponent(slug)}/dashboard/lista?${q}`;
}

export interface EntradaDeDetalles {
  programId: string;
  slug: string;
  hoy: string;
  periodo: PeriodoResuelto;
  /** La clave de identidad del closer (ticket 167): `users.id` o `historico:<texto>`. */
  claveCloser: string | null;
  /**
   * El origen de la pantalla que arma estos detalles (ticket 174, 197): se pega como
   * `?desde=` al href de cada lista para que su "Volver" regrese a la pestaña y el filtro
   * de donde salió. Solo por `enlaceConVuelta`; sin un origen válido el href queda igual.
   */
  origen?: string;
}

/** El resumen de UNA cifra del periodo A y el enlace a su lista. Solo agregados SQL. */
export async function detalleDeCifra(metrica: Metrica, entrada: EntradaDeDetalles, db: Db = dbDeLaApp): Promise<DetalleDeCifra> {
  const claveCloser = metrica === "cartera" ? null : entrada.claveCloser;
  const [resumen] = await resumenDeMetrica(metrica, { ...entrada, rango: entrada.periodo.a, claveCloser }, db);
  const href = urlDeLista(entrada.slug, metrica, entrada.periodo, claveCloser);
  return {
    resumen,
    desgloses: desglosesDelResumen(resumen.grupos, nombreDeEtapa),
    href: entrada.origen ? enlaceConVuelta(href, entrada.origen) : href,
  };
}

/** Solo agregados SQL: abrir el diálogo nunca descarga filas de negocio. */
export async function detallesDelDashboard(entrada: EntradaDeDetalles, db: Db = dbDeLaApp): Promise<DetallesDelDashboard> {

  const entradas = await Promise.all(
    METRICAS_DEL_TABLERO.map(async (metrica) => [metrica, await detalleDeCifra(metrica, entrada, db)] as const),
  );
  return Object.fromEntries(entradas) as DetallesDelDashboard;
}

/**
 * Las celdas del comparativo entre closers que abren su lista (ticket 188). Las tasas abren el
 * grupo del ADR 0079 sobre el que se calculan: el % de show su grupo de citas, el % de cierre
 * los del grupo con show.
 */
export const CELDAS_DEL_COMPARATIVO = ["agendas", "shows", "grupo_citas", "cierres", "grupo_shows", "caja"] as const;
export type CeldaDelComparativo = (typeof CELDAS_DEL_COMPARATIVO)[number];
/** Por la clave de cada fila del comparativo (`users.id` o `historico:<texto>`). */
export type DetallesDelComparativo = Record<string, Record<CeldaDelComparativo, DetalleDeCifra>>;

/**
 * Cada celda es la lista de ESE closer en esa métrica: el filtro por clave de toda lista, así que
 * la celda y su lista no pueden discrepar. El comparativo sigue sin filtrarse (ADR 0023); lo que se
 * acota es la lista de una celda.
 */
export async function detallesDelComparativo(
  entrada: Omit<EntradaDeDetalles, "claveCloser">,
  claves: readonly string[],
  db: Db = dbDeLaApp,
  ahora: Date = new Date(),
): Promise<DetallesDelComparativo> {
  // El grupo de citas se carga UNA vez y se acota por closer en memoria, con la misma regla que su
  // lista (`miembrosDe`); las otras cuatro celdas son agregados SQL por clave.
  const grupo = await grupoDeCitas(db, { programId: entrada.programId, rango: entrada.periodo.a, ahora });
  const deGrupo = (metrica: "grupo_citas" | "grupo_shows", clave: string): DetalleDeCifra => {
    const miembros = miembrosDe(grupo, clave).filter((m) => metrica === "grupo_citas" || m.conShow);
    return detalleDeDeals(entrada, metrica, resumenDeDeals(entrada.programId, miembros, entrada.hoy), clave);
  };
  const filas = await Promise.all(claves.map(async (clave) => {
    const celdas = await Promise.all(CELDAS_DEL_COMPARATIVO.map(async (metrica) =>
      [
        metrica,
        metrica === "grupo_citas" || metrica === "grupo_shows"
          ? deGrupo(metrica, clave)
          : await detalleDeCifra(metrica, { ...entrada, claveCloser: clave }, db),
      ] as const));
    return [clave, Object.fromEntries(celdas) as Record<CeldaDelComparativo, DetalleDeCifra>] as const;
  }));
  return Object.fromEntries(filas);
}

/** El detalle de una cifra cuyo resumen ya se armó en memoria: su desglose y su enlace a la lista. */
function detalleDeDeals(
  entrada: Omit<EntradaDeDetalles, "claveCloser">,
  metrica: Metrica,
  resumen: ResumenDeMetrica,
  claveCloser: string | null,
  subconjunto?: SubconjuntoDelEmbudo,
): DetalleDeCifra {
  const href = urlDeLista(entrada.slug, metrica, entrada.periodo, claveCloser, undefined, undefined, subconjunto);
  return {
    resumen,
    desgloses: desglosesDelResumen(resumen.grupos, nombreDeEtapa),
    href: entrada.origen ? enlaceConVuelta(href, entrada.origen) : href,
  };
}

/** Las cifras del embudo por etapas que abren su lista (ticket 188). */
export interface DetallesDelEmbudo {
  entraron: DetalleDeCifra;
  pasos: Record<string, DetalleDeCifra>;
  tiempo: Record<string, DetalleDeCifra>;
  /** Por `etapa` + `\u0000` + `users.id` del dueño (vacío sin dueño), como las filas de la tabla. */
  abiertos: Record<string, DetalleDeCifra>;
  sinDueno: Record<string, DetalleDeCifra>;
}

export function claveDeAbiertos(etapa: string, ownerUserId: string | null): string {
  return `${etapa}\u0000${ownerUserId ?? ""}`;
}

/**
 * Todas las cifras del embudo por etapas con su resumen y su enlace, desde UNA carga del embudo:
 * el mismo cálculo que la lista vuelve a hacer con la métrica, la etapa y el rango.
 */
export async function detallesDelEmbudo(
  entrada: Omit<EntradaDeDetalles, "claveCloser">,
  db: Db = dbDeLaApp,
  ahora: Date = new Date(),
): Promise<DetallesDelEmbudo> {
  const embudo = await leerEmbudoConMiembros(db, { programId: entrada.programId, rango: entrada.periodo.a }, ahora);
  const detalle = (metrica: MetricaDeEmbudo, subconjunto: SubconjuntoDelEmbudo, claveCloser: string | null = null) =>
    detalleDeDeals(
      entrada,
      metrica,
      resumenDeDeals(entrada.programId, miembrosDeLaCifra(embudo, metrica, subconjunto, claveCloser), entrada.hoy),
      claveCloser,
      subconjunto,
    );
  const { resultado } = embudo;
  return {
    entraron: detalle("etapa_entraron", {}),
    pasos: Object.fromEntries(PASOS_DE_CONVERSION.map((paso) => [paso, detalle("etapa_paso", { etapa: paso })])),
    tiempo: Object.fromEntries(resultado.tiempoEnEtapa.map((fila) => [fila.etapa, detalle("etapa_tiempo", { etapa: fila.etapa })])),
    abiertos: Object.fromEntries(resultado.abiertos.map((fila) => [
      claveDeAbiertos(fila.etapa, fila.ownerUserId),
      detalle("etapa_abiertos", { etapa: fila.etapa }, fila.ownerUserId ?? CLAVE_SIN_DUENO),
    ])),
    sinDueno: Object.fromEntries(BUCKETS_DE_ANTIGUEDAD.map((bucket) => [bucket, detalle("etapa_sin_dueno", { antiguedad: bucket })])),
  };
}

/** Lo que Operación comercial necesita además de las tarjetas: el comparativo y el embudo por etapas. */
export interface DetallesDeOperacion {
  comparativo: DetallesDelComparativo;
  embudo: DetallesDelEmbudo;
}

export async function detallesDeOperacion(
  entrada: Omit<EntradaDeDetalles, "claveCloser">,
  clavesDelComparativo: readonly string[],
  db: Db = dbDeLaApp,
): Promise<DetallesDeOperacion> {
  const [comparativo, embudo] = await Promise.all([
    detallesDelComparativo(entrada, clavesDelComparativo, db),
    detallesDelEmbudo(entrada, db),
  ]);
  return { comparativo, embudo };
}

export interface EntradaDeLista {
  programId: string;
  metrica: Metrica;
  busqueda: Record<string, unknown>;
  hoy: string;
  codigoCloser?: string;
  moneda?: string;
  cohorteId?: string;
  /** Solo el embudo por etapas (ticket 188). */
  etapa?: string;
  antiguedad?: string;
  pagina: number;
  /** El instante que decide qué cita ya pasó y la antigüedad sin dueño; por defecto, ahora. */
  ahora?: Date;
}

/** Resuelve el mismo periodo del dashboard, sin cargar el resto de sus métricas. */
export async function vistaDeLista(entrada: EntradaDeLista, db: Db = dbDeLaApp) {
  const { programId, hoy, metrica, codigoCloser, moneda, cohorteId, etapa, antiguedad, pagina } = entrada;
  const seleccion = parsearPeriodoUrl(entrada.busqueda);
  const cohorte = seleccion.preset.startsWith("cohorte") ? await cohorteActiva(programId, db) : null;
  const ventanas = cohorte ? await ventanasAnterioresDeCohorte(db, programId, cohorte.id) : {};
  const resuelto = resolverPeriodo(seleccion, {
    hoy,
    actual: cohorte?.fechaInicioVentas ? { inicio: cohorte.fechaInicioVentas, cierre: cohorte.fechaCierreVentas } : null,
    ...ventanas,
  });
  // `sin_b=1`: el origen no comparaba. Se calla también el aviso de "elige B", que aquí no aplica.
  const periodo = entrada.busqueda.sin_b === "1" && !seleccion.b
    ? { ...resuelto, b: null, aviso: seleccion.aviso }
    : resuelto;
  const filtros = { programId, hoy, rango: periodo.a, moneda, cohorteId, etapa, antiguedad, ahora: entrada.ahora ?? new Date() };
  let claveCloser: string | null = null;
  if (codigoCloser) {
    const [sinFiltro] = await resumenDeMetrica(metrica, filtros, db);
    claveCloser = sinFiltro.grupos.map((g) => g.claveCloser).find((c) => codigoDeCloser(c) === codigoCloser) ?? null;
    // El comparativo junta bajo el `users.id` las filas históricas sin FK que traen el texto de
    // esa cuenta (ticket 188); si TODAS sus filas son así, la clave no aparece en los grupos de la
    // lista y se busca entre las cuentas. Filtrar por una cuenta nunca trae filas de otro programa.
    if (claveCloser === null) {
      const cuentas = await db.select({ id: users.id }).from(users);
      claveCloser = cuentas.map((u) => u.id).find((id) => codigoDeCloser(id) === codigoCloser) ?? null;
    }
    // Un código desconocido nunca ensancha el alcance al programa entero.
    if (claveCloser === null) return null;
  }
  const [lista] = await listaDeMetrica(metrica, { ...filtros, claveCloser }, pagina, db);
  return { lista, periodo, claveCloser };
}
