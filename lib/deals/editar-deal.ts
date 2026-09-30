import { eq } from "drizzle-orm";
import { z } from "zod";
import { exigirAreaActiva } from "@/lib/catalogo/areas";
import { deals, motivos, productos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esAdministrador } from "@/lib/auth/roles";
import { editarConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { dealBloqueadoConLead } from "./leer-deal";
import { esDuenoPosible } from "./duenos";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";

/**
 * Editar los campos sueltos de un deal (ticket 074, ADR 0042): un deal NO es inmutable.
 * Si editar fuera imposible, anular seria el unico remedio para un dato mal puesto y se
 * usaria para todo, que es justo lo que el ADR 0038 evita.
 *
 * Aqui van: producto, dueño, fecha de seguimiento y motivo del Cierre Perdido. **Lo demas
 * ya tiene su puerta y no se duplica**: el acuerdo de pago y su fecha limite son
 * `editarAcuerdoDePago` (`pago.ts`), la cohorte es `cambiarCohorte` (`estudiante.ts`), y
 * **la etapa NUNCA se edita aqui**: solo `moverEtapa()` la escribe (ADR 0037). El esquema
 * ni siquiera tiene el campo, y `editarConRastro` lo rechazaria de todas formas.
 *
 * Campo ausente = no se toca. `null` = se borra (solo donde el campo admite vacio).
 *
 * ## Quien puede
 * El dueño del deal o quien administra (`puedeTrabajarDeal`). **Cambiar el dueño es solo de
 * quien administra**: reasignar el trabajo de otro es administrar; un closer reclama un deal
 * sin dueño desde el Kanban (ticket 070), no desde aqui.
 */
export const esquemaEditarDeal = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  productoId: z.string().uuid("El producto no es válido.").optional(),
  ownerUserId: z.string().uuid("El dueño no es válido.").optional(),
  fechaSeguimiento: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.")
    .nullable()
    .optional(),
  motivoId: z.string().uuid("El motivo no es válido.").nullable().optional(),
  areaDeclaradaId: z.string().uuid("El área no es válida.").nullable().optional(),
});
export type DatosEditarDeal = z.input<typeof esquemaEditarDeal>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/** Devuelve `true` si algo cambio (si no, no se escribe ni rastro). */
export async function editarDeal(db: Db, actor: ActorDeDeal, datos: DatosEditarDeal): Promise<boolean> {
  return normalizando(async () => {
    const { dealId, productoId, ownerUserId, fechaSeguimiento, motivoId, areaDeclaradaId } = esquemaEditarDeal.parse(datos);

    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await dealBloqueadoConLead(tx, dealId);

      if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado: no se edita.", 409);
      if (!puedeTrabajarDeal(actor, deal)) {
        throw new ErrorDeApp(
          deal.ownerUserId == null
            ? "Este deal no tiene dueño: reclámalo antes de editarlo."
            : "Solo el dueño del deal o un administrador pueden editarlo.",
          403,
        );
      }

      const cambios: Record<string, unknown> = {};

      if (ownerUserId !== undefined) {
        if (!esAdministrador(actor.rol)) {
          throw new ErrorDeApp("Cambiar el dueño de un deal es de quien administra.", 403);
        }
        if (!(await esDuenoPosible(tx, deal.programId, ownerUserId))) {
          throw new ErrorDeApp("El dueño tiene que ser un closer activo con membresía en el programa del deal.", 422);
        }
        cambios.ownerUserId = ownerUserId;
      }

      if (productoId !== undefined) {
        if (deal.etapa === "completo") {
          throw new ErrorDeApp("El deal está completo: cambiar su producto movería su saldo.", 409);
        }
        const [producto] = await tx.select().from(productos).where(eq(productos.id, productoId));
        // Frontera: un producto de otro programa no existe para este deal (ADR 0043).
        if (!producto || producto.programId !== deal.programId || !producto.activo) {
          throw new ErrorDeApp("El producto no existe, está inactivo o es de otro programa.", 422);
        }
        // El precio nuevo se mide contra lo YA abonado, que sale del modulo de saldo (ADR 0024):
        // un producto mas barato que lo recibido dejaria un sobrepago que ninguna reja ve.
        const actual = (await saldosDeDeals(tx, [deal.id])).get(deal.id);
        if (actual && actual.abonosVigentes > 0) {
          if (actual.moneda != null && actual.moneda !== producto.moneda) {
            throw new ErrorDeApp("El deal ya tiene abonos en otra moneda: no se convierte moneda.", 422);
          }
          if (Number(producto.precioLista) < actual.abonado) {
            throw new ErrorDeApp(
              "El producto cuesta menos de lo que el deal ya abonó: anula primero el abono que sobra.",
              422,
            );
          }
        }
        cambios.productoId = productoId;
      }

      if (fechaSeguimiento !== undefined) {
        if (deal.etapa === "completo" || deal.etapa === "cierre_perdido") {
          throw new ErrorDeApp("El deal está cerrado: no tiene fecha de seguimiento.", 409);
        }
        cambios.fechaSeguimiento = fechaSeguimiento;
      }

      if (areaDeclaradaId !== undefined) {
        if (areaDeclaradaId !== null) await exigirAreaActiva(tx, areaDeclaradaId);
        cambios.areaDeclaradaId = areaDeclaradaId;
      }

      if (motivoId !== undefined) {
        // El motivo del deal es el del Cierre Perdido: en cualquier otra etapa no significa nada.
        if (deal.etapa !== "cierre_perdido") {
          throw new ErrorDeApp("El motivo solo se edita en un deal en Cierre Perdido.", 409);
        }
        if (motivoId === null) {
          throw new ErrorDeApp("Un Cierre Perdido necesita motivo: elige otro en vez de borrarlo.", 422);
        }
        const [motivo] = await tx
          .select({ tipo: motivos.tipo, activo: motivos.activo })
          .from(motivos)
          .where(eq(motivos.id, motivoId));
        if (!motivo || !motivo.activo || motivo.tipo !== "perdida") {
          throw new ErrorDeApp("El motivo no existe o no es de pérdida.", 422);
        }
        cambios.motivoId = motivoId;
      }

      if (Object.keys(cambios).length === 0) return false;
      return editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
        deal.id,
        cambios,
      );
    });
  });
}
