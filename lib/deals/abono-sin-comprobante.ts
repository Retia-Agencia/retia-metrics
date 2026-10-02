import { and, inArray, isNull } from "drizzle-orm";
import { abonos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

/** Una sola respuesta para ficha, Kanban e Inbox: deals con un abono vigente sin soporte. */
export async function dealsConAbonoSinComprobante(db: Db, dealIds: readonly string[]): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set();
  const filas = await db
    .select({ dealId: abonos.dealId })
    .from(abonos)
    .where(and(inArray(abonos.dealId, [...dealIds]), isNull(abonos.comprobanteUrl), vigente(abonos)));
  return new Set(filas.map((fila) => fila.dealId));
}
