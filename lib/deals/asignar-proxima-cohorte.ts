import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { cohorts, dealActividades, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { NOMBRE_DE_ETAPA } from "./etapas";
import { cambiarCohorteDelDeal } from "./cambiar-cohorte";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";
import { vigente } from "@/lib/queries/vigente";

const entradaSchema = z.object({
  dealIds: z.array(z.string().uuid("Un deal no es válido.")).min(1, "Elige al menos un deal.").max(500),
  destinoId: z.string().uuid("La cohorte destino no es válida."),
});
type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export async function mudarDealsDeProximaCohorte(
  tx: Db,
  datos: { cohorte: typeof cohorts.$inferSelect; actorId: string; dealIds?: string[] },
): Promise<number> {
  const condiciones = [
    eq(deals.programId, datos.cohorte.programId),
    eq(deals.pendiente, "proxima_cohorte"),
    eq(deals.cohorteDestinoId, datos.cohorte.id),
    vigente(deals),
  ];
  if (datos.dealIds) condiciones.push(inArray(deals.id, datos.dealIds));
  const filas = await tx.select({ deal: deals, email: leads.emailNormalizado })
    .from(deals).innerJoin(leads, eq(leads.id, deals.leadId)).where(and(...condiciones));
  for (const fila of filas) {
    await cambiarCohorteDelDeal(tx, {
      deal: fila.deal,
      destino: datos.cohorte,
      actorId: datos.actorId,
      etiqueta: fila.email,
      limpiarProximaCohorte: true,
      userIdDeNota: null,
      notaExacta: true,
      nota: (origen, destino) =>
        `Próxima cohorte: ${origen} → ${destino}. Estaba en ${NOMBRE_DE_ETAPA[fila.deal.etapa]}.`,
    });
  }
  return filas.length;
}

export async function asignarProximaCohorte(
  db: Db,
  datos: { dealIds: string[]; destinoId: string; actor: ActorDeDeal },
): Promise<{ movidos: number; asignados: number }> {
  return normalizando(async () => {
    const entrada = entradaSchema.parse(datos);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const [destino] = await tx.select().from(cohorts).where(eq(cohorts.id, entrada.destinoId));
      if (!destino || destino.estado === "cerrado") throw new ErrorDeApp("La cohorte destino no existe o está cerrada.", 422);
      const filas = await tx.select({ deal: deals, email: leads.emailNormalizado })
        .from(deals).innerJoin(leads, eq(leads.id, deals.leadId))
        .where(and(inArray(deals.id, entrada.dealIds), vigente(deals))).for("update", { of: deals });
      if (filas.length !== new Set(entrada.dealIds).size) throw new ErrorDeApp("Alguno de los deals no existe o está anulado.", 422);
      for (const fila of filas) {
        if (fila.deal.programId !== destino.programId || fila.deal.pendiente !== "proxima_cohorte") {
          throw new ErrorDeApp("Todos los deals deben esperar próxima cohorte en este programa.", 422);
        }
        if (!puedeTrabajarDeal(datos.actor, fila.deal)) {
          throw new ErrorDeApp("Solo el dueño del deal o un administrador pueden asignar la cohorte.", 403);
        }
      }
      if (destino.estado === "activo") {
        for (const fila of filas) {
          await editarConRastro(
            { db: tx, tabla: deals, nombreTabla: "deals", actorId: datos.actor.userId, etiqueta: fila.email },
            fila.deal.id,
            { cohorteDestinoId: destino.id },
          );
        }
        const movidos = await mudarDealsDeProximaCohorte(tx, { cohorte: destino, actorId: datos.actor.userId, dealIds: entrada.dealIds });
        return { movidos, asignados: 0 };
      }
      for (const fila of filas) {
        await editarConRastro(
          { db: tx, tabla: deals, nombreTabla: "deals", actorId: datos.actor.userId, etiqueta: fila.email },
          fila.deal.id,
          { cohorteDestinoId: destino.id },
        );
        await crearConRastro(
          { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: datos.actor.userId, etiqueta: fila.email },
          { dealId: fila.deal.id, tipo: "nota", userId: null, nota: `Cohorte asignada: ${destino.codigo}` },
        );
      }
      return { movidos: 0, asignados: filas.length };
    });
  });
}
