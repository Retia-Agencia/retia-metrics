import { dealActividades } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearConRastro, type OrigenOperativo } from "@/lib/crm/rastro";

async function dejarNota(
  tx: Db,
  dealId: string,
  texto: string,
  actorId: string | null,
  reversionId?: string,
  origen: OrigenOperativo = "app",
): Promise<void> {
  await crearConRastro(
    { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId, etiqueta: dealId, reversionId, origen },
    { dealId, tipo: "nota", userId: actorId, nota: texto },
  );
}

/** Deja una explicación visible de una decisión automática. Una nota nunca mueve el deal. */
export async function dejarNotaDelSistema(tx: Db, dealId: string, texto: string, origen: OrigenOperativo = "app"): Promise<void> {
  await dejarNota(tx, dealId, texto, null, undefined, origen);
}

/** Deja una nota firmada por la persona que completó un dato sobre un deal ya cerrado. */
export async function dejarNotaDelActor(
  tx: Db,
  dealId: string,
  actorId: string,
  texto: string,
  reversionId?: string,
  origen: OrigenOperativo = "app",
): Promise<void> {
  await dejarNota(tx, dealId, texto, actorId, reversionId, origen);
}
