import { z } from "zod";
import { deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { trabajaLeads } from "@/lib/auth/roles";
import { editarConRastro } from "@/lib/crm/rastro";
import { dealBloqueadoConLead } from "./leer-deal";
import { esDuenoPosible } from "./duenos";
import type { ActorDeDeal } from "./permiso";

/**
 * Reclamar un deal SIN dueño (ticket 070): el closer que ve el lead primero lo toma. Es el
 * reemplazo de la rotacion ciega del script (ADR 0021): "sin dueño" es un estado valido, y
 * el reparto lo hace una persona, no un turno fijo.
 *
 * ## Quien puede
 * Quien `trabajaLeads` (closer y developer, ADR 0003 y 0025) **y** es un dueño posible del
 * programa del deal (`esDuenoPosible`: closer activo con membresia ACTIVA ahi, o el
 * developer por acceso total). El gerente NO puede: administra pero no trabaja leads, asi que
 * no puede quedar como dueño de un deal (ADR 0003). Nunca `rol === "..."` a mano — el
 * developer quedaria afuera; se pregunta por `trabajaLeads`, y `esDuenoPosible` ya usa
 * `trabajaLeads` internamente y la membresia.
 *
 * ## El dueño sale de la SESION, nunca del input
 * El nuevo dueño es SIEMPRE el actor de la sesion (`actor.userId`). No hay parametro de
 * dueño: reclamar es "lo tomo YO". Reasignar el deal de otro a un tercero es OTRA operacion
 * (administrar), y esa es `editarDeal` con `ownerUserId`, exclusiva de quien administra.
 *
 * ## La carrera: dos closers reclaman a la vez
 * 🩸 El deal se BLOQUEA dentro de una transaccion (`dealBloqueadoConLead`, `for update`): dos
 * reclamos simultaneos se ponen en fila. El segundo lee la fila fresca —ya con dueño— y se
 * rechaza con 409. Sin el bloqueo, los dos leerian "sin dueño" y el ultimo `update` ganaria
 * en silencio, pisando al primero: dos closers creerian tener el lead y solo uno lo tendria,
 * sin un solo error. La exclusion vive en el bloqueo de fila, como en `editarDeal` y
 * `anularDeal`, no en un `select` previo (entre comprobar y escribir cabe otra escritura).
 *
 * ## Un deal anulado no se reclama
 * Un deal anulado es un registro que nunca debio existir (ADR 0038): no se le da dueño.
 *
 * El owner se escribe por `editarConRastro`: queda quien reclamo y cuando en `change_log`
 * (ADR 0042). Si el deal ya tenia dueño, `editarConRastro` no reescribiria nada, pero aqui se
 * rechaza antes con un mensaje claro.
 */
export const esquemaReclamarDeal = z.object({
  dealId: z.string().uuid("El deal no es válido."),
});
export type DatosReclamarDeal = z.input<typeof esquemaReclamarDeal>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export async function reclamarDeal(db: Db, actor: ActorDeDeal, datos: DatosReclamarDeal): Promise<void> {
  return normalizando(async () => {
    const { dealId } = esquemaReclamarDeal.parse(datos);

    // Quien no trabaja leads no puede ser dueño de un deal (el gerente administra, no
    // registra, ADR 0003). Se corta antes de tocar la base. El developer pasa (trabajaLeads).
    if (!trabajaLeads(actor.rol)) {
      throw new ErrorDeApp("Reclamar un deal es de quien trabaja leads, no de quien administra.", 403);
    }

    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await dealBloqueadoConLead(tx, dealId);

      if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado: no se reclama.", 409);
      if (deal.ownerUserId != null) {
        // Con la fila bloqueada, un dueño ya escrito significa que otra persona ganó la carrera.
        throw new ErrorDeApp("Ya lo reclamó otra persona.", 409);
      }

      // Que el actor pueda ser dueño de un deal de ESTE programa: closer activo con
      // membresia activa (o developer). Misma pregunta que la reja de reasignar (ADR 0043).
      if (!(await esDuenoPosible(tx, deal.programId, actor.userId))) {
        throw new ErrorDeApp("Para reclamar un deal tienes que tener membresía activa en su programa.", 403);
      }

      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
        deal.id,
        { ownerUserId: actor.userId },
      );
    });
  });
}
