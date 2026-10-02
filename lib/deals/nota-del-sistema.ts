import { dealActividades } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearConRastro } from "@/lib/crm/rastro";

/** Deja una explicación visible de una decisión automática. Una nota nunca mueve el deal. */
export async function dejarNotaDelSistema(tx: Db, dealId: string, texto: string): Promise<void> {
  await crearConRastro(
    { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: null, etiqueta: dealId },
    { dealId, tipo: "nota", userId: null, nota: texto },
  );
}
