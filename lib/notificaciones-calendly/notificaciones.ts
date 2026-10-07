import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  calls,
  deals,
  leads,
  notificacionesCalendly,
  programs,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

export type TipoNotificacionCalendly = typeof notificacionesCalendly.$inferSelect.tipo;

export interface NovedadCalendly {
  id: string;
  tipo: TipoNotificacionCalendly;
  dealId: string;
  callId: string;
  nombreLead: string | null;
  emailLead: string;
  createdAt: Date;
  leidaEn: Date | null;
}

/**
 * Inserta una novedad solo si la llamada y su Deal vigentes son del programa y el Deal
 * tiene dueño. El destinatario sale de la base, nunca del payload de Calendly.
 */
export async function registrarNovedadCalendly(
  db: Db,
  entrada: {
    programId: string;
    dealId: string;
    callId: string;
    tipo: TipoNotificacionCalendly;
    claveEvento: string;
  },
): Promise<boolean> {
  const [destino] = await db
    .select({ ownerUserId: deals.ownerUserId })
    .from(deals)
    .innerJoin(
      calls,
      and(
        eq(calls.id, entrada.callId),
        eq(calls.dealId, deals.id),
        eq(calls.programId, deals.programId),
        vigente(calls),
      ),
    )
    .where(
      and(
        eq(deals.id, entrada.dealId),
        eq(deals.programId, entrada.programId),
        vigente(deals),
      ),
    );
  if (!destino?.ownerUserId) return false;

  const filas = await db
    .insert(notificacionesCalendly)
    .values({ ...entrada, userId: destino.ownerUserId })
    .onConflictDoNothing()
    .returning();
  return filas.length > 0;
}

/** No leídas primero y leídas debajo; ambas listas están acotadas y son de UN programa. */
export async function novedadesCalendlyDeUsuario(
  db: Db,
  entrada: { userId: string; programId: string; porGrupo?: number },
): Promise<{ noLeidas: NovedadCalendly[]; leidas: NovedadCalendly[] }> {
  const porGrupo = Math.min(Math.max(entrada.porGrupo ?? 20, 1), 50);
  const base = (leidas: boolean) =>
    db
      .select({
        id: notificacionesCalendly.id,
        tipo: notificacionesCalendly.tipo,
        dealId: notificacionesCalendly.dealId,
        callId: notificacionesCalendly.callId,
        nombreLead: leads.nombre,
        emailLead: leads.emailNormalizado,
        createdAt: notificacionesCalendly.createdAt,
        leidaEn: notificacionesCalendly.leidaEn,
      })
      .from(notificacionesCalendly)
      .innerJoin(deals, eq(deals.id, notificacionesCalendly.dealId))
      .innerJoin(leads, eq(leads.id, deals.leadId))
      .where(
        and(
          eq(notificacionesCalendly.userId, entrada.userId),
          eq(notificacionesCalendly.programId, entrada.programId),
          leidas ? isNotNull(notificacionesCalendly.leidaEn) : isNull(notificacionesCalendly.leidaEn),
        ),
      )
      .orderBy(desc(notificacionesCalendly.createdAt))
      .limit(porGrupo);
  const [noLeidas, leidas] = await Promise.all([base(false), base(true)]);
  return { noLeidas, leidas };
}

/** Marca una fila propia y del programa; una id forjada de otro usuario no cambia nada. */
export async function marcarNovedadCalendlyVista(
  db: Db,
  entrada: { notificationId: string; userId: string; programId?: string },
): Promise<boolean> {
  const filas = await db
    .update(notificacionesCalendly)
    .set({ leidaEn: new Date() })
    .where(
      and(
        eq(notificacionesCalendly.id, entrada.notificationId),
        eq(notificacionesCalendly.userId, entrada.userId),
        entrada.programId ? eq(notificacionesCalendly.programId, entrada.programId) : undefined,
        isNull(notificacionesCalendly.leidaEn),
      ),
    )
    .returning();
  return filas.length > 0;
}

/** Resuelve el destino desde la fila propia, la marca vista y devuelve una ruta opaca. */
export async function abrirNovedadCalendly(
  db: Db,
  entrada: { notificationId: string; userId: string },
): Promise<string | null> {
  const [fila] = await db
    .select({ dealId: notificacionesCalendly.dealId, programId: notificacionesCalendly.programId, slug: programs.slug })
    .from(notificacionesCalendly)
    .innerJoin(programs, eq(programs.id, notificacionesCalendly.programId))
    .where(
      and(
        eq(notificacionesCalendly.id, entrada.notificationId),
        eq(notificacionesCalendly.userId, entrada.userId),
      ),
    );
  if (!fila) return null;
  await marcarNovedadCalendlyVista(db, { ...entrada, programId: fila.programId });
  return `/p/${fila.slug}/deals/${fila.dealId}`;
}
