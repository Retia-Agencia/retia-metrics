import { and, eq, inArray } from "drizzle-orm";
import { cohorts, deals, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ETAPAS_VENDIDAS, type EtapaDeal } from "@/lib/deals/etapas";
import { hoyEnBogota } from "@/lib/format";
import { carteraVencida } from "@/lib/queries/cartera";
import { saldosDeDeals, type SaldoDeDeal } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

/**
 * Los estudiantes de un programa: **una consulta sobre `etapa`, no una tabla ni una columna**
 * (ticket 063). Un estudiante es un deal vigente en Ganado Pago Parcial o Ganado Pagado Completo. Las listas por
 * programa y por cohorte son filtros de esta misma consulta.
 *
 * El programa es frontera (ADR 0043): recibe UNO y no admite "todos". La cohorte, si se pide,
 * se filtra dentro de ese programa, así que una cohorte ajena no devuelve nada.
 */
export const ETAPAS_DE_ESTUDIANTE: readonly EtapaDeal[] = ETAPAS_VENDIDAS;

export interface Estudiante {
  dealId: string;
  leadId: string;
  nombre: string | null;
  email: string;
  etapa: EtapaDeal;
  cohortId: string | null;
  codigoCohorte: string | null;
  ownerUserId: string | null;
  ownerNombre: string | null;
  onboardedAt: Date | null;
  acuerdoPago: string | null;
  fechaLimitePago: string | null;
}

export async function estudiantesDe(db: Db, programId: string, filtro: { cohortId?: string } = {}): Promise<Estudiante[]> {
  return db
    .select({
      dealId: deals.id,
      leadId: deals.leadId,
      nombre: leads.nombre,
      email: leads.emailNormalizado,
      etapa: deals.etapa,
      cohortId: deals.cohortId,
      codigoCohorte: cohorts.codigo,
      ownerUserId: deals.ownerUserId,
      ownerNombre: users.nombre,
      onboardedAt: deals.onboardedAt,
      acuerdoPago: deals.acuerdoPago,
      fechaLimitePago: deals.fechaLimitePago,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(cohorts, eq(cohorts.id, deals.cohortId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(
      and(
        eq(deals.programId, programId),
        inArray(deals.etapa, [...ETAPAS_DE_ESTUDIANTE]),
        vigente(deals),
        filtro.cohortId ? eq(deals.cohortId, filtro.cohortId) : undefined,
      ),
    )
    .orderBy(leads.emailNormalizado);
}

/** Un estudiante como lo muestra la tab Students (ticket 099). */
export interface FilaStudents extends Estudiante {
  saldo: SaldoDeDeal | null;
  /** Solo si está en cartera vencida (`carteraVencida`, ADR 0053): la fecha contra la que venció y cuánto. */
  vencido: { fechaLimite: string; diasDeAtraso: number } | null;
}

export interface FiltroStudents {
  /** Nulo = todas las cohortes del programa. */
  cohortId?: string | null;
  onboarded?: "si" | "no" | null;
  /**
   * Solo los estudiantes de ESTE dueño (ticket 172, "Mis students" de Mi espacio). Nulo
   * = todos los del programa. El programa sigue siendo frontera; esto solo acota al
   * closer dentro de su programa.
   */
  ownerUserId?: string | null;
  /**
   * Los leads que casan con la búsqueda (`leadsQueCasan`): si es un `Set`, solo pasan los
   * estudiantes cuyo lead está ahí; `null` = sin búsqueda, no filtra.
   */
  leadsCasan?: Set<string> | null;
  /** El orden de la lista; por defecto el de siempre (por correo). */
  orden?: OrdenStudents;
}

/** Los órdenes de la tab Students (ticket o8-busqueda). El primero es el de por defecto. */
export const ORDENES_STUDENTS = [
  { value: "correo:asc", label: "Correo: A → Z" },
  { value: "nombre:asc", label: "Nombre: A → Z" },
  { value: "nombre:desc", label: "Nombre: Z → A" },
  { value: "saldo:desc", label: "Saldo: mayor primero" },
  { value: "saldo:asc", label: "Saldo: menor primero" },
] as const;

export type OrdenStudents = (typeof ORDENES_STUDENTS)[number]["value"];

export const ORDEN_STUDENTS_POR_DEFECTO: OrdenStudents = "correo:asc";

/**
 * La tab Students (ticket 099): los estudiantes con su saldo, su acuerdo de pago, si están en
 * cartera vencida y su onboarding. **Nada se recalcula aquí:** el saldo sale de `saldosDeDeals`
 * (ADR 0024) y lo vencido de `carteraVencida` (ADR 0053), las mismas cifras que ven la ficha,
 * el Kanban y el Inbox.
 */
export async function studentsDelPrograma(
  db: Db,
  programId: string,
  filtro: FiltroStudents = {},
  hoy: string = hoyEnBogota(),
): Promise<FilaStudents[]> {
  const todos = await estudiantesDe(db, programId, filtro.cohortId ? { cohortId: filtro.cohortId } : {});
  const porDueno = filtro.ownerUserId ? todos.filter((e) => e.ownerUserId === filtro.ownerUserId) : todos;
  // Búsqueda: solo los estudiantes cuyo lead casa (`leadsQueCasan`). `null` = sin búsqueda.
  const porBusqueda =
    filtro.leadsCasan == null ? porDueno : porDueno.filter((e) => filtro.leadsCasan!.has(e.leadId));
  const filas =
    filtro.onboarded == null ? porBusqueda : porBusqueda.filter((e) => (e.onboardedAt != null) === (filtro.onboarded === "si"));
  if (filas.length === 0) return [];

  const [saldos, cartera] = await Promise.all([
    saldosDeDeals(db, filas.map((f) => f.dealId)),
    carteraVencida(db, programId, hoy),
  ]);
  const vencidos = new Map(cartera.vencidos.map((v) => [v.dealId, { fechaLimite: v.fechaLimite, diasDeAtraso: v.diasDeAtraso }]));
  const conSaldo: FilaStudents[] = filas.map((f) => ({
    ...f,
    saldo: saldos.get(f.dealId) ?? null,
    vencido: vencidos.get(f.dealId) ?? null,
  }));
  // El orden se aplica en memoria sobre las filas ya cargadas (la escala lo permite). El de
  // por defecto (`correo:asc`) es el de siempre: `estudiantesDe` ya viene ordenado por correo.
  return ordenarStudents(conSaldo, filtro.orden ?? ORDEN_STUDENTS_POR_DEFECTO);
}

/**
 * El orden de la tab Students. `correo:asc` es el de siempre (y el que trae `estudiantesDe`),
 * así que no reordena. El saldo compara la cifra numérica (un saldo nulo va al final).
 */
function ordenarStudents(filas: FilaStudents[], orden: OrdenStudents): FilaStudents[] {
  if (orden === "correo:asc") return filas;
  const nombre = (f: FilaStudents) => (f.nombre ?? f.email).toLocaleLowerCase("es");
  const saldo = (f: FilaStudents) => f.saldo?.saldo ?? null;
  const copia = [...filas];
  switch (orden) {
    case "nombre:asc":
      return copia.sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));
    case "nombre:desc":
      return copia.sort((a, b) => nombre(b).localeCompare(nombre(a), "es"));
    case "saldo:desc":
      return copia.sort((a, b) => (saldo(b) ?? -Infinity) - (saldo(a) ?? -Infinity));
    case "saldo:asc":
      return copia.sort((a, b) => (saldo(a) ?? Infinity) - (saldo(b) ?? Infinity));
  }
}
