import { and, desc, eq, lt } from "drizzle-orm";
import { cohorts } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Lee las dos cohortes previas para comparar tanto la actual como la anterior con
 * su predecesora. El orden sale del inicio de clases, no de un código editable;
 * el id desempata para que dos lecturas no elijan filas distintas.
 *
 * Ambas consultas conservan la frontera del programa. No se salta una cohorte
 * sin inicio de ventas: hacerlo compararía contra otra ventana como si fuera la
 * inmediata anterior y ocultaría el dato que falta (ADR 0022).
 */
export async function ventanasAnterioresDeCohorte(
  db: Db,
  programId: string,
  cohorteId: string,
) {
  const [actual] = await db
    .select({ inicio: cohorts.fechaInicioClases })
    .from(cohorts)
    .where(and(eq(cohorts.programId, programId), eq(cohorts.id, cohorteId)));

  if (!actual) {
    return {
      anterior: null,
      anteAnterior: null,
    };
  }

  const filas = await db
    .select({
      inicio: cohorts.fechaInicioVentas,
      cierre: cohorts.fechaCierreVentas,
    })
    .from(cohorts)
    .where(and(eq(cohorts.programId, programId), lt(cohorts.fechaInicioClases, actual.inicio)))
    .orderBy(desc(cohorts.fechaInicioClases), desc(cohorts.id))
    .limit(2);

  const ventana = (fila: typeof filas[number] | undefined) => fila?.inicio
    ? {
        inicio: fila.inicio,
        cierre: fila.cierre,
      }
    : null;

  return {
    anterior: ventana(filas[0]),
    anteAnterior: ventana(filas[1]),
  };
}
