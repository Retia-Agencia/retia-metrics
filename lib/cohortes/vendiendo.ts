import { and, asc, eq } from "drizzle-orm";
import { cohorts } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { estadoDeCohorteSql } from "@/lib/cohortes/estado";

/** Cohortes del programa cuya ventana de venta incluye la fecha, con ambos limites inclusivos. */
export async function cohortesVendiendo(db: Db, programId: string, fecha: string) {
  return db
    .select({ id: cohorts.id, codigo: cohorts.codigo })
    .from(cohorts)
    .where(
      and(
        eq(cohorts.programId, programId),
        eq(estadoDeCohorteSql(fecha), "activo"),
      ),
    )
    .orderBy(asc(cohorts.fechaInicioVentas), asc(cohorts.codigo));
}
