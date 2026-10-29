import { and, count, eq, isNotNull, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { calls, transcripciones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";
import { ERRORES_DEFINITIVOS, ErrorDeGrain, esCodigoDeErrorGrain, type CodigoDeErrorGrain } from "./errores";
import { leerTranscriptDeGrain, linkDeGrainValido, type Fetcher } from "./leer";

/**
 * Guardar y reintentar las lecturas de Grain (ADR 0112 punto 2, ticket 328).
 *
 * La lectura corre en dos momentos: apenas se pega el link (`programarLecturaDeGrain`, despues
 * de responder) y en el cron diario, que toma lo que quedo sin transcript o con error y pocos
 * intentos. Las dos pasan por `leerYGuardarTranscript`, que es idempotente: una llamada con
 * transcript bueno del mismo link no se vuelve a pedir a Grain.
 */

/** Tras este numero de fallos seguidos con el mismo link, el cron deja de insistir. */
export const MAX_INTENTOS_GRAIN = 5;
export const LOTE_DEL_CRON = 20;

export type ResultadoDeLectura =
  | { estado: "leida"; palabras: number }
  | { estado: "ya_leida" }
  | { estado: "sin_link" }
  | { estado: "no_es_grain" }
  | { estado: "fallida"; codigo: CodigoDeErrorGrain; intentos: number };

export async function leerYGuardarTranscript(
  db: Db,
  callId: string,
  opciones: { fetcher?: Fetcher; ahora?: Date } = {},
): Promise<ResultadoDeLectura> {
  const ahora = opciones.ahora ?? new Date();
  const [llamada] = await db
    .select({ linkGrain: calls.linkGrain })
    .from(calls)
    .where(and(eq(calls.id, callId), vigente(calls)));
  const link = llamada?.linkGrain?.trim();
  if (!link) return { estado: "sin_link" };
  // Un link que no es de Grain (hoy hay de Fathom y de Google Docs en esta columna) no es un
  // error de lectura: nadie lo puede arreglar reintentando, y contarlo ensuciaria la alarma.
  if (!linkDeGrainValido(link)) return { estado: "no_es_grain" };

  const [previa] = await db.select().from(transcripciones).where(eq(transcripciones.callId, callId));
  if (previa && previa.linkLeido === link && previa.crudo !== null) return { estado: "ya_leida" };
  const intentosPrevios = previa && previa.linkLeido === link ? previa.intentos : 0;

  try {
    const crudo = await leerTranscriptDeGrain(link, opciones.fetcher);
    const valores = {
      linkLeido: link,
      crudo: JSON.stringify(crudo),
      leidoEn: ahora,
      error: null,
      intentos: 0,
      ultimoIntentoEn: ahora,
    };
    await db
      .insert(transcripciones)
      .values({ callId, ...valores })
      .onConflictDoUpdate({ target: transcripciones.callId, set: valores });
    return { estado: "leida", palabras: crudo.results.length };
  } catch (error) {
    // Cualquier cosa que no sea un ErrorDeGrain es un bug nuestro, no de Grain: no se esconde.
    if (!(error instanceof ErrorDeGrain)) throw error;
    const valores = {
      linkLeido: link,
      crudo: null,
      leidoEn: null,
      error: error.codigo,
      intentos: intentosPrevios + 1,
      ultimoIntentoEn: ahora,
    };
    await db
      .insert(transcripciones)
      .values({ callId, ...valores })
      .onConflictDoUpdate({ target: transcripciones.callId, set: valores });
    return { estado: "fallida", codigo: error.codigo, intentos: valores.intentos };
  }
}

/** Lo que el cron debe leer: link de Grain vigente sin transcript bueno de ESE link, o fallo reintentable. */
export async function llamadasPorLeer(db: Db, limite: number = LOTE_DEL_CRON): Promise<string[]> {
  const filas = await db
    .select({ id: calls.id })
    .from(calls)
    .leftJoin(transcripciones, eq(transcripciones.callId, calls.id))
    .where(
      and(
        vigente(calls),
        isNotNull(calls.linkGrain),
        sql`${calls.linkGrain} ~* '^[[:space:]]*https://(www[.])?grain[.]com/(note|share/recording)/'`,
        or(
          isNull(transcripciones.id),
          ne(transcripciones.linkLeido, sql`trim(${calls.linkGrain})`),
          and(
            isNotNull(transcripciones.error),
            sql`${transcripciones.intentos} < ${MAX_INTENTOS_GRAIN}`,
            notInArray(transcripciones.error, [...ERRORES_DEFINITIVOS]),
          ),
        ),
      ),
    )
    .orderBy(sql`${transcripciones.ultimoIntentoEn} asc nulls first`, calls.createdAt)
    .limit(limite);
  return filas.map((f) => f.id);
}

export interface ResumenDelCron {
  candidatas: number;
  leidas: number;
  fallidas: number;
}

export async function correrLecturasPendientes(
  db: Db,
  opciones: { fetcher?: Fetcher; ahora?: Date; limite?: number } = {},
): Promise<ResumenDelCron> {
  const ids = await llamadasPorLeer(db, opciones.limite);
  const resumen: ResumenDelCron = { candidatas: ids.length, leidas: 0, fallidas: 0 };
  // En serie: son pocas por dia y asi no se le piden 20 paginas a la vez a Grain.
  for (const id of ids) {
    const r = await leerYGuardarTranscript(db, id, opciones);
    if (r.estado === "leida") resumen.leidas += 1;
    if (r.estado === "fallida") resumen.fallidas += 1;
  }
  return resumen;
}

export interface LecturaFallida {
  callId: string;
  codigo: CodigoDeErrorGrain | "desconocido";
  intentos: number;
  agotada: boolean;
  ultimoIntentoEn: Date | null;
}

export interface SaludDeGrain {
  /** Hay lecturas fallidas: prende la alarma. */
  marcada: boolean;
  fallidas: number;
  agotadas: number;
  lista: LecturaFallida[];
}

/**
 * La alarma de las lecturas fallidas (ADR 0112 punto 2): se calcula de `transcripciones`,
 * nada se guarda (ADR 0024). Una fila vive en la alarma mientras su error siga y su link sea el
 * actual de la llamada: pegar otro link, o una lectura buena, la apaga sola. El programa es
 * frontera: la lista es de un programa.
 */
export async function saludDeGrain(db: Db, programId: string, limite = 50): Promise<SaludDeGrain> {
  const [[total], filas] = await Promise.all([
    db
      .select({
        fallidas: count(),
        agotadas: sql<number>`count(*) filter (where ${transcripciones.intentos} >= ${MAX_INTENTOS_GRAIN})::int`,
      })
      .from(calls)
      .innerJoin(transcripciones, eq(transcripciones.callId, calls.id))
      .where(and(vigente(calls), eq(calls.programId, programId), isNotNull(transcripciones.error), eq(transcripciones.linkLeido, sql`trim(${calls.linkGrain})`))),
    db
      .select({
        callId: calls.id,
        error: transcripciones.error,
        intentos: transcripciones.intentos,
        ultimoIntentoEn: transcripciones.ultimoIntentoEn,
      })
      .from(calls)
      .innerJoin(transcripciones, eq(transcripciones.callId, calls.id))
      .where(and(vigente(calls), eq(calls.programId, programId), isNotNull(transcripciones.error), eq(transcripciones.linkLeido, sql`trim(${calls.linkGrain})`)))
      .orderBy(sql`${transcripciones.ultimoIntentoEn} desc nulls last`)
      .limit(limite),
  ]);
  const fallidas = total?.fallidas ?? 0;
  return {
    marcada: fallidas > 0,
    fallidas,
    agotadas: total?.agotadas ?? 0,
    lista: filas.map((f) => ({
      callId: f.callId,
      codigo: esCodigoDeErrorGrain(f.error) ? f.error : "desconocido",
      intentos: f.intentos,
      agotada: f.intentos >= MAX_INTENTOS_GRAIN,
      ultimoIntentoEn: f.ultimoIntentoEn,
    })),
  };
}
