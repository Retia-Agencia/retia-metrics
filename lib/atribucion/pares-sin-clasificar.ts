import { eq } from "drizzle-orm";
import { canales, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { resolverCanal, type CanalActivo } from "./canal";

export interface ParSinClasificar {
  programId: string;
  programa: string;
  source: string;
  medium: string;
  envios: number;
}

const parCrudoNormalizado = (valor: string | null): string => valor?.trim().toLowerCase() ?? "";

/** Agrupa por programa los pares crudos normalizados que todavía no tienen canal. */
export async function paresSinClasificar(db: Db): Promise<ParSinClasificar[]> {
  const [catalogo, envios] = await Promise.all([
    db.select().from(canales).where(eq(canales.activo, true)),
    db
      .select({
        programId: programs.id,
        programa: programs.nombre,
        source: submissions.utmSource,
        medium: submissions.utmMedium,
        campaign: submissions.utmCampaign,
      })
      .from(submissions)
      .innerJoin(sources, eq(submissions.sourceId, sources.id))
      .innerJoin(programs, eq(sources.programId, programs.id))
      .where(eq(submissions.esParcial, false)),
  ]);

  const agrupados = new Map<string, ParSinClasificar>();
  for (const envio of envios) {
    if (resolverCanal(envio, catalogo as CanalActivo[]).tipo !== "sin_clasificar") continue;
    // La clasificación trata una macro como centinela; la tabla de diagnóstico muestra
    // el par crudo (solo lower/trim) para que el problema de origen siga siendo visible.
    const source = parCrudoNormalizado(envio.source);
    const medium = parCrudoNormalizado(envio.medium);
    const clave = `${envio.programId}\u0000${source}\u0000${medium}`;
    const actual = agrupados.get(clave);
    if (actual) actual.envios += 1;
    else agrupados.set(clave, { programId: envio.programId, programa: envio.programa, source, medium, envios: 1 });
  }

  return [...agrupados.values()].sort(
    (a, b) => b.envios - a.envios || a.programa.localeCompare(b.programa, "es") || a.source.localeCompare(b.source),
  );
}
