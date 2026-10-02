import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { cohorts, dealActividades, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import type { Rol } from "@/lib/auth/roles";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { fechaLimiteMaxima } from "./pago";
import { puedeTrabajarDeal } from "./permiso";

/**
 * Lo único del onboarding que entra al CRM y el único movimiento extraordinario de un deal
 * sobre su cohorte (ticket 063, ADR 0037, ADR 0042). Un **estudiante** no es una tabla ni una
 * columna: es un deal en Ganado Pago Parcial o Ganado Pagado Completo.
 *
 * Quién puede (Mani, 28-sep): el closer dueño del deal, o quien administra (gerente y
 * developer, `esAdministrador`, ADR 0025). Nunca `rol === "..."` a mano.
 */

export interface ActorDeEstudiante {
  userId: string;
  rol: Rol;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
type FilaDeal = typeof deals.$inferSelect;

/**
 * Lee el deal BLOQUEADO (`for update`) y exige que sea un estudiante vigente del que el actor
 * pueda ocuparse. `incluyendoAnulados` porque es "dame la fila que voy a tocar" por clave
 * primaria: si un deal anulado se toca o no lo decide esta función (no), y dicho con su
 * nombre queda en el grep.
 */
async function estudianteDelActor(
  tx: Db,
  dealId: string,
  actor: ActorDeEstudiante,
  { soloEstudiante = true }: { soloEstudiante?: boolean } = {},
): Promise<{ deal: FilaDeal; emailLead: string }> {
  const [fila] = await tx
    .select({ deal: deals, emailLead: leads.emailNormalizado })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)))
    .for("update", { of: deals });
  if (!fila) throw new ErrorDeApp("No existe el deal.", 404);
  const { deal } = fila;
  if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado: no cuenta en ninguna métrica.", 409);
  if (soloEstudiante && deal.etapa !== "ganado_parcial" && deal.etapa !== "ganado_completo") {
    throw new ErrorDeApp("Solo un estudiante (deal ganado) tiene onboarding y cohorte propios.", 409);
  }
  if (!puedeTrabajarDeal(actor, deal)) {
    throw new ErrorDeApp("Solo el closer dueño del deal o un administrador pueden hacerlo.", 403);
  }
  return fila;
}

export const esquemaMarcarOnboarded = z.object({ dealId: z.string().uuid("El deal no es válido.") });
export type DatosMarcarOnboarded = z.input<typeof esquemaMarcarOnboarded>;

/**
 * Marca al estudiante como onboarded. **Timestamp y no booleano** (enmienda a la spec §2 del
 * 21-sep): importa CUÁNDO. Se escribe una vez: marcar de nuevo es un 409, para que la fecha
 * original no se pise en silencio. Queda en `change_log` con quién.
 */
export async function marcarOnboarded(db: Db, actor: ActorDeEstudiante, datos: DatosMarcarOnboarded): Promise<{ onboardedAt: Date }> {
  return normalizando(async () => {
    const { dealId } = esquemaMarcarOnboarded.parse(datos);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await estudianteDelActor(tx, dealId, actor);
      if (deal.onboardedAt) throw new ErrorDeApp("El estudiante ya tiene su onboarding marcado.", 409);
      const onboardedAt = new Date();
      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
        deal.id,
        { onboardedAt },
      );
      return { onboardedAt };
    });
  });
}

/**
 * Borra la marca de onboarding (Mani, 28-sep): para corregir un error de quien la puso. Lo hace
 * quien puede marcarla (el closer dueño o un administrador) y queda en `change_log` con quién y
 * el valor anterior. **No exige que el deal siga siendo estudiante**: si una anulación lo sacó de
 * una etapa ganada, la marca vieja tiene que poder quitarse, o volvería a aparecer como un
 * onboarding que ya no corresponde cuando el deal vuelva a pagar.
 */
