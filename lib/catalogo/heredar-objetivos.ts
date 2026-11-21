import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { changeLog, cohorts, objetivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import { DEFINICION_METRICAS_OBJETIVO } from "@/lib/objetivos/metricas";

/**
 * ADR 0141: un ciclo nuevo hereda los umbrales del ciclo anterior de su programa. Solo las
 * métricas que miden la calidad del gasto; cupos, agendas e inversión son del tamaño de cada ciclo.
 */
export const METRICAS_HEREDABLES = ["costo_por_agenda", "costo_por_venta", "roas", "conversion_agenda_venta"] as const;

export interface HerenciaDeUmbrales {
  desde: string;
  metricas: string[];
}

/** Copia, dentro de la transacción que crea el ciclo, los umbrales activos del ciclo anterior. Nunca inventa un valor. */
export async function heredarObjetivos(
  tx: Db,
  actorId: string,
  programId: string,
  cohortIdNuevo: string,
): Promise<HerenciaDeUmbrales | null> {
  const [anterior] = await tx
    .select({ id: cohorts.id, codigo: cohorts.codigo })
    .from(cohorts)
    .where(and(
      eq(cohorts.programId, programId),
      ne(cohorts.id, cohortIdNuevo),
      isNotNull(cohorts.fechaInicioVentas),
      isNotNull(cohorts.fechaCierreVentas),
    ))
    .orderBy(desc(cohorts.fechaInicioVentas), desc(cohorts.fechaCierreVentas))
    .limit(1);
  if (!anterior) return null;

  const filas = await tx
    .select()
    .from(objetivos)
    .where(and(
      eq(objetivos.cohortId, anterior.id),
      eq(objetivos.activo, true),
      inArray(objetivos.metrica, [...METRICAS_HEREDABLES]),
    ));
  if (filas.length === 0) return null;

  for (const fila of filas) {
    const id = crypto.randomUUID();
    const nombre = DEFINICION_METRICAS_OBJETIVO[fila.metrica]?.nombre ?? fila.metrica;
    const etiqueta = `${nombre} · ${fila.area ?? "total"} (heredado de ${anterior.codigo})`;
    const valores = {
      cohortId: cohortIdNuevo,
      area: fila.area,
      metrica: fila.metrica,
      meta: fila.meta,
      aceptable: fila.aceptable,
      moneda: fila.moneda,
      activo: true,
    };
    await tx.insert(objetivos).values({ id, ...valores });
    await tx.insert(changeLog).values(Object.entries(valores).map(([campo, valor]) => ({
      tabla: "objetivos",
      registroId: id,
      etiqueta,
      campo,
      valorAnterior: null,
      valorNuevo: textoDeBitacora(valor),
      origen: "app" as const,
      userId: actorId,
    })));
  }

  const metricas = [...new Set(filas.map((f) => DEFINICION_METRICAS_OBJETIVO[f.metrica]?.nombre ?? f.metrica))];
  return { desde: anterior.codigo, metricas };
}
