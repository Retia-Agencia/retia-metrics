import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import {
  ErrorDeTypeform,
  formIdDeTypeform,
  leerInsights,
  type FetchLike,
  type InsightsDelFormulario,
} from "@/lib/typeform/insights";

/**
 * El embudo por pregunta de cada formulario de Typeform del programa (ticket 126 parte B).
 * Lee el Insights en vivo con el token de la fuente y no guarda nada; el token se lee aqui,
 * en el servidor, y nunca sale de este modulo: lo que devuelve trae a lo sumo el estado.
 *
 * Caché corta en memoria (5 min) por fuente: abrir el dashboard varias veces no le pega a
 * Typeform cada vez. Por instancia del servidor, que a esta escala alcanza. Un error no se
 * guarda en la caché: el siguiente intento vuelve a preguntar.
 */

export const CACHE_INSIGHTS_MS = 5 * 60_000;

export type EmbudoPorPreguntaDeFuente =
  | { fuenteId: string; fuente: string; estado: "ok"; leidoEn: Date; insights: InsightsDelFormulario }
  | { fuenteId: string; fuente: string; estado: "sin_token" }
  | { fuenteId: string; fuente: string; estado: "sin_url" }
  | { fuenteId: string; fuente: string; estado: "error"; mensaje: string };

// El token va en la entrada (solo en memoria del servidor) para que reemplazarlo invalide la lectura vieja.
const cache = new Map<string, { formId: string; token: string; leidoEn: Date; insights: InsightsDelFormulario }>();

/** Solo para los tests: la caché es del módulo y sobrevive entre casos. */
export function vaciarCacheDeInsights(): void {
  cache.clear();
}

export async function embudoPorPregunta(
  db: Db,
  programId: string,
  { ahora = new Date(), fetch }: { ahora?: Date; fetch?: FetchLike } = {},
): Promise<EmbudoPorPreguntaDeFuente[]> {
  const fuentes = await db
    .select({
      id: sources.id,
      nombre: sources.nombre,
      urlPublica: sources.urlPublica,
      token: sources.typeformToken,
    })
    .from(sources)
    .where(and(eq(sources.programId, programId), eq(sources.activo, true), eq(sources.tipo, "webhook"), eq(sources.proveedor, "typeform")))
    .orderBy(desc(sources.principal), asc(sources.orden), asc(sources.nombre));

  return Promise.all(
    fuentes.map(async (f): Promise<EmbudoPorPreguntaDeFuente> => {
      const base = { fuenteId: f.id, fuente: f.nombre };
      if (!f.token) return { ...base, estado: "sin_token" };
      const formId = formIdDeTypeform(f.urlPublica);
      if (!formId) return { ...base, estado: "sin_url" };
      const enCache = cache.get(f.id);
      if (enCache && enCache.formId === formId && enCache.token === f.token && ahora.getTime() - enCache.leidoEn.getTime() < CACHE_INSIGHTS_MS) {
        return { ...base, estado: "ok", leidoEn: enCache.leidoEn, insights: enCache.insights };
      }
      try {
        const insights = await leerInsights({ token: f.token, formId, fetch });
        cache.set(f.id, { formId, token: f.token, leidoEn: ahora, insights });
        return { ...base, estado: "ok", leidoEn: ahora, insights };
      } catch (error) {
        if (!(error instanceof ErrorDeTypeform)) console.error("[insights] error no controlado", error);
        const mensaje = error instanceof ErrorDeTypeform ? error.message : "No se pudo leer el Insights.";
        return { ...base, estado: "error", mensaje };
      }
    }),
  );
}