export async function desmarcarOnboarded(db: Db, actor: ActorDeEstudiante, datos: DatosMarcarOnboarded): Promise<void> {
  return normalizando(async () => {
    const { dealId } = esquemaMarcarOnboarded.parse(datos);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await estudianteDelActor(tx, dealId, actor, { soloEstudiante: false });
      if (!deal.onboardedAt) throw new ErrorDeApp("El estudiante no tiene onboarding marcado.", 409);
      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
        deal.id,
        { onboardedAt: null },
      );
    });
  });
}

export const esquemaCambiarCohorte = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  cohortId: z.string().uuid("La cohorte no es válida."),
  motivo: z.string().trim().min(1, "El motivo es obligatorio."),
});
export type DatosCambiarCohorte = z.input<typeof esquemaCambiarCohorte>;

export interface CohorteCambiada {
  /** La fecha límite de pago se corrigió porque pasaba del inicio de clases de la cohorte nueva. */
  fechaLimiteAjustada: string | null;
}

/**
 * Cambia la cohorte de cualquier deal vigente del actor, con quién y por qué. Es como se
 * representan los 12 estudiantes que compraron en agosto y pasaron a septiembre: **no hace
 * falta una relación N:N**.
 *
 * - La cohorte nueva es del MISMO programa (frontera, ADR 0043), distinta de la actual, y
 *   **futura o activa** (Mani, 28-sep). El motivo es texto libre y obligatorio.
 * - **La venta cuenta donde asiste**: `deals.cohort_id` es la cohorte nueva, así la meta y la
 *   lista de estudiantes de cada cohorte reflejan a quién le da clase.
 * - El quién y cuándo los guarda `change_log` (campo `cohortId`, valor anterior y nuevo), y el
 *   POR QUÉ una nota del deal (`deal_actividades`), en la misma transacción.
 * - Si la fecha límite de pago del deal pasa del inicio de clases de la cohorte nueva, se baja a
 *   ese inicio: el inicio de clases es SIEMPRE el tope (ticket 061). Queda en el rastro y en la nota.
 */
export async function cambiarCohorte(db: Db, actor: ActorDeEstudiante, datos: DatosCambiarCohorte): Promise<CohorteCambiada> {
  return normalizando(async () => {
    const { dealId, cohortId, motivo } = esquemaCambiarCohorte.parse(datos);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await estudianteDelActor(tx, dealId, actor, { soloEstudiante: false });

      const [destino] = await tx.select().from(cohorts).where(eq(cohorts.id, cohortId));
      if (!destino || destino.programId !== deal.programId) {
        throw new ErrorDeApp("La cohorte no existe o es de otro programa.", 422);
      }
      if (destino.id === deal.cohortId) throw new ErrorDeApp("El deal ya está en esa cohorte.", 422);
      if (destino.estado === "cerrado") {
        throw new ErrorDeApp("Solo se puede mover a una cohorte futura o activa.", 422);
      }

      let origen = "sin cohorte";
      if (deal.cohortId) {
        const [o] = await tx.select({ codigo: cohorts.codigo }).from(cohorts).where(eq(cohorts.id, deal.cohortId));
        origen = o?.codigo ?? origen;
      }

      const cambios: Record<string, unknown> = { cohortId: destino.id };
      let fechaLimiteAjustada: string | null = null;
      const maxima = await fechaLimiteMaxima(tx, { programId: deal.programId, cohortId: destino.id });
      if (deal.fechaLimitePago != null && maxima != null && deal.fechaLimitePago > maxima) {
        cambios.fechaLimitePago = maxima;
        fechaLimiteAjustada = maxima;
      }

      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
        deal.id,
        cambios,
      );
      await crearConRastro(
        { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: actor.userId, etiqueta: emailLead },
        {
          dealId: deal.id,
          tipo: "nota",
          userId: actor.userId,
          nota:
            `Cambio de cohorte: ${origen} → ${destino.codigo}. ${motivo}` +
            (fechaLimiteAjustada ? ` (La fecha límite de pago pasó de ${deal.fechaLimitePago} a ${fechaLimiteAjustada}, el inicio de clases.)` : ""),
        },
      );
      return { fechaLimiteAjustada };
    });
  });
}
