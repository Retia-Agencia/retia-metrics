import { eq, and } from "drizzle-orm";
import type { OrigenOperativo } from "@/lib/crm/rastro";
import { abonos, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { eventoDeCreacion, deshacerEvento } from "@/lib/deshacer/deshacer";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { exigirAbonoVisible, exigirDealVisible, exigirLlamadaVisible } from "./alcance";
import { anularAbono } from "./abonos";
import { anularDeal } from "./anular-deal";
import { anularLlamada } from "./llamadas";
import type { ActorDeDeal } from "./permiso";

type Actor = ActorDeDeal & { operaComoCloser: boolean };
type Opciones = { origen: OrigenOperativo };

export async function anularDealComo(db: Db, actor: Actor, datos: { dealId: string; motivo?: string | null }, opciones: Opciones): Promise<void> {
  await exigirDealVisible(db, actor, datos.dealId);
  const evento = await eventoDeCreacion(db, "deals", datos.dealId);
  if (evento) {
    await deshacerEvento(db, actor, { dealId: datos.dealId, evento: { tipo: "cambio", changeLogId: evento }, motivo: datos.motivo ?? undefined }, opciones);
  } else {
    await anularDeal(db, actor, { dealId: datos.dealId, motivo: datos.motivo ?? undefined }, opciones);
  }
}

export async function anularAbonoComo(db: Db, actor: Actor, datos: { abonoId: string; motivo?: string | null }, opciones: Opciones): Promise<{ etapa: typeof deals.$inferSelect.etapa; movioElDeal: boolean }> {
  const visible = await exigirAbonoVisible(db, actor, datos.abonoId);
  const [antes] = await db.select({ etapa: deals.etapa }).from(abonos).innerJoin(deals, eq(deals.id, abonos.dealId))
    .where(and(eq(abonos.id, datos.abonoId), incluyendoAnulados(abonos), incluyendoAnulados(deals)));
  if (!antes) throw new ErrorDeApp("No existe el deal.", 404);
  const evento = await eventoDeCreacion(db, "abonos", datos.abonoId);
  if (!evento) return anularAbono(db, actor, { abonoId: datos.abonoId, motivo: datos.motivo ?? undefined }, opciones);
  await deshacerEvento(db, actor, {
    dealId: visible.dealId,
    evento: { tipo: "cambio", changeLogId: evento },
    motivo: datos.motivo ?? undefined,
  }, opciones);
  const [despues] = await db.select({ etapa: deals.etapa }).from(deals)
    .where(and(eq(deals.id, visible.dealId), vigente(deals)));
  if (!despues) throw new ErrorDeApp("No existe el deal.", 404);
  return { etapa: despues.etapa, movioElDeal: despues.etapa !== antes.etapa };
}

export async function anularLlamadaComo(db: Db, actor: Actor, datos: { callId: string; motivo?: string | null }, opciones: Opciones): Promise<void> {
  const visible = await exigirLlamadaVisible(db, actor, datos.callId);
  if (visible.dealId == null) throw new ErrorDeApp("La llamada no pertenece a un deal.", 409);
  const evento = await eventoDeCreacion(db, "calls", datos.callId);
  if (evento) {
    await deshacerEvento(db, actor, { dealId: visible.dealId, evento: { tipo: "cambio", changeLogId: evento }, motivo: datos.motivo ?? undefined }, opciones);
  } else {
    await anularLlamada(db, actor, datos, { origen: opciones.origen });
  }
}
