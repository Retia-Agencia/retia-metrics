import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { cohorts, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esAdministrador, trabajaLeads, type Rol } from "@/lib/auth/roles";
import { editarConRastro } from "@/lib/crm/rastro";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * El acuerdo de pago y su fecha límite (ticket 061, ADR 0053).
 *
 * Los acuerdos se conversan, no se pactan en cuotas: el deal guarda una nota
 * (`acuerdo_pago`) y una fecha límite (`fecha_limite_pago`). **El inicio de clases de la
 * cohorte asociada es siempre el límite máximo** (Mani, 28-sep): es la sugerencia con la
 * que se prellena la fecha y el tope que no se puede pasar. Una sola función decide esa
 * fecha (`fechaLimiteMaxima`) y la usan el motor de etapas, la edición del acuerdo y la
 * cartera, para que las tres hablen de la misma fecha (ADR 0024).
 */

/** Lo mínimo del deal para saber cuál es su cohorte de referencia. */
export interface DealParaFecha {
  programId: string;
  cohortId: string | null;
}

/**
 * La fecha máxima de pago de un deal: el inicio de clases de SU cohorte; si el deal aún no
 * tiene cohorte, el de la cohorte activa de su programa (la que se le asignará al cerrar,
 * spec §4). `null` si no hay ninguna cohorte de referencia: entonces no hay tope ni
 * sugerencia, y la cartera lo reporta aparte en vez de callarlo.
 *
 * Devuelve `YYYY-MM-DD` (día de Bogotá, como todo el sistema).
 */
export async function fechaLimiteMaxima(db: Db, deal: DealParaFecha): Promise<string | null> {
  if (deal.cohortId != null) {
    const [c] = await db
      .select({ inicio: cohorts.fechaInicioClases })
      .from(cohorts)
      .where(and(eq(cohorts.id, deal.cohortId), eq(cohorts.programId, deal.programId)));
    if (c) return c.inicio;
  }
  return (await cohorteActiva(deal.programId, db))?.fechaInicioClases ?? null;
}

/** Rechaza (422) una fecha límite posterior al inicio de clases de la cohorte del deal. */
export async function exigirFechaLimiteValida(db: Db, deal: DealParaFecha, fecha: string): Promise<void> {
  const maxima = await fechaLimiteMaxima(db, deal);
  // Fechas `YYYY-MM-DD`: la comparación de texto es la de calendario.
  if (maxima != null && fecha > maxima) {
    throw new ErrorDeApp(
      `La fecha límite de pago no puede pasar del inicio de clases de la cohorte (${maxima}).`,
      422,
    );
  }
}

export const esquemaAcuerdoDePago = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  /** Texto libre; vacío lo borra. Omitido no lo toca. */
  acuerdoPago: z.string().trim().optional(),
  /** `YYYY-MM-DD`; `null` la borra. Omitida no la toca. */
  fechaLimitePago: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.")
    .nullable()
    .optional(),
});
export type DatosAcuerdoDePago = z.input<typeof esquemaAcuerdoDePago>;

/** Quien edita: una persona, con su rol de vista (sale de la sesión). */
export interface ActorDeAcuerdo {
  userId: string;
  rol: Rol;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/**
 * Escribe el acuerdo de pago y/o la fecha límite de un deal, por `editarConRastro` (queda en
 * `change_log`). Lo edita el dueño del deal (`trabajaLeads`) o quien administra; un deal
 * anulado o ya cerrado (Completo, Cierre Perdido) no tiene nada que acordar.
 */
export async function editarAcuerdoDePago(db: Db, actor: ActorDeAcuerdo, datos: DatosAcuerdoDePago): Promise<void> {
  return normalizando(async () => {
    const { dealId, acuerdoPago, fechaLimitePago } = esquemaAcuerdoDePago.parse(datos);

    return (db as unknown as Transaccion).transaction(async (tx) => {
      // "Dame la fila que voy a editar" por clave primaria: `incluyendoAnulados` para poder
      // decir "está anulado" en vez de un 404 (si se edita o no es regla de esta función).
      const [deal] = await tx
        .select()
        .from(deals)
        .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
      if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
      if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado: no se edita su acuerdo de pago.", 409);
      if (deal.etapa === "completo" || deal.etapa === "cierre_perdido") {
        throw new ErrorDeApp("El deal está cerrado: no tiene acuerdo de pago que editar.", 409);
      }
      if (!esAdministrador(actor.rol)) {
        if (!trabajaLeads(actor.rol) || deal.ownerUserId !== actor.userId) {
          throw new ErrorDeApp("Solo el dueño del deal o un administrador editan su acuerdo de pago.", 403);
        }
      }

      const cambios: Record<string, unknown> = {};
      if (acuerdoPago !== undefined) cambios.acuerdoPago = acuerdoPago === "" ? null : acuerdoPago;
      if (fechaLimitePago !== undefined) {
        if (fechaLimitePago !== null) await exigirFechaLimiteValida(tx, deal, fechaLimitePago);
        cambios.fechaLimitePago = fechaLimitePago;
      }
      if (Object.keys(cambios).length === 0) return;

      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: deal.id },
        deal.id,
        cambios,
      );
    });
  });
}
