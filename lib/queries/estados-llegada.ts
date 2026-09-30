import { and, count, eq, isNotNull } from "drizzle-orm";
import { estadosLlegada, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { llaveDeEstado } from "@/lib/ingesta/estados-llegada";

/**
 * Lo que pinta la sección de Estados de llegada en `/ajustes/fuentes` (ticket 117): las
 * filas de cada programa, cuántos envíos trae cada valor, y los valores que el formulario
 * mandó y el programa NO tiene (ADR 0061 punto 5), para crearles fila desde ahí.
 *
 * Los conteos agrupan por valor en la base y se cruzan en memoria (AGENTS.md: nada de
 * subconsultas correlacionadas). Un valor se compara con la llave del índice único
 * (`lower(trim())`), la misma que usa la regla de deals.
 */

export interface EstadoLlegadaVista {
  id: string;
  programId: string;
  valor: string;
  etapaEntrada: "pendiente_setteo" | "agendado" | null;
  prioridad: "normal" | "alta";
  alertaMinutos: number | null;
  activo: boolean;
  /** Envíos de ese programa que llegaron con este valor. */
  envios: number;
}

export interface ValorSinEstado {
  programId: string;
  programa: string;
  valor: string;
  envios: number;
}

export async function estadosDeLlegadaParaAdmin(
  db: Db,
): Promise<{ estados: EstadoLlegadaVista[]; sinFila: ValorSinEstado[] }> {
  const [filas, porValor, nombres] = await Promise.all([
    db.select().from(estadosLlegada).orderBy(estadosLlegada.programId, estadosLlegada.createdAt),
    db
      .select({ programId: sources.programId, valor: submissions.calificacion, envios: count() })
      .from(submissions)
      .innerJoin(sources, eq(sources.id, submissions.sourceId))
      .where(and(isNotNull(submissions.calificacion)))
      .groupBy(sources.programId, submissions.calificacion),
    db.select({ id: programs.id, nombre: programs.nombre }).from(programs),
  ]);

  // Envíos por (programa, llave). Dos textos con la misma llave son el mismo Estado.
  const envios = new Map<string, number>();
  const ejemplo = new Map<string, { programId: string; valor: string }>();
  for (const f of porValor) {
    if (f.valor === null) continue;
    const llave = `${f.programId}\u0000${llaveDeEstado(f.valor)}`;
    envios.set(llave, (envios.get(llave) ?? 0) + Number(f.envios));
    if (!ejemplo.has(llave)) ejemplo.set(llave, { programId: f.programId, valor: f.valor.trim() });
  }

  const conFila = new Set<string>();
  const estados = filas.map((f) => {
    const llave = `${f.programId}\u0000${llaveDeEstado(f.valor)}`;
    // Una fila inactiva no reconoce su valor: sus envíos vuelven a salir como "sin fila".
    if (f.activo) conFila.add(llave);
    return {
      id: f.id,
      programId: f.programId,
      valor: f.valor,
      etapaEntrada: f.etapaEntrada as EstadoLlegadaVista["etapaEntrada"],
      prioridad: f.prioridad,
      alertaMinutos: f.alertaMinutos,
      activo: f.activo,
      envios: envios.get(llave) ?? 0,
    };
  });

  const nombreDe = new Map(nombres.map((p) => [p.id, p.nombre]));
  const sinFila = [...ejemplo]
    .filter(([llave]) => !conFila.has(llave))
    .map(([llave, { programId, valor }]) => ({
      programId,
      programa: nombreDe.get(programId) ?? "Programa",
      valor,
      envios: envios.get(llave) ?? 0,
    }))
    .sort((a, b) => b.envios - a.envios);

  return { estados, sinFila };
}
