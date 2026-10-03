import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { esAdministrador, type Rol } from "@/lib/auth/roles";
import { editarConRastro } from "@/lib/crm/rastro";
import { abonos, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { vigente } from "@/lib/queries/vigente";
import { transicion } from "./etapas";
import { dealBloqueadoConLead } from "./leer-deal";
import { moverEtapa } from "./mover-etapa";

export const esquemaMarcarCortesia = z.object({ dealId: z.string().uuid("El deal no es válido.") });
export type DatosMarcarCortesia = z.input<typeof esquemaMarcarCortesia>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export async function marcarCortesia(
  db: Db,
  actor: { userId: string; rol: Rol },
  datos: DatosMarcarCortesia,
): Promise<void> {
  return normalizando(async () => {
    const { dealId } = esquemaMarcarCortesia.parse(datos);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await dealBloqueadoConLead(tx, dealId);
      if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado.", 409);
      if (!esAdministrador(actor.rol)) {
        throw new ErrorDeApp("Marcar una cortesía es de quien administra.", 403);
      }
      if (deal.cortesia) throw new ErrorDeApp("El deal ya es una cortesía.", 409);

      const [pagos] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(abonos)
        .where(and(eq(abonos.dealId, deal.id), vigente(abonos)));
      if ((pagos?.n ?? 0) > 0) {
        throw new ErrorDeApp("El deal ya tiene abonos: una cortesía no lleva pagos.", 409);
      }
      if (!transicion(deal.etapa, "ganado_completo")) {
        throw new ErrorDeApp(
          "Para marcarlo como cortesía, el deal tiene que estar en Contactado, Calificado, Atendido o Compromiso Verbal.",
          409,
        );
      }

      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
        deal.id,
        { cortesia: true, valorVendidoUsd: "0" },
      );
      await moverEtapa(tx, { dealId: deal.id, a: "ganado_completo", actor: { tipo: "sistema" } });
    });
  });
}
