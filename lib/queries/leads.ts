import { and, between, count, desc, eq, inArray, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { calificacionEnvioEnum, deals, leadContactos, leads, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

/**
 * La tab Leads (ticket 072, ADR 0050): la base del programa, sobre todo lo que existe y todavía
 * no es una oportunidad (el 98% de los leads no tiene deal). El programa es frontera (ADR 0043):
 * la consulta recibe UNO y no admite "todos".
 *
 * Los filtros son hechos, nada se adivina:
 * - **deal:** con o sin deal vigente (cualquier etapa; un deal anulado no cuenta, ADR 0038).
 * - **estado:** la calificación del lead, o "sin estado" (llegó vacía o desconocida, ADR 0061).
 * - **abandonó el formulario:** todos sus envíos son parciales (ADR 0061 punto 6).
 * - **posible duplicado:** tiene un correo que entró por teléfono y nadie confirmó (ADR 0035).
 * - **fechas:** la última aplicación, en días de Bogotá.
 *
 * No hay búsqueda por texto en esta consulta a propósito: los filtros viajan en la URL y un
 * correo en la URL está prohibido (AGENTS.md). Para buscar a alguien está Personas.
 */

export type Calificacion = (typeof calificacionEnvioEnum.enumValues)[number];
export const ESTADOS_DE_LEAD = calificacionEnvioEnum.enumValues;

export interface FiltroLeads {
  deal?: "con" | "sin" | null;
  estado?: Calificacion | "sin_estado" | null;
  abandono?: boolean;
  duplicado?: boolean;
  /** Días `YYYY-MM-DD` de Bogotá, inclusive, sobre la última aplicación. */
  desde?: string | null;
  hasta?: string | null;
  /** Desde 0. */
  pagina?: number;
}

export const LEADS_POR_PAGINA = 100;

export interface FilaLead {
  id: string;
  nombre: string | null;
  email: string;
  calificacion: Calificacion | null;
  leadQuality: string | null;
  leadValue: string | null;
  fechaUltimaAplicacion: Date | null;
  numAplicaciones: number;
  tieneDeal: boolean;
  soloParciales: boolean;
  correosSinConfirmar: number;
}

/** Los leads con al menos un deal vigente. */
function conDeal(db: Db) {
  return db.select({ leadId: deals.leadId }).from(deals).where(vigente(deals));
}

/** Los leads cuyos envíos son TODOS parciales. */
function soloParciales(db: Db) {
  return db
    .select({ leadId: submissions.leadId })
    .from(submissions)
    .groupBy(submissions.leadId)
    .having(sql`bool_and(${submissions.esParcial})`);
}

/** Los leads con un correo que entró por teléfono y sigue sin confirmar. */
function conCorreoSinConfirmar(db: Db) {
  return db
    .select({ leadId: leadContactos.leadId })
    .from(leadContactos)
    .where(and(eq(leadContactos.tipo, "correo"), eq(leadContactos.confirmado, false)));
}

export async function leadsDelPrograma(
  db: Db,
  programId: string,
  filtro: FiltroLeads = {},
): Promise<{ total: number; filas: FilaLead[] }> {
  const condiciones: (SQL | undefined)[] = [eq(leads.programId, programId)];
  if (filtro.deal === "con") condiciones.push(inArray(leads.id, conDeal(db)));
  if (filtro.deal === "sin") condiciones.push(notInArray(leads.id, conDeal(db)));
  if (filtro.estado === "sin_estado") condiciones.push(isNull(leads.calificacion));
  else if (filtro.estado) condiciones.push(eq(leads.calificacion, filtro.estado));
  if (filtro.abandono) condiciones.push(inArray(leads.id, soloParciales(db)));
  if (filtro.duplicado) condiciones.push(inArray(leads.id, conCorreoSinConfirmar(db)));
  if (filtro.desde && filtro.hasta) {
    condiciones.push(
      between(sql<string>`(${leads.fechaUltimaAplicacion} AT TIME ZONE 'America/Bogota')::date`, filtro.desde, filtro.hasta),
    );
  }
  const donde = and(...condiciones);

  const [{ total }] = await db.select({ total: count() }).from(leads).where(donde);
  const pagina = Math.max(0, filtro.pagina ?? 0);
  const base = await db
    .select({
      id: leads.id,
      nombre: leads.nombre,
      email: leads.emailNormalizado,
      calificacion: leads.calificacion,
      leadQuality: leads.leadQuality,
      leadValue: leads.leadValue,
      fechaUltimaAplicacion: leads.fechaUltimaAplicacion,
      numAplicaciones: leads.numAplicaciones,
    })
    .from(leads)
    .where(donde)
    .orderBy(sql`${leads.fechaUltimaAplicacion} desc nulls last`, desc(leads.createdAt))
    .limit(LEADS_POR_PAGINA)
    .offset(pagina * LEADS_POR_PAGINA);
  if (base.length === 0) return { total, filas: [] };

  // Las marcas de la página, en tres lecturas sobre SUS ids (no subconsultas correlacionadas).
  const ids = base.map((b) => b.id);
  const [conDeals, parciales, marcas] = await Promise.all([
    db.select({ leadId: deals.leadId }).from(deals).where(and(inArray(deals.leadId, ids), vigente(deals))),
    db
      .select({ leadId: submissions.leadId, todosParciales: sql<boolean>`bool_and(${submissions.esParcial})` })
      .from(submissions)
      .where(inArray(submissions.leadId, ids))
      .groupBy(submissions.leadId),
    db
      .select({ leadId: leadContactos.leadId, n: count() })
      .from(leadContactos)
      .where(and(inArray(leadContactos.leadId, ids), eq(leadContactos.tipo, "correo"), eq(leadContactos.confirmado, false)))
      .groupBy(leadContactos.leadId),
  ]);
  const tienenDeal = new Set(conDeals.map((d) => d.leadId));
  const soloPar = new Set(parciales.filter((p) => p.todosParciales).map((p) => p.leadId));
  const sinConfirmar = new Map(marcas.map((m) => [m.leadId, m.n]));

  return {
    total,
    filas: base.map((b) => ({
      ...b,
      tieneDeal: tienenDeal.has(b.id),
      soloParciales: soloPar.has(b.id),
      correosSinConfirmar: sinConfirmar.get(b.id) ?? 0,
    })),
  };
}

/** Un correo que entró por teléfono y nadie confirmó: la lista de "posibles duplicados" (072). */
export interface PosibleDuplicado {
  contactoId: string;
  leadId: string;
  nombreLead: string | null;
  correoPrincipal: string;
  correoSinConfirmar: string;
  creadoEn: Date;
}

export async function posiblesDuplicadosDelPrograma(db: Db, programId: string): Promise<PosibleDuplicado[]> {
  return db
    .select({
      contactoId: leadContactos.id,
      leadId: leads.id,
      nombreLead: leads.nombre,
      correoPrincipal: leads.emailNormalizado,
      correoSinConfirmar: leadContactos.valor,
      creadoEn: leadContactos.createdAt,
    })
    .from(leadContactos)
    .innerJoin(leads, eq(leads.id, leadContactos.leadId))
    .where(
      and(
        eq(leadContactos.programId, programId),
        eq(leads.programId, programId),
        eq(leadContactos.tipo, "correo"),
        eq(leadContactos.confirmado, false),
      ),
    )
    .orderBy(desc(leadContactos.createdAt));
}
