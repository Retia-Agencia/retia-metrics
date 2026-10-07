import { eq } from "drizzle-orm";
import { z } from "zod";
import { exigirAreaActiva } from "@/lib/catalogo/areas";
import { dealActividades, deals, motivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esAdministrador } from "@/lib/auth/roles";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { usd } from "@/lib/format";
import { dealBloqueadoConLead } from "./leer-deal";
import { esDuenoPosible } from "./duenos";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";
import { moverEtapa } from "./mover-etapa";
import { ETAPAS_VENDIDAS } from "./etapas";
import { congelarValorVendido, esquemaDescuentoUsdOpcional } from "./valor-vendido";
import { cambiarDuenoDeal } from "./cambiar-dueno";

/**
 * Editar los campos sueltos de un deal (ticket 074, ADR 0042): un deal NO es inmutable.
 * Si editar fuera imposible, anular seria el unico remedio para un dato mal puesto y se
 * usaria para todo, que es justo lo que el ADR 0038 evita.
 *
 * Aqui van: descuento, dueño, area declarada y motivo del Cierre Perdido. **Lo demas
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
  descuentoUsd: esquemaDescuentoUsdOpcional,
  motivoCambioVenta: z.string().trim().min(1, "El motivo es obligatorio para cambiar una venta.").optional(),
  ownerUserId: z.string().uuid("El dueño no es válido.").optional(),
  motivoId: z.string().uuid("El motivo no es válido.").nullable().optional(),
  areaDeclaradaId: z.string().uuid("El área no es válida.").nullable().optional(),
});
export type DatosEditarDeal = z.input<typeof esquemaEditarDeal>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/** Devuelve `true` si algo cambio (si no, no se escribe ni rastro). */
export async function editarDeal(db: Db, actor: ActorDeDeal, datos: DatosEditarDeal): Promise<boolean> {
  return normalizando(async () => {
    const { dealId, descuentoUsd, motivoCambioVenta, ownerUserId, motivoId, areaDeclaradaId } = esquemaEditarDeal.parse(datos);

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
      }

      let cambioDeVenta = false;
      if (descuentoUsd !== undefined) {
        const saldoAntes = (await saldosDeDeals(tx, [deal.id])).get(deal.id);
        const vendido = (saldoAntes?.abonosVigentes ?? 0) > 0 || (ETAPAS_VENDIDAS as readonly string[]).includes(deal.etapa);
        const congelado = await congelarValorVendido(tx, {
          deal,
          descuentoUsd,
          actorId: actor.userId,
          etiqueta: emailLead,
        });
        cambioDeVenta = congelado.valorAnteriorUsd !== congelado.valorVendidoUsd;
        if (vendido && cambioDeVenta) {
          if (!motivoCambioVenta) {
            throw new ErrorDeApp("El motivo es obligatorio para cambiar una venta.", 422);
          }
          const descuentoAnterior =
            congelado.valorAnteriorUsd == null
              ? 0
              : Math.round((congelado.precioTicketUsd - congelado.valorAnteriorUsd) * 100) / 100;
          await crearConRastro(
            { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: actor.userId, etiqueta: emailLead },
            {
              dealId: deal.id,
              tipo: "nota",
              userId: actor.userId,
              nota: `Cambio de descuento: ${usd(descuentoAnterior)} → ${usd(congelado.descuentoUsd)} (total ${usd(congelado.valorAnteriorUsd ?? congelado.precioTicketUsd)} → ${usd(congelado.valorVendidoUsd)}). ${motivoCambioVenta}`,
            },
          );
        }
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

      const editoCampos =
        Object.keys(cambios).length === 0
          ? false
          : await editarConRastro(
              { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
              deal.id,
              cambios,
            );

      const cambioDueno = ownerUserId === undefined
        ? false
        : await cambiarDuenoDeal(tx, {
            dealId: deal.id,
            ownerActual: deal.ownerUserId,
            ownerNuevo: ownerUserId,
            actorId: actor.userId,
            etiqueta: emailLead,
          });

      if (cambioDeVenta) {
        const despues = (await saldosDeDeals(tx, [deal.id])).get(deal.id);
        if (deal.etapa === "ganado_parcial" && despues?.saldo === 0) {
          await moverEtapa(tx, { dealId: deal.id, a: "ganado_completo", actor: { tipo: "sistema" } });
        } else if (deal.etapa === "ganado_completo" && despues?.saldo != null && despues.saldo > 0) {
          await moverEtapa(tx, { dealId: deal.id, a: "ganado_parcial", actor: { tipo: "sistema" } });
        }
      }
      return cambioDeVenta || editoCampos || cambioDueno;
    });
  });
}
