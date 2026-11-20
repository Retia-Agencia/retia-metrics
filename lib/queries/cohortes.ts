import { and, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { cohorts } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { columnasCohorteConEstado, estadoDeCohorteSql, type EstadoCohorte } from "@/lib/cohortes/estado";
import { hoyEnBogota } from "@/lib/format";

/**
 * Lecturas de cohortes que necesita el registro nativo (ticket 002) y el dashboard
 * (ticket 004). La base entra por inyeccion (por defecto la de la app) para poder
 * correr los tests sobre PGlite sin Neon, igual que `lib/queries/programas.ts`.
 */

/** Fila completa de una cohorte, tal como la devuelve la base. */
export type Cohorte = typeof cohorts.$inferSelect & { estado: EstadoCohorte };

/**
 * La cohorte activa de un programa, o `null` si no hay ninguna. Nunca revienta si
 * no existe: el registro (ticket 002) traduce el `null` a un 400 amable.
 *
 * Devuelve la fila COMPLETA, no una proyeccion, porque el dashboard (ticket 004) va
 * a necesitar su codigo y sus fechas de ventana. La garantia de "maximo una activa
 * por programa" vive en el indice unico parcial de la base (ADR 0005), asi que un
 * `limit(1)` no oculta un dato: como mucho hay una fila activa.
 */
export async function cohorteActiva(
  programId: string,
  db: Db = dbDeLaApp,
  // El dia que se mide: quien calcula para una fecha pasa la suya; sin ella, hoy en Bogota.
  hoy: string = hoyEnBogota(),
): Promise<Cohorte | null> {
  return unaVezPorSolicitud(db, claveDe("cohorteActiva", programId, hoy), async () => {
    const [fila] = await db
      .select(columnasCohorteConEstado(hoy))
      .from(cohorts)
      .where(and(eq(cohorts.programId, programId), eq(estadoDeCohorteSql(hoy), "activo")))
      .limit(1);
    return fila ?? null;
  });
}
