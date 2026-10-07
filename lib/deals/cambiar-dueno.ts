import { and, eq, isNotNull, sql } from "drizzle-orm";
import { deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { vigente } from "@/lib/queries/vigente";

/**
 * El contrato único del dueño y su señal de novedad (ticket 201). Históricos no llaman
 * este módulo y conservan `owner_novedad_en = null`.
 */
export function camposDeDueno(
  ownerUserId: string | null,
  opciones: { esNovedad: boolean },
) {
  return {
    ownerUserId,
    ownerNovedadEn: ownerUserId !== null && opciones.esNovedad ? sql`clock_timestamp()` : null,
  };
}

/** Cambia dueño + novedad en la misma escritura con rastro. `false` si no cambió. */
export async function cambiarDuenoDeal(
  db: Db,
  entrada: {
    dealId: string;
    ownerActual: string | null;
    ownerNuevo: string | null;
    actorId: string | null;
    etiqueta: string;
    /** El creador manual ya está mirando el Deal y nace visto. */
    esNovedad?: boolean;
    cambiosAdicionales?: Record<string, unknown>;
  },
): Promise<boolean> {
  if (entrada.ownerActual === entrada.ownerNuevo) return false;
  return editarConRastro(
    { db, tabla: deals, nombreTabla: "deals", actorId: entrada.actorId, etiqueta: entrada.etiqueta },
    entrada.dealId,
    {
      ...camposDeDueno(entrada.ownerNuevo, { esNovedad: entrada.esNovedad ?? true }),
      ...entrada.cambiosAdicionales,
    },
  );
}

/**
 * Abrir la ficha consume la novedad solo para su dueño real y dentro del programa.
 * Devuelve `false` para otro usuario, otro programa, un Deal visto o anulado.
 */
export async function marcarDealVisto(
  db: Db,
  entrada: { dealId: string; programId: string; userId: string; etiqueta: string },
): Promise<boolean> {
  const [fila] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.id, entrada.dealId),
        eq(deals.programId, entrada.programId),
        eq(deals.ownerUserId, entrada.userId),
        isNotNull(deals.ownerNovedadEn),
        vigente(deals),
      ),
    );
  if (!fila) return false;
  return editarConRastro(
    { db, tabla: deals, nombreTabla: "deals", actorId: entrada.userId, etiqueta: entrada.etiqueta },
    entrada.dealId,
    { ownerNovedadEn: null },
  );
}
