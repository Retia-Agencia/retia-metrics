import { and, eq } from "drizzle-orm";
import { calls, deals, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { esSueltaPorAsignar } from "@/lib/calendly/suelta";
import { vigente } from "@/lib/queries/vigente";

export type FiltroLlamadas = {
  closerUserId?: string | null;
  resultado?: (typeof calls.$inferSelect)["resultado"] | null;
  desde?: string | null;
  hasta?: string | null;
};

export interface FilaLlamadaPrograma {
  callId: string;
  dealId: string | null;
  leadNombre: string | null;
  leadEmail: string | null;
  resultado: (typeof calls.$inferSelect)["resultado"];
  etapa: EtapaDeal | null;
  pendiente: PendienteDeal | null;
  fechaAgenda: Date | null;
  fechaLlamada: Date | null;
  linkCalendly: string | null;
  linkGrain: string | null;
  closerUserId: string | null;
  closerNombre: string | null;
  closerEmail: string | null;
  notas: string | null;
  /** Suelta de Calendly que un closer cuelga a mano (`esSueltaPorAsignar`). */
  porAsignar: boolean;
}

export interface OpcionesLlamadas {
  closers: { id: string; nombre: string }[];
}

/** Todas las llamadas vigentes de un programa, incluidas las sueltas. */
export async function llamadasDelPrograma(
  db: Db,
  programId: string,
  filtros: FiltroLlamadas = {},
): Promise<FilaLlamadaPrograma[]> {
  const filas = await db
    .select({
      callId: calls.id,
      dealId: calls.dealId,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      emailSuelta: calls.emailLead,
      resultado: calls.resultado,
      etapa: deals.etapa,
      pendiente: deals.pendiente,
      fechaAgenda: calls.fechaAgenda,
      fechaLlamada: calls.fechaLlamada,
      linkCalendly: calls.linkCalendly,
      linkGrain: calls.linkGrain,
      closerUserId: calls.closerUserId,
      closerNombre: users.nombre,
      closerEmail: users.email,
      notas: calls.notas,
      origen: calls.origen,
    })
    .from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), vigente(deals)))
    .leftJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(users, eq(users.id, calls.closerUserId))
    .where(and(eq(calls.programId, programId), vigente(calls)));

  return filas
    .filter((f) => !filtros.closerUserId || f.closerUserId === filtros.closerUserId)
    .filter((f) => !filtros.resultado || f.resultado === filtros.resultado)
    .filter((f) => {
      const fecha = f.fechaAgenda ?? f.fechaLlamada;
      if (!fecha) return !filtros.desde && !filtros.hasta;
      const dia = diaDeCalendario(fecha);
      return (!filtros.desde || dia >= filtros.desde) && (!filtros.hasta || dia <= filtros.hasta);
    })
    .map((f) => ({
      callId: f.callId,
      dealId: f.dealId,
      leadNombre: f.leadNombre,
      leadEmail: f.leadEmail ?? f.emailSuelta,
      resultado: f.resultado,
      etapa: f.etapa,
      pendiente: f.pendiente,
      fechaAgenda: f.fechaAgenda,
      fechaLlamada: f.fechaLlamada,
      linkCalendly: f.linkCalendly,
      linkGrain: f.linkGrain,
      closerUserId: f.closerUserId,
      closerNombre: f.closerNombre,
      closerEmail: f.closerEmail,
      notas: f.notas,
      porAsignar: esSueltaPorAsignar(f),
    }))
    .sort(
      (a, b) =>
        ((b.fechaAgenda ?? b.fechaLlamada)?.getTime() ?? 0) -
        ((a.fechaAgenda ?? a.fechaLlamada)?.getTime() ?? 0),
    );
}

export async function opcionesDeLlamadas(db: Db, programId: string): Promise<OpcionesLlamadas> {
  const filas = await db
    .select({ id: users.id, nombre: users.nombre, email: users.email })
    .from(users)
    .innerJoin(calls, eq(calls.closerUserId, users.id))
    .where(and(eq(calls.programId, programId), vigente(calls)));
  const unicas = new Map(filas.map((f) => [f.id, f.nombre ?? f.email]));
  return { closers: [...unicas].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")) };
}
