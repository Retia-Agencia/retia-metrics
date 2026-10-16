import { and, eq, isNotNull } from "drizzle-orm";
import { calls, cohorts, deals, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { llamadaVisiblePara, type AlcanceDeals } from "@/lib/auth/alcance-deals";
import { vigente } from "@/lib/queries/vigente";
import { z } from "zod";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";

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

export const FECHAS_LLAMADAS = ["llamada", "agenda"] as const;
export type FechaLlamadas = (typeof FECHAS_LLAMADAS)[number];

export const ORDEN_LLAMADAS_POR_DEFECTO: OrdenLlamadas = "llamada:desc";

export const RESULTADOS = [
  ["agendada", "Agendada"],
  ["show", "Show"],
  ["no_show", "No show"],
  ["cancelada", "Cancelada"],
  ["reagendada", "Reagendada"],
  ["compromiso_pago", "Compromiso de pago"],
  ["cerrada", "Cerrada"],
  ["perdida", "Perdida"],
] as const;

export type FiltroLlamadas = {
  closerUserId?: string | null;
  resultado?: (typeof calls.$inferSelect)["resultado"] | null;
  desde?: string | null;
  hasta?: string | null;
  fecha?: FechaLlamadas;
  cohortId?: string | null;
  /**
   * Los leads que casan con la búsqueda (`leadsQueCasan`): si es un `Set`, solo pasan las
   * llamadas cuyo deal tiene un lead ahí (las sin deal quedan fuera al buscar); `null` =
   * sin búsqueda, no filtra.
   */
  leadsCasan?: Set<string> | null;
  /** El orden de la lista; por defecto `llamada:desc` (el de siempre). */
  orden?: OrdenLlamadas;
};

type ParametrosDeLlamadas =
  | Record<string, string | string[] | undefined>
  | Pick<URLSearchParams, "get">;

function valorDeParametro(parametros: ParametrosDeLlamadas, nombre: string): string | undefined {
  const conGet = parametros as Pick<URLSearchParams, "get">;
  if (typeof conGet.get === "function") {
    return conGet.get(nombre) ?? undefined;
  }
  const valor = (parametros as Record<string, string | string[] | undefined>)[nombre];
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Una sola interpretación de los filtros de Calls guardados en la URL. */
export async function filtroDeLlamadasDesdeUrl(
  db: Db,
  programId: string,
  alcance: AlcanceDeals,
  parametros: ParametrosDeLlamadas,
): Promise<FiltroLlamadas & { orden: OrdenLlamadas; fecha: FechaLlamadas }> {
  const resultado = valorDeParametro(parametros, "resultado");
  const ordenValues = ORDENES_LLAMADAS.map((opcion) => opcion.value) as [
    OrdenLlamadas,
    ...OrdenLlamadas[],
  ];
  const orden = z
    .enum(ordenValues)
    .catch(ORDEN_LLAMADAS_POR_DEFECTO)
    .parse(valorDeParametro(parametros, "orden"));
  const fecha = z
    .enum(FECHAS_LLAMADAS)
    .catch("llamada")
    .parse(valorDeParametro(parametros, "fecha"));
  const leadsCasan = await leadsQueCasan(db, programId, valorDeParametro(parametros, "q") ?? "");

  return {
    closerUserId: alcance.tipo === "todos" ? valorDeParametro(parametros, "closer") || null : null,
    resultado: RESULTADOS.some(([value]) => value === resultado)
      ? (resultado as FiltroLlamadas["resultado"])
      : null,
    desde: valorDeParametro(parametros, "desde") || null,
    hasta: valorDeParametro(parametros, "hasta") || null,
    fecha,
    cohortId: valorDeParametro(parametros, "cohorte") || null,
    leadsCasan,
    orden,
  };
}

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
  createdAt: Date;
  cohorteCodigo: string | null;
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
      cohortId: deals.cohortId,
      cohorteCodigo: cohorts.codigo,
    })
    .from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), vigente(deals)))
    .leftJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(cohorts, eq(cohorts.id, deals.cohortId))
    .leftJoin(users, eq(users.id, calls.closerUserId))
    .where(and(eq(calls.programId, programId), isNotNull(calls.dealId), vigente(calls)));

  const orden = filtros.orden ?? ORDEN_LLAMADAS_POR_DEFECTO;

  return filas
    .filter((f) => llamadaVisiblePara(alcance, f))
    .filter((f) => !filtros.closerUserId || f.closerUserId === filtros.closerUserId)
    .filter((f) => !filtros.resultado || f.resultado === filtros.resultado)
    .filter((f) => !filtros.cohortId || f.cohortId === filtros.cohortId)
    .filter((f) => {
      // Para traslados desde Sheets, `createdAt` es el traslado y no la agenda original.
      // Es una limitación aceptada del filtro "Agendada" (ticket 277).
      const fecha = filtros.fecha === "agenda" ? f.createdAt : fechaDeLaLlamada(f);
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
      createdAt: f.createdAt,
      cohorteCodigo: f.cohorteCodigo,
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

/** El instante operativo de la llamada: el ocurrido y, mientras no ocurra, el agendado. */
export function fechaDeLaLlamada(
  fila: Pick<FilaOrdenable, "fechaLlamada" | "fechaAgenda">,
): Date | null {
  return fila.fechaLlamada ?? fila.fechaAgenda;
}

/**
 * El orden de la lista de Calls. El de por defecto (`llamada:desc`) usa la fecha ocurrida
 * y, mientras no haya ocurrido, la fecha de agenda.
 */
function compararLlamadas(a: FilaOrdenable, b: FilaOrdenable, orden: OrdenLlamadas): number {
  const instanteLlamada = (f: FilaOrdenable) => fechaDeLaLlamada(f)?.getTime() ?? 0;
  const nombre = (f: FilaOrdenable) => (f.leadNombre ?? f.leadEmail ?? f.emailSuelta ?? "").toLocaleLowerCase("es");
  switch (orden) {
    case "llamada:desc":
      return instanteLlamada(b) - instanteLlamada(a);
    case "llamada:asc":
      return instanteLlamada(a) - instanteLlamada(b);
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
