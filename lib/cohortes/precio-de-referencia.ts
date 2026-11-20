import { and, eq, inArray, min } from "drizzle-orm";
import { skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

function predicadoDeReferencia(cohortIds: readonly string[]) {
  return and(
    inArray(skus.cohortId, [...cohortIds]),
    eq(skus.activo, true),
    eq(skus.cuentaComoCupo, true),
  );
}

async function consultarPreciosDeReferencia(db: Db, cohortIds: readonly string[]) {
  if (cohortIds.length === 0) return [];
  return db
    .select({ cohortId: skus.cohortId, precio: min(skus.precioListaUsd) })
    .from(skus)
    .where(predicadoDeReferencia(cohortIds))
    .groupBy(skus.cohortId);
}

/** Menor precio de un SKU activo con cupo del ciclo; nulo cuando el ciclo no tiene ninguno. */
export async function precioDeReferenciaDelCiclo(db: Db, cohortId: string): Promise<number | null> {
  const precios = await consultarPreciosDeReferencia(db, [cohortId]);
  return precios[0]?.precio == null ? null : Number(precios[0].precio);
}

/** La misma definición para varios ciclos, incluida una entrada nula para los que no tienen precio. */
export async function preciosDeReferenciaDeCiclos(
  db: Db,
  cohortIds: readonly string[],
): Promise<Map<string, number | null>> {
  const unicos = [...new Set(cohortIds)];
  const resultado = new Map<string, number | null>(unicos.map((id) => [id, null]));
  for (const fila of await consultarPreciosDeReferencia(db, unicos)) {
    resultado.set(fila.cohortId, fila.precio == null ? null : Number(fila.precio));
  }
  return resultado;
}
