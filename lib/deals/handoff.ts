import { and, eq } from "drizzle-orm";
import { calls, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { ErrorDeApp } from "@/lib/errors";
import { diaDeCalendario, diaHabilSiguiente } from "@/lib/dias-habiles";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";
import { vigente } from "@/lib/queries/vigente";

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/** Marca que el setter ya envió el link. Repetirla reinicia el reloj de la alerta. */
export async function marcarLinkEnviado(db: Db, actor: ActorDeDeal, dealId: string): Promise<void> {
  await (db as unknown as Transaccion).transaction(async (tx) => {
    const [deal] = await tx
      .select({ id: deals.id, etapa: deals.etapa, ownerUserId: deals.ownerUserId })
      .from(deals)
      .where(and(eq(deals.id, dealId), vigente(deals)));
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    if (deal.etapa === "ganado_completo" || deal.etapa === "cierre_perdido") {
      throw new ErrorDeApp("El deal está cerrado.", 409);
    }
    if (!puedeTrabajarDeal(actor, deal)) throw new ErrorDeApp("Solo el dueño o quien administra puede enviar el link.", 403);

    const [cita] = await tx
      .select({ id: calls.id })
      .from(calls)
      .where(and(eq(calls.dealId, dealId), eq(calls.resultado, "agendada"), vigente(calls)));
    if (cita) throw new ErrorDeApp("El deal ya tiene una cita agendada.", 409);

    await editarConRastro(
      { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: deal.id },
      deal.id,
      { handoffEn: new Date() },
    );
  });
}

/** Alerta desde el siguiente día hábil de Bogotá mientras no haya una cita vigente. */
export function linkEnviadoSinCita(args: {
  handoffEn: Date | null;
  tieneCitaVigente: boolean;
  hoy: string;
}): boolean {
  if (args.handoffEn === null || args.tieneCitaVigente) return false;
  return args.hoy >= diaHabilSiguiente(diaDeCalendario(args.handoffEn));
}
