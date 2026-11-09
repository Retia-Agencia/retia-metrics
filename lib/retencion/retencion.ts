import { and, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { entregasWebhook, notificacionesCalendly, sobresCrudos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Retencion de sobres crudos, sus entregas y las notificaciones de Calendly (ADR 0127,
 * ticket 402). Plazos decididos por Mani el 9-nov-2026; cambiarlos es cambiar una constante.
 *
 * Regla dura (ADR 0058): un sobre con error que nadie reproceso NUNCA se purga; es un envio
 * con firma buena que no entro. Solo se retira el CRUDO (y su rastro de entrega): lo que el
 * sobre produjo vive en `submissions`, `leads` y `calls` y no se toca.
 */
export const DIAS_SOBRE_PROCESADO = 180;
export const DIAS_NOTIFICACION = 90;
export const TAMANO_DE_LOTE = 500;

const DIA_MS = 24 * 60 * 60 * 1000;

export interface ResumenRetencion {
  sobres: number;
  entregas: number;
  notificaciones: number;
}

/**
 * Un sobre es purgable si: se proceso bien (`error` nulo) y se recibio antes del corte, o
 * fallo y YA se reproceso (`reprocesado_en` no nulo) antes del corte. Con error y sin
 * reprocesar no entra jamas.
 */
function purgable(corte: Date) {
  return or(
    and(isNull(sobresCrudos.error), lt(sobresCrudos.recibidoEn, corte)),
    and(isNotNull(sobresCrudos.error), isNotNull(sobresCrudos.reprocesadoEn), lt(sobresCrudos.reprocesadoEn, corte)),
  );
}

/**
 * Borra, por lotes, los sobres vencidos junto con las entregas que los apuntan (la FK es
 * RESTRICT: la entrega va primero). Cada lote es una transaccion, asi que un corte a medias
 * nunca deja una entrega sin su sobre ni al reves. Idempotente: una segunda corrida no
 * encuentra nada.
 */
export async function purgarSobresVencidos(
  db: Db,
  ahora: Date = new Date(),
): Promise<{ sobres: number; entregas: number }> {
  const corte = new Date(ahora.getTime() - DIAS_SOBRE_PROCESADO * DIA_MS);
  let sobres = 0;
  let entregas = 0;
  for (;;) {
    const lote = await db
      .select({ id: sobresCrudos.id })
      .from(sobresCrudos)
      .where(purgable(corte))
      .limit(TAMANO_DE_LOTE);
    if (lote.length === 0) break;
    const ids = lote.map((f) => f.id);
    await db.transaction(async (tx) => {
      const e = await tx.delete(entregasWebhook).where(inArray(entregasWebhook.sobreId, ids)).returning();
      // Se repite el predicado: entre el SELECT y el DELETE un sobre pudo cambiar de estado.
      const s = await tx
        .delete(sobresCrudos)
        .where(and(inArray(sobresCrudos.id, ids), purgable(corte)))
        .returning();
      entregas += e.length;
      sobres += s.length;
    });
    if (lote.length < TAMANO_DE_LOTE) break;
  }
  return { sobres, entregas };
}

/** Borra, por lotes, las notificaciones de mas de 90 dias, leidas o no. */
export async function purgarNotificacionesVencidas(db: Db, ahora: Date = new Date()): Promise<number> {
  const corte = new Date(ahora.getTime() - DIAS_NOTIFICACION * DIA_MS);
  let total = 0;
  for (;;) {
    const lote = await db
      .select({ id: notificacionesCalendly.id })
      .from(notificacionesCalendly)
      .where(lt(notificacionesCalendly.createdAt, corte))
      .limit(TAMANO_DE_LOTE);
    if (lote.length === 0) break;
    const borradas = await db
      .delete(notificacionesCalendly)
      .where(
        and(
          inArray(notificacionesCalendly.id, lote.map((f) => f.id)),
          lt(notificacionesCalendly.createdAt, corte),
        ),
      )
      .returning();
    total += borradas.length;
    if (lote.length < TAMANO_DE_LOTE) break;
  }
  return total;
}

export async function aplicarRetencion(db: Db, ahora: Date = new Date()): Promise<ResumenRetencion> {
  const { sobres, entregas } = await purgarSobresVencidos(db, ahora);
  const notificaciones = await purgarNotificacionesVencidas(db, ahora);
  return { sobres, entregas, notificaciones };
}
