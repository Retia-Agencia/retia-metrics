import { and, eq } from "drizzle-orm";
import { deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados } from "@/lib/queries/vigente";

export type FilaDeal = typeof deals.$inferSelect;

/**
 * "Dame el deal que voy a tocar", con el correo de su lead para la etiqueta del rastro
 * (ticket 074). Por clave primaria y BLOQUEADO (`for update`): dos ediciones simultaneas
 * del mismo deal se ponen en fila y la segunda decide con la fila fresca (ADR 0005).
 *
 * `incluyendoAnulados` a proposito: no es una metrica, es una fila por su id. Si un deal
 * anulado se toca o no lo decide cada operacion (no se toca) y, dicho con su nombre,
 * queda en el grep. Sin fila: 404.
 *
 * Debe llamarse dentro de una transaccion, o el bloqueo se suelta al terminar la consulta.
 */
export async function dealBloqueadoConLead(tx: Db, dealId: string): Promise<{ deal: FilaDeal; emailLead: string }> {
  const [fila] = await tx
    .select({ deal: deals, emailLead: leads.emailNormalizado })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)))
    .for("update", { of: deals });
  if (!fila) throw new ErrorDeApp("No existe el deal.", 404);
  return fila;
}
