import { and, eq, inArray } from "drizzle-orm";
import { cohorts, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { vigente } from "@/lib/queries/vigente";

/**
 * Los estudiantes de un programa: **una consulta sobre `etapa`, no una tabla ni una columna**
 * (ticket 063). Un estudiante es un deal vigente en Abonado o Completo. Las listas por
 * programa y por cohorte son filtros de esta misma consulta.
 *
 * El programa es frontera (ADR 0043): recibe UNO y no admite "todos". La cohorte, si se pide,
 * se filtra dentro de ese programa, así que una cohorte ajena no devuelve nada.
 */
export const ETAPAS_DE_ESTUDIANTE: readonly EtapaDeal[] = ["abonado", "completo"];

export interface Estudiante {
  dealId: string;
  leadId: string;
  nombre: string | null;
  email: string;
  etapa: EtapaDeal;
  cohortId: string | null;
  codigoCohorte: string | null;
  ownerUserId: string | null;
  onboardedAt: Date | null;
}

export async function estudiantesDe(db: Db, programId: string, filtro: { cohortId?: string } = {}): Promise<Estudiante[]> {
  return db
    .select({
      dealId: deals.id,
      leadId: deals.leadId,
      nombre: leads.nombre,
      email: leads.emailNormalizado,
      etapa: deals.etapa,
      cohortId: deals.cohortId,
      codigoCohorte: cohorts.codigo,
      ownerUserId: deals.ownerUserId,
      onboardedAt: deals.onboardedAt,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(cohorts, eq(cohorts.id, deals.cohortId))
    .where(
      and(
        eq(deals.programId, programId),
        inArray(deals.etapa, [...ETAPAS_DE_ESTUDIANTE]),
        vigente(deals),
        filtro.cohortId ? eq(deals.cohortId, filtro.cohortId) : undefined,
      ),
    )
    .orderBy(leads.emailNormalizado);
}
