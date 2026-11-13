import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { calls, cohorts, deals, leads, users } from "@/lib/db/schema";
import type { AlcanceDeals } from "@/lib/auth/alcance-deals";
import { dealVisiblePara } from "@/lib/auth/alcance-deals";
import type { Db } from "@/lib/db/tipos";
import { cambiosDeDuenoDeDeals, type CambioDeDueno } from "@/lib/queries/cambios-de-dueno";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";
import { llamadaSinDealAnulado } from "@/lib/queries/llamada-sin-deal-anulado";
import { ultimaActividadPorDeal } from "@/lib/queries/ultima-actividad";
import { vigente } from "@/lib/queries/vigente";

export interface PaginaDeBusqueda {
  limite: number;
  offset: number;
}

export interface PersonaEncontrada {
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  deals: Array<{
    id: string;
    etapa: (typeof deals.etapa.enumValues)[number];
    pendiente: (typeof deals.pendiente.enumValues)[number] | null;
    dueno: { id_del_usuario: string; nombre: string } | null;
    cohorte: { id_de_la_cohorte: string; codigo: string } | null;
    ultima_actividad: Date;
    ultimo_cambio_de_dueno: CambioDeDueno | null;
    llamadas: Array<{ id_de_la_llamada: string; resultado: string; fecha_de_agenda: Date | null; closer: string | null }>;
  }>;
}

/** Búsqueda de personas dentro de una sola frontera de programa. */
export async function buscarEnPrograma(
  db: Db,
  programId: string,
  texto: string,
  alcance: AlcanceDeals,
  pagina: PaginaDeBusqueda,
): Promise<{ total: number; filas: PersonaEncontrada[] }> {
  const coincidencias = await leadsQueCasan(db, programId, texto);
  const ids = [...(coincidencias ?? new Set<string>())];
  if (ids.length === 0) return { total: 0, filas: [] };
  const donde = and(eq(leads.programId, programId), inArray(leads.id, ids));
  const [[conteo], personas] = await Promise.all([
    db.select({ total: count() }).from(leads).where(donde),
    db.select({ id: leads.id, nombre: leads.nombre, email: leads.emailNormalizado, telefono: leads.telefono })
      .from(leads).where(donde).orderBy(asc(leads.nombre), asc(leads.id)).limit(pagina.limite).offset(pagina.offset),
  ]);
  const personaIds = personas.map((persona) => persona.id);
  if (personaIds.length === 0) return { total: Number(conteo?.total ?? 0), filas: [] };
  const filasDeDeals = await db.select({
    id: deals.id,
    leadId: deals.leadId,
    etapa: deals.etapa,
    pendiente: deals.pendiente,
    ownerUserId: deals.ownerUserId,
    ownerNombre: users.nombre,
    cohortId: deals.cohortId,
    cohorteCodigo: cohorts.codigo,
    createdAt: deals.createdAt,
  }).from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .leftJoin(cohorts, and(eq(cohorts.id, deals.cohortId), eq(cohorts.programId, programId)))
    .where(and(eq(deals.programId, programId), inArray(deals.leadId, personaIds), vigente(deals)))
    .orderBy(desc(deals.createdAt));
  const dealsVisibles = filasDeDeals.filter((deal) => dealVisiblePara(alcance, deal.ownerUserId));
  const dealIds = dealsVisibles.map((deal) => deal.id);
  const [actividades, cambios, llamadas] = await Promise.all([
    ultimaActividadPorDeal(db, dealIds, dealsVisibles.map((deal) => ({ dealId: deal.id, createdAt: deal.createdAt })), new Date()),
    cambiosDeDuenoDeDeals(db, dealIds),
    dealIds.length === 0 ? [] : db.select({
      id: calls.id,
      dealId: calls.dealId,
      resultado: calls.resultado,
      fechaAgenda: calls.fechaAgenda,
      closer: users.nombre,
    }).from(calls).leftJoin(users, eq(users.id, calls.closerUserId))
      .where(and(inArray(calls.dealId, dealIds), vigente(calls), llamadaSinDealAnulado(db)))
      .orderBy(desc(calls.createdAt)),
  ]);
  const llamadasPorDeal = new Map<string, typeof llamadas>();
  for (const llamada of llamadas) {
    if (!llamada.dealId) continue;
    const suyas = llamadasPorDeal.get(llamada.dealId) ?? [];
    if (suyas.length < 3) suyas.push(llamada);
    llamadasPorDeal.set(llamada.dealId, suyas);
  }
  return {
    total: Number(conteo?.total ?? 0),
    filas: personas.map((persona) => ({
      ...persona,
      deals: dealsVisibles.filter((deal) => deal.leadId === persona.id).map((deal) => ({
        id: deal.id,
        etapa: deal.etapa,
        pendiente: deal.pendiente,
        dueno: deal.ownerUserId ? { id_del_usuario: deal.ownerUserId, nombre: deal.ownerNombre ?? "Sin nombre" } : null,
        cohorte: deal.cohortId && deal.cohorteCodigo ? { id_de_la_cohorte: deal.cohortId, codigo: deal.cohorteCodigo } : null,
        ultima_actividad: actividades.get(deal.id) ?? deal.createdAt,
        ultimo_cambio_de_dueno: cambios.get(deal.id) ?? null,
        llamadas: (llamadasPorDeal.get(deal.id) ?? []).map((llamada) => ({
          id_de_la_llamada: llamada.id,
          resultado: llamada.resultado,
          fecha_de_agenda: llamada.fechaAgenda,
          closer: llamada.closer,
        })),
      })),
    })),
  };
}
