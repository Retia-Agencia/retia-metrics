import { and, eq, min } from "drizzle-orm";
import { skus } from "@/lib/db/schema";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import type { Db } from "@/lib/db/tipos";

function predicadoDeReferencia() {
  return and(
    eq(skus.activo, true),
    eq(skus.cuentaComoCupo, true),
  );
}

async function consultarPreciosDeReferencia(db: Db) {
  return unaVezPorSolicitud(db, claveDe("preciosDeReferenciaDeCiclos"), () => db
    .select({ cohortId: skus.cohortId, precio: min(skus.precioListaUsd) })
    .from(skus)
    .where(predicadoDeReferencia())
    .groupBy(skus.cohortId));
}

/** Menor precio de un SKU activo con cupo del ciclo; nulo cuando el ciclo no tiene ninguno. */
export async function precioDeReferenciaDelCiclo(db: Db, cohortId: string): Promise<number | null> {
  const fila = (await consultarPreciosDeReferencia(db)).find((precio) => precio.cohortId === cohortId);
  return fila?.precio == null ? null : Number(fila.precio);
}

/** La misma definición para varios ciclos, incluida una entrada nula para los que no tienen precio. */
export async function preciosDeReferenciaDeCiclos(
  db: Db,
  cohortIds: readonly string[],
): Promise<Map<string, number | null>> {
  const unicos = [...new Set(cohortIds)];
  const resultado = new Map<string, number | null>(unicos.map((id) => [id, null]));
  if (unicos.length === 0) return resultado;
  for (const fila of await consultarPreciosDeReferencia(db)) {
    if (resultado.has(fila.cohortId)) {
      resultado.set(fila.cohortId, fila.precio == null ? null : Number(fila.precio));
    }
  }
  return resultado;
}
