import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources, programs, syncRuns, people, changeLog } from "@/lib/db/schema";

/** Todo lo que necesita la pantalla de fuentes, en una sola pasada. */
export async function estadoDeFuentes() {
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
    db.select().from(syncRuns).orderBy(desc(syncRuns.iniciado)).limit(8),
    db.select({ cambios: sql<number>`count(*)::int` }).from(changeLog),
  ]);

  return { fuentes, conteos, corridas, cambios: conteoCambios?.cambios ?? 0 };
}

export type Fuentes = Awaited<ReturnType<typeof estadoDeFuentes>>;
