import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { calls, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { editarConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import { dealBloqueadoConLead } from "./leer-deal";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";

/**
 * Anular un deal (ticket 074, ADR 0026, ADR 0038): **"me equivoque al registrar este deal"**.
 *
 * ⚠️ NO es Cierre Perdido. Cierre Perdido es un resultado del negocio (el lead dijo que no) y
 * CUENTA en el embudo; anular es una correccion de tecleo y el deal deja de contar en TODA
 * metrica (`vigente(deals)`). 🩸 Si se fundieran, un error de dedo seria una venta perdida y
 * la tasa de conversion mentiria. Por eso anulado no es una etapa: es una marca ortogonal
 * (`anulado_en`, `anulado_por`, `motivo_anulacion`) que conserva en que etapa estaba.
 *
 * ## Quien puede
 * El dueño del deal o quien administra (`puedeTrabajarDeal`). **Un closer no anula el deal
 * de otro**, ni uno sin dueño: eso lo hace un administrador.
 *
 * ## El dinero no desaparece en silencio
 * Un deal con abonos VIGENTES no se anula: primero se anulan los abonos (uno por uno, con su
 * motivo, `anularAbono`). Anular el deal sin eso dejaria plata recibida colgando de un
 * registro que "nunca existio", y la caja no cuadraria con nada.
 *
 * ## Sus llamadas se anulan con él
 * Las llamadas VIGENTES del deal se anulan en la misma transaccion, cada una con su rastro y
 * el motivo "Se anuló su deal: …". 🩸 Sin esto seguian contando en agendas, show y cierres
 * del embudo: el dashboard lee `calls` con `vigente(calls)`, que no mira el deal. Se eligio la
 * cascada y no un predicado que mire el deal porque ese predicado seria una subconsulta
 * correlacionada dentro de una plantilla `sql` (AGENTS.md la prohibe), y porque la llamada se
 * registro como parte del mismo error.
 *
 * La marca se escribe por `editarConRastro`: queda quien, cuando y por que en `change_log`.
 * La base ademas exige los tres campos juntos (`deals_anulacion_completa`, ADR 0005).
 */
export const esquemaAnularDeal = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  motivo: z.string().trim().min(5, "Cuenta en al menos 5 letras por qué se anula el deal."),
});
export type DatosAnularDeal = z.input<typeof esquemaAnularDeal>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export async function anularDeal(db: Db, actor: ActorDeDeal, datos: DatosAnularDeal): Promise<void> {
  return normalizando(async () => {
    const { dealId, motivo } = esquemaAnularDeal.parse(datos);

    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await dealBloqueadoConLead(tx, dealId);

      if (deal.anuladoEn) throw new ErrorDeApp("El deal ya está anulado.", 409);
      if (!puedeTrabajarDeal(actor, deal)) {
        throw new ErrorDeApp(
          deal.ownerUserId == null
            ? "Este deal no tiene dueño: lo anula un administrador."
            : "Solo el dueño del deal o un administrador pueden anularlo.",
          403,
        );
      }

      // El conteo sale del modulo de saldo (ADR 0024): los abonos vigentes, no los anulados.
      const saldo = (await saldosDeDeals(tx, [deal.id])).get(deal.id);
      if (saldo && saldo.abonosVigentes > 0) {
        throw new ErrorDeApp(
          `El deal tiene ${saldo.abonosVigentes} ${saldo.abonosVigentes === 1 ? "abono vigente" : "abonos vigentes"}: anula primero los abonos y luego el deal.`,
          409,
        );
      }

      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
        deal.id,
        { anuladoEn: new Date(), anuladoPor: actor.userId, motivoAnulacion: motivo },
      );

      const llamadas = await tx
        .select({ id: calls.id })
        .from(calls)
        .where(and(eq(calls.dealId, deal.id), vigente(calls)));
      for (const llamada of llamadas) {
        await editarConRastro(
          { db: tx, tabla: calls, nombreTabla: "calls", actorId: actor.userId, etiqueta: emailLead },
          llamada.id,
          { anuladoEn: new Date(), anuladoPor: actor.userId, motivoAnulacion: `Se anuló su deal: ${motivo}` },
        );
      }
    });
  });
}
