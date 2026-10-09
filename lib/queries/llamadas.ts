import { and, eq, isNotNull } from "drizzle-orm";
import { calls, deals, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { llamadaVisiblePara, type AlcanceDeals } from "@/lib/auth/alcance-deals";
import { vigente } from "@/lib/queries/vigente";

export const LLAMADAS_POR_PAGINA = 50;

/** Los órdenes de la lista de Calls (ticket o8-busqueda). El primero es el de por defecto. */
export const ORDENES_LLAMADAS = [
  { value: "llamada:desc", label: "Llamada: más reciente" },
  { value: "llamada:asc", label: "Llamada: más antigua" },
  { value: "creacion:desc", label: "Creación: más reciente" },
  { value: "creacion:asc", label: "Creación: más antigua" },
  { value: "nombre:asc", label: "Nombre: A → Z" },
  { value: "nombre:desc", label: "Nombre: Z → A" },
] as const;

export type OrdenLlamadas = (typeof ORDENES_LLAMADAS)[number]["value"];

export const ORDEN_LLAMADAS_POR_DEFECTO: OrdenLlamadas = "llamada:desc";

export type FiltroLlamadas = {
  closerUserId?: string | null;
  resultado?: (typeof calls.$inferSelect)["resultado"] | null;
  desde?: string | null;
  hasta?: string | null;
  /**
   * Los leads que casan con la búsqueda (`leadsQueCasan`): si es un `Set`, solo pasan las
   * llamadas cuyo deal tiene un lead ahí (las sin deal quedan fuera al buscar); `null` =
   * sin búsqueda, no filtra.
   */
  leadsCasan?: Set<string> | null;
  /** El orden de la lista; por defecto `llamada:desc` (el de siempre). */
  orden?: OrdenLlamadas;
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
  ownerUserId: string | null;
  closerUserId: string | null;
  closerNombre: string | null;
  closerEmail: string | null;
  notas: string | null;
}

export interface OpcionesLlamadas {
  closers: { id: string; nombre: string }[];
}

/** Llamadas vigentes con deal del programa, acotadas al alcance operativo. */
export async function llamadasDelPrograma(
  db: Db,
  programId: string,
  alcance: AlcanceDeals,
  filtros: FiltroLlamadas = {},
): Promise<FilaLlamadaPrograma[]> {
  const filas = await db
    .select({
      callId: calls.id,
      dealId: calls.dealId,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      leadId: deals.leadId,
      emailSuelta: calls.emailLead,
      resultado: calls.resultado,
      etapa: deals.etapa,
      pendiente: deals.pendiente,
      fechaAgenda: calls.fechaAgenda,
      fechaLlamada: calls.fechaLlamada,
      createdAt: calls.createdAt,
      linkCalendly: calls.linkCalendly,
      linkGrain: calls.linkGrain,
      ownerUserId: deals.ownerUserId,
      closerUserId: calls.closerUserId,
      closerNombre: users.nombre,
      closerEmail: users.email,
      notas: calls.notas,
    })
    .from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), vigente(deals)))
    .leftJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(users, eq(users.id, calls.closerUserId))
    .where(and(eq(calls.programId, programId), isNotNull(calls.dealId), vigente(calls)));

  const orden = filtros.orden ?? ORDEN_LLAMADAS_POR_DEFECTO;

  return filas
    .filter((f) => llamadaVisiblePara(alcance, f))
    .filter((f) => !filtros.closerUserId || f.closerUserId === filtros.closerUserId)
    .filter((f) => !filtros.resultado || f.resultado === filtros.resultado)
    .filter((f) => {
      const fecha = f.fechaAgenda ?? f.fechaLlamada;
      if (!fecha) return !filtros.desde && !filtros.hasta;
      const dia = diaDeCalendario(fecha);
      return (!filtros.desde || dia >= filtros.desde) && (!filtros.hasta || dia <= filtros.hasta);
    })
    // Búsqueda: solo las llamadas cuyo deal tiene un lead que casa (`leadsQueCasan`). Una
    // llamada sin deal (sin `leadId`) nunca casa mientras se busca. `null` = sin búsqueda.
    .filter((f) => filtros.leadsCasan == null || (f.leadId != null && filtros.leadsCasan.has(f.leadId)))
    .sort((a, b) => compararLlamadas(a, b, orden))
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
      ownerUserId: f.ownerUserId,
      closerUserId: f.closerUserId,
      closerNombre: f.closerNombre,
      closerEmail: f.closerEmail,
      notas: f.notas,
    }));
}

/** Lo mínimo que el comparador de orden necesita de una fila de llamada. */
interface FilaOrdenable {
  fechaAgenda: Date | null;
  fechaLlamada: Date | null;
  createdAt: Date;
  leadNombre: string | null;
  leadEmail: string | null;
  emailSuelta: string | null;
}

/**
 * El orden de la lista de Calls. El de por defecto (`llamada:desc`) es exactamente el de
 * siempre: por la fecha de la llamada (o la de agenda), de la más reciente a la más antigua.
 */
function compararLlamadas(a: FilaOrdenable, b: FilaOrdenable, orden: OrdenLlamadas): number {
  const fechaLlamada = (f: FilaOrdenable) => (f.fechaAgenda ?? f.fechaLlamada)?.getTime() ?? 0;
  const nombre = (f: FilaOrdenable) => (f.leadNombre ?? f.leadEmail ?? f.emailSuelta ?? "").toLocaleLowerCase("es");
  switch (orden) {
    case "llamada:desc":
      return fechaLlamada(b) - fechaLlamada(a);
    case "llamada:asc":
      return fechaLlamada(a) - fechaLlamada(b);
    case "creacion:desc":
      return b.createdAt.getTime() - a.createdAt.getTime();
    case "creacion:asc":
      return a.createdAt.getTime() - b.createdAt.getTime();
    case "nombre:asc":
      return nombre(a).localeCompare(nombre(b), "es");
    case "nombre:desc":
      return nombre(b).localeCompare(nombre(a), "es");
  }
}

export async function visibilidadDeLlamada(
  db: Db,
  programId: string,
  callId: string,
): Promise<{ ownerUserId: string | null; closerUserId: string | null; dealId: string | null } | null> {
  const [fila] = await db
    .select({
      ownerUserId: deals.ownerUserId,
      closerUserId: calls.closerUserId,
      dealId: calls.dealId,
    })
    .from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), vigente(deals)))
    .where(and(eq(calls.programId, programId), eq(calls.id, callId), vigente(calls)))
    .limit(1);

  return fila ?? null;
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
