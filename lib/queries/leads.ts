import { and, asc, between, count, desc, eq, ilike, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { deals, leadContactos, leads, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { vigente } from "@/lib/queries/vigente";
import type { Rango } from "@/lib/queries/dashboard";

/**
 * La tab Leads (ticket 072, ADR 0050): la base del programa, sobre todo lo que existe y todavía
 * no es una oportunidad (el 98% de los leads no tiene deal). El programa es frontera (ADR 0043):
 * la consulta recibe UNO y no admite "todos".
 *
 * Los filtros son hechos, nada se adivina:
 * - **deal:** con o sin deal vigente (cualquier etapa; un deal anulado no cuenta, ADR 0038).
 * - **calidad:** el `lead_quality` que mandó el formulario (High, Mid, Low), o "sin calidad".
 *   Es lo que decide la etapa de entrada desde el ADR 0069; la variable `estado` ya no filtra.
 * - **abandonó el formulario:** todos sus envíos son parciales (ADR 0061 punto 6).
 * - **posible duplicado:** tiene un correo que entró por teléfono y nadie confirmó (ADR 0035).
 * - **fecha (141):** la de creación o la del último envío, en días de Bogotá, dentro del periodo A
 *   del selector. Creado es la primera aplicación; un lead dado de alta a mano (sin formulario)
 *   no tiene, y usa su alta. No es el ancla del dashboard (`fechaAnclaLead`), que solo cuenta
 *   los del formulario: aquí la pregunta es "¿cuándo entró a la base?".
 *
 * La búsqueda por texto vive en `buscarLeads`: nunca viaja en la URL porque puede contener
 * datos personales (AGENTS.md).
 */

export interface FiltroLeads {
  deal?: "con" | "sin" | null;
  /** High, Mid o Low (sin importar mayúsculas), o "sin_calidad". */
  calidad?: CalidadDeLead | null;
  abandono?: boolean;
  duplicado?: boolean;
  /** Sobre qué fecha y en qué días `YYYY-MM-DD` de Bogotá, inclusive (ticket 141). */
  fecha?: { campo: CampoDeFechaDeLead; rango: Rango } | null;
  /** Desde 0. */
  pagina?: number;
}

export const LEADS_POR_PAGINA = 100;

/** Las calidades que manda un formulario (ADR 0069; 30X tiene tres) y la cubeta de las que faltan. */
export const CALIDADES_DE_LEAD = ["high", "mid", "low", "sin_calidad"] as const;
export type CalidadDeLead = (typeof CALIDADES_DE_LEAD)[number];

/** Sobre qué fecha filtra la base de leads (ticket 141). */
export const CAMPOS_DE_FECHA_DE_LEAD = ["creado", "ultimo_envio"] as const;
export type CampoDeFechaDeLead = (typeof CAMPOS_DE_FECHA_DE_LEAD)[number];

export interface FilaLead {
  id: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  calificacion: string | null;
  leadQuality: string | null;
  leadValue: string | null;
  fechaUltimaAplicacion: Date | null;
  numAplicaciones: number;
  tieneDeal: boolean;
  soloParciales: boolean;
  correosSinConfirmar: number;
  etapa: EtapaDeal | null;
  canal: string | null;
}

export interface LeadEncontrado {
  id: string;
  nombre: string | null;
  emailNormalizado: string;
  telefono: string | null;
}

const MINIMO_TEXTO = 2;
const MAXIMO_FILAS = 20;

/** Busca dentro de UN programa; el texto viaja en el cuerpo de una server action, nunca en la URL. */
export async function buscarLeads(db: Db, programId: string, texto: string): Promise<LeadEncontrado[]> {
  const termino = texto.trim();
  if (termino.length < MINIMO_TEXTO) return [];

  const patron = `%${termino.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({
      id: leads.id,
      nombre: leads.nombre,
      emailNormalizado: leads.emailNormalizado,
      telefono: leads.telefono,
    })
    .from(leads)
    .where(and(
      eq(leads.programId, programId),
      or(ilike(leads.nombre, patron), ilike(leads.emailNormalizado, patron), ilike(leads.telefono, patron)),
    ))
    .orderBy(asc(leads.nombre), asc(leads.emailNormalizado))
    .limit(MAXIMO_FILAS);
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
  const calidadDelLead = sql<string>`lower(trim(${leads.leadQuality}))`;
  const condiciones: (SQL | undefined)[] = [eq(leads.programId, programId)];
  if (filtro.deal === "con") condiciones.push(inArray(leads.id, conDeal(db)));
  if (filtro.deal === "sin") condiciones.push(notInArray(leads.id, conDeal(db)));
  if (filtro.calidad === "sin_calidad") {
    condiciones.push(or(isNull(leads.leadQuality), eq(calidadDelLead, "")));
  } else if (filtro.calidad) {
    condiciones.push(eq(calidadDelLead, filtro.calidad));
  }
  if (filtro.abandono) condiciones.push(inArray(leads.id, soloParciales(db)));
  if (filtro.duplicado) condiciones.push(inArray(leads.id, conCorreoSinConfirmar(db)));
  if (filtro.fecha) {
    const dia = filtro.fecha.campo === "creado"
      ? sql<string>`(coalesce(${leads.fechaPrimeraAplicacion}, ${leads.createdAt}) AT TIME ZONE 'America/Bogota')::date`
      : sql<string>`(${leads.fechaUltimaAplicacion} AT TIME ZONE 'America/Bogota')::date`;
    condiciones.push(between(dia, filtro.fecha.rango.desde, filtro.fecha.rango.hasta));
  }
  const donde = and(...condiciones);

  const [{ total }] = await db.select({ total: count() }).from(leads).where(donde);
  const pagina = Math.max(0, filtro.pagina ?? 0);
  const base = await db
    .select({
      id: leads.id,
      nombre: leads.nombre,
      email: leads.emailNormalizado,
      telefono: leads.telefono,
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

  // Las marcas de la página, en lecturas por lote sobre SUS ids (no subconsultas correlacionadas).
  const ids = base.map((b) => b.id);
  const [dealsVigentes, parciales, marcas, envios] = await Promise.all([
    db
      .select({ leadId: deals.leadId, etapa: deals.etapa })
      .from(deals)
      .where(and(inArray(deals.leadId, ids), vigente(deals)))
      .orderBy(
        sql`case when ${deals.etapa} not in ('ganado_completo', 'cierre_perdido') then 0 else 1 end`,
        desc(deals.createdAt),
      ),
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
    db
      .select({
        leadId: submissions.leadId,
        utmSource: submissions.utmSource,
        utmMedium: submissions.utmMedium,
      })
      .from(submissions)
      .where(inArray(submissions.leadId, ids))
      .orderBy(sql`${submissions.fechaEnvio} desc nulls last`, desc(submissions.createdAt)),
  ]);
  const etapaPorLead = new Map<string, EtapaDeal>();
  for (const deal of dealsVigentes) if (!etapaPorLead.has(deal.leadId)) etapaPorLead.set(deal.leadId, deal.etapa);
  const canalPorLead = new Map<string, string | null>();
  for (const envio of envios) {
    if (envio.leadId && !canalPorLead.has(envio.leadId)) {
      canalPorLead.set(envio.leadId, envio.utmSource && envio.utmMedium ? `${envio.utmSource} / ${envio.utmMedium}` : null);
    }
  }
  const tienenDeal = new Set(dealsVigentes.map((d) => d.leadId));
  const soloPar = new Set(parciales.filter((p) => p.todosParciales).map((p) => p.leadId));
  const sinConfirmar = new Map(marcas.map((m) => [m.leadId, m.n]));

  return {
    total,
    filas: base.map((b) => ({
      ...b,
      tieneDeal: tienenDeal.has(b.id),
      soloParciales: soloPar.has(b.id),
      correosSinConfirmar: sinConfirmar.get(b.id) ?? 0,
      etapa: etapaPorLead.get(b.id) ?? null,
      canal: canalPorLead.get(b.id) ?? null,
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
  /** El dueño del deal abierto del lead, o `null` si no hay deal abierto o no tiene dueño (186). */
  duenoUserId?: string | null;
}

/** Por defecto 25 por página, como la lista de Leads (ticket 186, decisión 3). */
export const DUPLICADOS_POR_PAGINA = 25;

export interface OpcionesDuplicados {
  /** El closer ve solo los duplicados cuyo deal abierto es SUYO; administra no pasa nada (todos). */
  duenoUserId?: string;
  /** Desde 0. */
  pagina?: number;
  porPagina?: number;
}

/**
 * Los posibles duplicados del programa (072, 186), paginados en el servidor. El closer ve solo
 * los de SUS deals (`duenoUserId`); quien administra ve los del programa (sin `duenoUserId`).
 * El dueño es el del deal abierto del lead (misma frontera que
 * `deals_uno_abierto_por_lead_y_programa_idx`: etapa no en Completo/Cierre Perdido, no anulado).
 */
export async function posiblesDuplicadosDelPrograma(
  db: Db,
  programId: string,
  opciones: OpcionesDuplicados = {},
): Promise<{ total: number; filas: PosibleDuplicado[] }> {
  const porPagina = opciones.porPagina ?? DUPLICADOS_POR_PAGINA;
  const pagina = Math.max(0, opciones.pagina ?? 0);

  // El deal ABIERTO del lead (uno a lo sumo, por `deals_uno_abierto_por_lead_y_programa_idx`):
  // misma frontera que ese índice, con `vigente(deals)` INLINE en cada JOIN (el guardián de
  // vigencia lee cadena por cadena: un predicado izado a un const le pasa por debajo, AGENTS.md).
  // Un lead sin deal abierto deja `deals.ownerUserId` en null.
  const condiciones: (SQL | undefined)[] = [
    eq(leadContactos.programId, programId),
    eq(leads.programId, programId),
    eq(leadContactos.tipo, "correo"),
    eq(leadContactos.confirmado, false),
  ];
  // El closer: solo donde el deal abierto del lead es suyo (si no hay deal abierto, no lo ve).
  if (opciones.duenoUserId) condiciones.push(eq(deals.ownerUserId, opciones.duenoUserId));
  const donde = and(...condiciones);

  const [{ total }] = await db
    .select({ total: count() })
    .from(leadContactos)
    .innerJoin(leads, eq(leads.id, leadContactos.leadId))
    .leftJoin(deals, and(
      eq(deals.leadId, leads.id),
      eq(deals.programId, programId),
      notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
      vigente(deals),
    ))
    .where(donde);

  const filas = await db
    .select({
      contactoId: leadContactos.id,
      leadId: leads.id,
      nombreLead: leads.nombre,
      correoPrincipal: leads.emailNormalizado,
      correoSinConfirmar: leadContactos.valor,
      creadoEn: leadContactos.createdAt,
      duenoUserId: deals.ownerUserId,
    })
    .from(leadContactos)
    .innerJoin(leads, eq(leads.id, leadContactos.leadId))
    .leftJoin(deals, and(
      eq(deals.leadId, leads.id),
      eq(deals.programId, programId),
      notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
      vigente(deals),
    ))
    .where(donde)
    .orderBy(desc(leadContactos.createdAt))
    .limit(porPagina)
    .offset(pagina * porPagina);

  return { total, filas };
}
