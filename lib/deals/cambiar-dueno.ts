import { and, eq, isNotNull, sql } from "drizzle-orm";
import { deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { vigente } from "@/lib/queries/vigente";
import { trabajaLeads, type Rol } from "@/lib/auth/roles";

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

/**
 * "Lo estoy trabajando" (E1, tickets 228 y 229) es el gesto con el que un closer toma un lead
 * que casi siempre llega sin dueño: como Anotar y registrar un contacto, el deal queda a su
 * nombre antes de mover. Lo llaman `moverConHecho` (la acción real) y `revisarMovimiento`
 * (el ensayo del diálogo), para que la vista previa no diga "no tiene dueño" cuando la
 * acción sí lo va a tomar. No hace nada fuera de E1, con dueño, o si el actor no trabaja leads.
 */
export async function reclamarAlMoverPorE1(
  db: Db,
  entrada: {
    idFlecha: string | null | undefined;
    dealId: string;
    ownerUserId: string | null;
    actor: { userId: string; rol: Rol };
    etiqueta: string;
  },
): Promise<void> {
  if (entrada.idFlecha !== "E1" || entrada.ownerUserId != null || !trabajaLeads(entrada.actor.rol)) return;
  await cambiarDuenoDeal(db, {
    dealId: entrada.dealId,
    ownerActual: null,
    ownerNuevo: entrada.actor.userId,
    actorId: entrada.actor.userId,
    etiqueta: entrada.etiqueta,
  });
}
