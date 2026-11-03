import { and, eq } from "drizzle-orm";
import { dealActividades, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

/** Confirma que el usuario dejó una huella de setteo antes de entregar el deal. */
export async function tieneEvidenciaDeSetter(db: Db, dealId: string, userId: string): Promise<boolean> {
  const [deal] = await db
    .select({ handoffEn: deals.handoffEn })
    .from(deals)
    .where(and(eq(deals.id, dealId), vigente(deals)))
    .limit(1);

  if (!deal) return false;
  if (deal.handoffEn !== null) return true;

  const [actividad] = await db
    .select({ id: dealActividades.id })
    .from(dealActividades)
    .where(and(eq(dealActividades.dealId, dealId), eq(dealActividades.userId, userId), vigente(dealActividades)))
    .limit(1);
  return actividad !== undefined;
}
