import { and, asc, desc, eq, sql } from "drizzle-orm";
import { deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

/**
 * ¿Cuál es EL deal de una persona en un programa? (Mani, 24-oct; tickets 309 y 313). Un lead
 * puede tener varios deals en el tiempo, y no siempre el que nació de un envío dado: uno se abre a
 * mano, por el traslado o desde otro envío. La respuesta, determinista: el abierto (a lo sumo hay
 * uno, `deals_uno_abierto_por_lead_y_programa_idx`); si no hay, el más reciente; desempate por id.
 * Anulados no cuentan. Devuelve los ids, uno por lead, para filtrar un join con `inArray`.
 */
export function idsDelDealDeLaPersona(db: Db, programId: string) {
  return db
    .selectDistinctOn([deals.leadId], { id: deals.id })
    .from(deals)
    .where(and(eq(deals.programId, programId), vigente(deals)))
    .orderBy(
      deals.leadId,
      asc(sql`case when ${deals.etapa} in ('ganado_completo', 'cierre_perdido') then 1 else 0 end`),
      desc(deals.createdAt),
      asc(deals.id),
    );
}
