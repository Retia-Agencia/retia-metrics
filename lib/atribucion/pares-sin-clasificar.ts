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

export interface ClasificacionDeEnvios {
  /** Envios completos que cada canal activo clasifica; un canal en 0 no casa con nada. */
  enviosPorCanal: Map<string, number>;
  paresSinClasificar: ParSinClasificar[];
}

const parCrudoNormalizado = (valor: string | null): string => valor?.trim().toLowerCase() ?? "";

/**
 * Pasa cada envio completo por `resolverCanal` UNA vez: cuenta los que casan con cada canal
 * y agrupa por programa los pares crudos normalizados que todavia no tienen canal.
 */
export async function clasificacionDeEnvios(db: Db): Promise<ClasificacionDeEnvios> {
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

  const enviosPorCanal = new Map<string, number>();
  const agrupados = new Map<string, ParSinClasificar>();
  for (const envio of envios) {
    const resultado = resolverCanal(envio, catalogo as CanalActivo[]);
    if (resultado.tipo === "canal") {
      enviosPorCanal.set(resultado.canal.id, (enviosPorCanal.get(resultado.canal.id) ?? 0) + 1);
      continue;
    }
    if (resultado.tipo !== "sin_clasificar") continue;
    // La clasificación trata una macro como centinela; la tabla de diagnóstico muestra
    // el par crudo (solo lower/trim) para que el problema de origen siga siendo visible.
    const source = parCrudoNormalizado(envio.source);
    const medium = parCrudoNormalizado(envio.medium);
    const clave = `${envio.programId}\u0000${source}\u0000${medium}`;
    const actual = agrupados.get(clave);
    if (actual) actual.envios += 1;
    else agrupados.set(clave, { programId: envio.programId, programa: envio.programa, source, medium, envios: 1 });
  }

  const paresSinClasificar = [...agrupados.values()].sort(
    (a, b) => b.envios - a.envios || a.programa.localeCompare(b.programa, "es") || a.source.localeCompare(b.source),
  );
  return { enviosPorCanal, paresSinClasificar };
}

