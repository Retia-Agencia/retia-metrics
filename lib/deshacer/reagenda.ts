import { and, desc, eq } from "drizzle-orm";
import { calls, changeLog, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro, type OrigenOperativo } from "@/lib/crm/rastro";
import { fueCancelada, noAsistio } from "@/lib/deals/resultados-de-llamada";
import { vigente } from "@/lib/queries/vigente";

type EventoDeResultado = Pick<typeof changeLog.$inferSelect, "detectadoEn" | "origen" | "valorNuevo">;

/**
 * Restaura el pendiente que la misma operación puso al marcar una llamada fallida.
 * ponytail: reemplazar esta regla cuando exista la reversión compuesta del ticket 411.
 */
export async function restaurarPendienteAlDeshacerLlamadaFallida(
  tx: Db,
  actorId: string,
  deal: Pick<typeof deals.$inferSelect, "id" | "pendiente">,
  evento: EventoDeResultado,
  reversionId: string,
  origen: OrigenOperativo,
): Promise<void> {
  if (evento.valorNuevo == null || (!noAsistio(evento.valorNuevo) && !fueCancelada(evento.valorNuevo))) return;
  if (deal.pendiente !== "reagenda") return;

  const resultadosVigentes = await tx.select({ resultado: calls.resultado }).from(calls)
    .where(and(eq(calls.dealId, deal.id), vigente(calls)));
  if (resultadosVigentes.some(({ resultado }) => noAsistio(resultado) || fueCancelada(resultado))) return;

  const [cambioDePendiente] = await tx.select({ anterior: changeLog.valorAnterior }).from(changeLog)
    .where(and(
      eq(changeLog.tabla, "deals"),
      eq(changeLog.registroId, deal.id),
      eq(changeLog.campo, "pendiente"),
      eq(changeLog.valorNuevo, "reagenda"),
      eq(changeLog.detectadoEn, evento.detectadoEn),
      eq(changeLog.origen, evento.origen),
    ))
    .orderBy(desc(changeLog.id))
    .limit(1);

  await editarConRastro(
    {
      db: tx,
      tabla: deals,
      nombreTabla: "deals",
      actorId,
      etiqueta: deal.id,
      origen,
      reversionId,
      desdeDeshacerReagenda: true,
    },
    deal.id,
    { pendiente: cambioDePendiente?.anterior ?? null },
  );
}
