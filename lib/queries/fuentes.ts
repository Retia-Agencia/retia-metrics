import { desc, eq, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { sources, programs, syncRuns, people, changeLog } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Lecturas de las corridas de sync y del estado de las fuentes.
 *
 * `ultimasCorridasDeSync` vive aca y NO se reescribe en `/nerd-stats` (ADR 0024):
 * "cuales fueron las ultimas corridas" es UNA pregunta que hacen dos pantallas
 * distintas —`/ajustes/fuentes`, que la mira como salud de las hojas, y
 * `/nerd-stats`, que la mira como salud de la herramienta—. El predicado (orden y
 * corte) es del modulo; cuantas filas pedir y que columnas pintar es de cada
 * llamador.
 */

/** Una corrida con la fuente y el programa ya resueltos, y su duracion en segundos. */
export async function ultimasCorridasDeSync(limite = 8, db: Db = dbDeLaApp) {
  return db
    .select({
      id: syncRuns.id,
      iniciado: syncRuns.iniciado,
      terminado: syncRuns.terminado,
      estado: syncRuns.estado,
      filasLeidas: syncRuns.filasLeidas,
      personasNuevas: syncRuns.personasNuevas,
      personasActualizadas: syncRuns.personasActualizadas,
      registrosNuevos: syncRuns.registrosNuevos,
      errores: syncRuns.errores,
      fuenteNombre: sources.nombre,
      programaNombre: programs.nombre,
      // Segundos entre inicio y fin. Null mientras la corrida sigue corriendo: una
      // duracion inventada para algo que no ha terminado seria peor que no mostrarla.
      duracionSegundos: sql<
        number | null
      >`case when ${syncRuns.terminado} is null then null
             else round(extract(epoch from ${syncRuns.terminado} - ${syncRuns.iniciado}))::int end`,
    })
    .from(syncRuns)
    .leftJoin(sources, eq(sources.id, syncRuns.sourceId))
    .leftJoin(programs, eq(programs.id, sources.programId))
    .orderBy(desc(syncRuns.iniciado))
    .limit(limite);
}

export type CorridaDeSync = Awaited<ReturnType<typeof ultimasCorridasDeSync>>[number];

/** Todo lo que necesita la pantalla de fuentes, en una sola pasada. */
export async function estadoDeFuentes(db: Db = dbDeLaApp) {
  const [fuentes, conteos, corridas, [conteoCambios]] = await Promise.all([
    db
      .select({
        id: sources.id,
        nombre: sources.nombre,
        tab: sources.tab,
        destino: sources.destino,
        activo: sources.activo,
        ultimaSync: sources.ultimaSync,
        programaSlug: programs.slug,
        programaNombre: programs.nombre,
      })
      .from(sources)
      .innerJoin(programs, eq(programs.id, sources.programId))
      .orderBy(programs.slug, sources.orden),
    db
      .select({
        slug: programs.slug,
        nombre: programs.nombre,
        personas: sql<number>`count(${people.id})::int`,
        aplicaciones: sql<number>`coalesce(sum(${people.numAplicaciones}),0)::int`,
      })
      .from(programs)
      .leftJoin(people, eq(people.programId, programs.id))
      .groupBy(programs.slug, programs.nombre),
    ultimasCorridasDeSync(8, db),
    db.select({ cambios: sql<number>`count(*)::int` }).from(changeLog),
  ]);

  return { fuentes, conteos, corridas, cambios: conteoCambios?.cambios ?? 0 };
}

export type Fuentes = Awaited<ReturnType<typeof estadoDeFuentes>>;
