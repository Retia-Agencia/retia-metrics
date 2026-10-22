import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { cohorts, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { vigente } from "@/lib/queries/vigente";
import { cambiarCohorteDelDeal } from "./cambiar-cohorte";

const entradaSchema = z.object({
  dealIds: z.array(z.string().uuid("Un deal no es válido.")).min(1, "Elige al menos un deal.").max(500),
  destinoId: z.string().uuid("La cohorte destino no es válida."),
});

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/** Pasa, de forma atómica, una selección de la bandeja Esperando corte a una cohorte ya creada. */
export async function pasarDealsEsperandoCorte(
  db: Db,
  datos: { dealIds: string[]; destinoId: string; actor: { userId: string } },
): Promise<{ movidos: number }> {
  return normalizando(async () => {
    const { dealIds, destinoId } = entradaSchema.parse({ dealIds: datos.dealIds, destinoId: datos.destinoId });
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const [destino] = await tx.select().from(cohorts).where(eq(cohorts.id, destinoId));
      if (!destino || destino.estado === "cerrado") {
        throw new ErrorDeApp("La cohorte destino no existe o está cerrada.", 422);
      }
      const filas = await tx
        .select({ deal: deals, emailLead: leads.emailNormalizado })
        .from(deals)
        .innerJoin(leads, eq(leads.id, deals.leadId))
        .where(and(inArray(deals.id, dealIds), vigente(deals)))
        .for("update", { of: deals });
      if (filas.length !== new Set(dealIds).size) {
        throw new ErrorDeApp("Alguno de los deals no existe o está anulado.", 422);
      }
      for (const fila of filas) {
        if (fila.deal.programId !== destino.programId) {
          throw new ErrorDeApp("Todos los deals deben ser del mismo programa que la cohorte.", 422);
        }
        if (fila.deal.pendiente !== "proxima_cohorte" || fila.deal.cohorteDestinoId != null || !fila.deal.cohorteDestinoTexto?.trim()) {
          throw new ErrorDeApp("Todos los deals deben estar en Esperando corte.", 422);
        }
      }
      for (const fila of filas) {
        await cambiarCohorteDelDeal(tx, {
          deal: fila.deal,
          destino,
          actorId: datos.actor.userId,
          etiqueta: fila.emailLead,
          limpiarProximaCohorte: true,
          nota: (origen, codigoDestino) => `Cohorte asignada desde Esperando corte: ${origen} → ${codigoDestino}.`,
        });
      }
      return { movidos: filas.length };
    });
  });
}
