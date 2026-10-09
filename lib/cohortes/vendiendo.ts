import { and, asc, eq, gte, isNotNull, lte, ne } from "drizzle-orm";
import { cohorts } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/** Cohortes del programa cuya ventana de venta incluye la fecha, con ambos limites inclusivos. */
export async function cohortesVendiendo(db: Db, programId: string, fecha: string) {
  return db
    .select({ id: cohorts.id, codigo: cohorts.codigo })
    .from(cohorts)
    .where(
      and(
        eq(cohorts.programId, programId),
        ne(cohorts.estado, "cerrado"),
        isNotNull(cohorts.fechaInicioVentas),
        lte(cohorts.fechaInicioVentas, fecha),
        gte(cohorts.fechaCierreVentas, fecha),
      ),
    )
    .orderBy(asc(cohorts.fechaInicioVentas), asc(cohorts.codigo));
}
