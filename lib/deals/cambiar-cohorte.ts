import { eq } from "drizzle-orm";
import { cohorts, dealActividades, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { fechaLimiteMaxima } from "./pago";
import { limpiarPendientePorCambioDeCohorte } from "./mover-etapa";

type FilaDeal = typeof deals.$inferSelect;
type FilaCohorte = typeof cohorts.$inferSelect;

export interface CambioDeCohorteEscrito {
  origenCodigo: string;
  destinoCodigo: string;
  fechaLimiteAjustada: string | null;
}

/**
 * La unica escritura de un cambio de cohorte. El llamador valida si el destino es
 * admisible para su caso; esta funcion escribe cohort_id, el ajuste del plazo y la nota
 * en la MISMA transaccion y con el mismo rastro.
 */
export async function cambiarCohorteDelDeal(
  tx: Db,
  datos: {
    deal: FilaDeal;
    destino: FilaCohorte;
    actorId: string;
    etiqueta: string;
    nota: (origenCodigo: string, destinoCodigo: string) => string;
    limpiarProximaCohorte?: boolean;
    userIdDeNota?: string | null;
    /** Conserva literalmente la nota del llamador, sin anexar el ajuste del plazo. */
    notaExacta?: boolean;
  },
): Promise<CambioDeCohorteEscrito> {
  let origenCodigo = "sin cohorte";
  if (datos.deal.cohortId) {
    const [origen] = await tx
      .select({ codigo: cohorts.codigo })
      .from(cohorts)
      .where(eq(cohorts.id, datos.deal.cohortId));
    origenCodigo = origen?.codigo ?? origenCodigo;
  }

  const cambios: Record<string, unknown> = { cohortId: datos.destino.id };
  let fechaLimiteAjustada: string | null = null;
  const maxima = await fechaLimiteMaxima(tx, {
    programId: datos.deal.programId,
    cohortId: datos.destino.id,
  });
  if (datos.deal.fechaLimitePago != null && maxima != null && datos.deal.fechaLimitePago > maxima) {
    cambios.fechaLimitePago = maxima;
    fechaLimiteAjustada = maxima;
  }

  await editarConRastro(
    {
      db: tx,
      tabla: deals,
      nombreTabla: "deals",
      actorId: datos.actorId,
      etiqueta: datos.etiqueta,
    },
    datos.deal.id,
    cambios,
  );
  if (datos.limpiarProximaCohorte) {
    await limpiarPendientePorCambioDeCohorte(tx, datos.deal, datos.actorId, datos.etiqueta);
  }
  await crearConRastro(
    {
      db: tx,
      tabla: dealActividades,
      nombreTabla: "deal_actividades",
      actorId: datos.actorId,
      etiqueta: datos.etiqueta,
    },
    {
      dealId: datos.deal.id,
      tipo: "nota",
      userId: datos.userIdDeNota === undefined ? datos.actorId : datos.userIdDeNota,
      nota:
        datos.nota(origenCodigo, datos.destino.codigo)
        + (!datos.notaExacta && fechaLimiteAjustada
          ? ` (La fecha límite de pago pasó de ${datos.deal.fechaLimitePago} a ${fechaLimiteAjustada}, el inicio de clases.)`
          : ""),
    },
  );

  return { origenCodigo, destinoCodigo: datos.destino.codigo, fechaLimiteAjustada };
}
