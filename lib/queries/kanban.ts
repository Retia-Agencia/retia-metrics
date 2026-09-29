import { and, desc, eq, inArray } from "drizzle-orm";
import {
  cohorts,
  dealEtapaHistorial,
  deals,
  leadContactos,
  leads,
  motivos,
  productos,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ETAPAS_EN_ORDEN, type EtapaDeal } from "@/lib/deals/etapas";
import { carteraVencida } from "@/lib/queries/cartera";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import { hoyEnBogota } from "@/lib/format";

/**
 * Los deals de un programa agrupados por etapa, para el Kanban (ticket 069).
 *
 * - **El programa es frontera** (ADR 0043): la funcion recibe UN programId y jamas
 *   cruza a otro. No admite "todos los programas": un tablero es de un programa.
 * - **Solo deals vigentes** (`vigente(deals)`, ADR 0026/0038): un deal anulado no
 *   aparece en NINGUNA columna. Los cerrados (Completo, Cierre Perdido) SI aparecen,
 *   en su columna: el tablero muestra el estado completo, no solo lo abierto.
 * - **El saldo sale de `saldosDeDeals`** (ADR 0024), nunca se recalcula aqui.
 * - **La cartera vencida sale de `carteraVencida`** (ADR 0053): el mismo predicado que
 *   la lista de cartera, no una copia.
 * - **Nada de subconsultas correlacionadas** dentro de una plantilla `sql` (AGENTS.md):
 *   se agrupa cada cosa aparte y se une en memoria, que a esta escala (~2 programas,
 *   miles de filas) es gratis y se lee correcto.
 * - **Ninguna fecha se interpola en una plantilla `sql`**: se comparan `YYYY-MM-DD`
 *   como texto (fechas de negocio de Bogota) contra `hoyEnBogota()`.
 *
 * Las once columnas salen SIEMPRE, en el orden del recorrido (`ETAPAS_EN_ORDEN`), aunque esten
 * vacias: un tablero con una columna que desaparece porque no tiene tarjetas confunde.
 */

/** Los avisos de una tarjeta. Cada uno se pinta con su `<Badge variant>` en la UI. */
export interface AvisosDeTarjeta {
  /** Compromiso Verbal con fecha limite de pago ya pasada (rojo). */
  compromisoVencido: boolean;
  /** Deal en cartera vencida: Abonado, saldo > 0, fecha limite pasada (rojo). */
  carteraVencida: boolean;
  /** Seguimiento con fecha de seguimiento ya pasada. */
  seguimientoVencido: boolean;
  /** El lead tiene un contacto sin confirmar: "unido por telefono" (ADR 0035 punto 4). */
  leadUnidoPorTelefono: boolean;
}

export interface TarjetaDeal {
  dealId: string;
  leadId: string;
  nombreLead: string | null;
  emailLead: string;
  etapa: EtapaDeal;
  ownerUserId: string | null;
  ownerNombre: string | null;
  productoNombre: string | null;
  /** El saldo tal como lo da `saldosDeDeals`: `null` sin producto o con monedas mezcladas. */
  saldo: number | null;
  moneda: string | null;
  cohortId: string | null;
  /** UTM del LEAD, para el filtro por canal (source + medium). */
  utmSource: string | null;
  utmMedium: string | null;
  /** Dias que el deal lleva en su etapa actual (dia de Bogota). */
  diasEnEtapa: number;
  avisos: AvisosDeTarjeta;
}

/** Una columna del tablero: la etapa y sus tarjetas. */
export interface ColumnaKanban {
  etapa: EtapaDeal;
  tarjetas: TarjetaDeal[];
}

export interface TableroKanban {
  columnas: ColumnaKanban[];
  /** El total de tarjetas visibles tras aplicar los filtros. */
  total: number;
}

/** Los filtros del tablero, todos opcionales. Salen de la URL, nunca de la sesion (ADR 0023). */
export interface FiltrosKanban {
  /** Dueno del deal (`owner_user_id`). */
  ownerUserId?: string | null;
  /** Cohorte de origen del deal (`cohort_id`). */
  cohorteId?: string | null;
  /** Canal del lead: `utm_source|utm_medium` (par exacto). */
  canal?: string | null;
  /** Antiguedad minima en la etapa, en dias. */
  antiguedadMinima?: number | null;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Dias de calendario entre dos instantes, medidos por su dia de Bogota. */
function diasDesde(instante: Date, hoy: string): number {
  const diaEntrada = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(instante);
  return Math.max(0, Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${diaEntrada}T00:00:00Z`)) / MS_POR_DIA));
}

/** El par canal de un lead, o `null` si le falta alguna mitad. */
export function canalDeLead(utmSource: string | null, utmMedium: string | null): string | null {
  if (!utmSource || !utmMedium) return null;
  return `${utmSource}|${utmMedium}`;
}

/**
 * Los filtros del tablero leidos de los parametros de la URL (ADR 0023: nunca de la
 * sesion). Un parametro ausente o vacio no filtra. `antiguedad` solo cuenta si es un
 * entero >= 1; cualquier otra cosa se ignora en vez de reventar la pantalla.
 *
 * Es puro para poder probarlo: recibe un objeto de strings y devuelve `FiltrosKanban`.
 */
export function parsearFiltros(busqueda: Record<string, string | string[] | undefined>): FiltrosKanban {
  const texto = (v: string | string[] | undefined): string | undefined =>
    typeof v === "string" && v !== "" ? v : undefined;
  const antiguedadCruda = texto(busqueda.antiguedad);
  const antiguedad = antiguedadCruda != null && /^\d+$/.test(antiguedadCruda) ? Number(antiguedadCruda) : null;
  return {
    ownerUserId: texto(busqueda.owner) ?? null,
    cohorteId: texto(busqueda.cohorte) ?? null,
    canal: texto(busqueda.canal) ?? null,
    antiguedadMinima: antiguedad != null && antiguedad >= 1 ? antiguedad : null,
  };
}

export async function tableroKanban(
  db: Db,
  programId: string,
  filtros: FiltrosKanban = {},
  hoy: string = hoyEnBogota(),
): Promise<TableroKanban> {
  // Un deal + su lead + su dueno + su producto, en una sola lectura de la tabla `deals`
  // con joins (sin subconsultas correlacionadas: son joins directos, no plantillas).
  const filas = await db
    .select({
      dealId: deals.id,
      leadId: deals.leadId,
      etapa: deals.etapa,
      ownerUserId: deals.ownerUserId,
      fechaLimitePago: deals.fechaLimitePago,
      fechaSeguimiento: deals.fechaSeguimiento,
      cohortId: deals.cohortId,
      createdAt: deals.createdAt,
      nombreLead: leads.nombre,
      emailLead: leads.emailNormalizado,
      utmSource: leads.utmSource,
      utmMedium: leads.utmMedium,
      ownerNombre: users.nombre,
      productoNombre: productos.nombre,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .leftJoin(productos, eq(productos.id, deals.productoId))
    .where(and(eq(deals.programId, programId), vigente(deals)));

  const columnasVacias = (): ColumnaKanban[] => ETAPAS_EN_ORDEN.map((etapa) => ({ etapa, tarjetas: [] }));
  if (filas.length === 0) return { columnas: columnasVacias(), total: 0 };

  const dealIds = filas.map((f) => f.dealId);
  const leadIds = [...new Set(filas.map((f) => f.leadId))];

  // El saldo y la cartera salen de sus modulos (ADR 0024, 0053), nunca se recalculan.
  const saldos = await saldosDeDeals(db, dealIds);
  const cartera = await carteraVencida(db, programId, hoy);
  const enCartera = new Set(cartera.vencidos.map((v) => v.dealId));

  // La entrada a la etapa actual, para "dias en etapa": el ultimo movimiento hacia la
  // etapa que tiene ahora, o su alta. Se agrupa aparte y se une en memoria.
  const entradas = await entradasAEtapaActual(db, filas);

  // Contactos SIN confirmar por lead: "unido por telefono" (ADR 0035 punto 4). Un lead
  // con al menos uno lleva el aviso. Se agrupa aparte.
  const sinConfirmar = await leadsConContactoSinConfirmar(db, leadIds);

  const tarjetas: TarjetaDeal[] = filas.map((f) => {
    const saldo = saldos.get(f.dealId);
    const entrada = entradas.get(f.dealId) ?? f.createdAt;
    const compromisoVencido =
      f.etapa === "compromiso_verbal" && f.fechaLimitePago != null && f.fechaLimitePago < hoy;
    const seguimientoVencido =
      f.etapa === "seguimiento" && f.fechaSeguimiento != null && f.fechaSeguimiento < hoy;
    return {
      dealId: f.dealId,
      leadId: f.leadId,
      nombreLead: f.nombreLead,
      emailLead: f.emailLead,
      etapa: f.etapa,
      ownerUserId: f.ownerUserId,
      ownerNombre: f.ownerNombre,
      productoNombre: f.productoNombre,
      saldo: saldo?.saldo ?? null,
      moneda: saldo?.moneda ?? null,
      cohortId: f.cohortId,
      utmSource: f.utmSource,
      utmMedium: f.utmMedium,
      diasEnEtapa: diasDesde(entrada, hoy),
      avisos: {
        compromisoVencido,
        carteraVencida: enCartera.has(f.dealId),
        seguimientoVencido,
        leadUnidoPorTelefono: sinConfirmar.has(f.leadId),
      },
    };
  });

  const filtradas = tarjetas.filter((t) => pasaFiltros(t, filtros));

  const porEtapa = new Map<EtapaDeal, TarjetaDeal[]>();
  for (const etapa of ETAPAS_EN_ORDEN) porEtapa.set(etapa, []);
  for (const t of filtradas) porEtapa.get(t.etapa)!.push(t);
  // Dentro de una columna, lo mas viejo en la etapa primero: es a lo que hay que
  // prestarle atencion antes.
  for (const lista of porEtapa.values()) lista.sort((a, b) => b.diasEnEtapa - a.diasEnEtapa || a.emailLead.localeCompare(b.emailLead));

  return {
    columnas: ETAPAS_EN_ORDEN.map((etapa) => ({ etapa, tarjetas: porEtapa.get(etapa)! })),
    total: filtradas.length,
  };
}

/** `true` si la tarjeta pasa todos los filtros dados. */
function pasaFiltros(t: TarjetaDeal, f: FiltrosKanban): boolean {
  if (f.ownerUserId && t.ownerUserId !== f.ownerUserId) return false;
  if (f.cohorteId && t.cohortId !== f.cohorteId) return false;
  if (f.canal && canalDeLead(t.utmSource, t.utmMedium) !== f.canal) return false;
  if (f.antiguedadMinima != null && t.diasEnEtapa < f.antiguedadMinima) return false;
  return true;
}

/**
 * La fecha en que cada deal entro a la etapa que tiene AHORA: su ultimo movimiento de
 * historial hacia esa etapa. Se trae el historial de los deals y se resuelve en memoria
 * (nada de subconsultas correlacionadas). Un deal sin fila que case usa su `createdAt`.
 */
async function entradasAEtapaActual(
  db: Db,
  filas: { dealId: string; etapa: EtapaDeal }[],
): Promise<Map<string, Date>> {
  const dealIds = filas.map((f) => f.dealId);
  const historial = await db
    .select({ dealId: dealEtapaHistorial.dealId, a: dealEtapaHistorial.a, fecha: dealEtapaHistorial.fecha })
    .from(dealEtapaHistorial)
    .where(inArray(dealEtapaHistorial.dealId, dealIds))
    .orderBy(desc(dealEtapaHistorial.fecha));

  const etapaDeDeal = new Map(filas.map((f) => [f.dealId, f.etapa] as const));
  const entrada = new Map<string, Date>();
  // El historial viene de mas nuevo a mas viejo: el primer movimiento hacia la etapa
  // actual que veamos por deal es el ultimo en el tiempo.
  for (const h of historial) {
    if (entrada.has(h.dealId)) continue;
    if (h.a === etapaDeDeal.get(h.dealId)) entrada.set(h.dealId, h.fecha);
  }
  return entrada;
}

/** Los leads (de la lista dada) que tienen al menos un contacto SIN confirmar. */
async function leadsConContactoSinConfirmar(db: Db, leadIds: string[]): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  const filas = await db
    .select({ leadId: leadContactos.leadId })
    .from(leadContactos)
    .where(and(inArray(leadContactos.leadId, leadIds), eq(leadContactos.confirmado, false)));
  return new Set(filas.map((f) => f.leadId));
}

/** Las opciones que el tablero ofrece: para los filtros y para los dialogos de arrastre. */
export interface OpcionCatalogo {
  id: string;
  nombre: string;
}
export interface OpcionCanal {
  /** El valor del filtro: `utm_source|utm_medium`. */
  clave: string;
  utmSource: string;
  utmMedium: string;
}
export interface OpcionesDeTablero {
  owners: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  canales: OpcionCanal[];
  /**
   * Inicio de clases (`YYYY-MM-DD`) de cada cohorte con deals, y el de la cohorte activa:
   * con ellos el dialogo de Compromiso Verbal prellena la fecha limite (ticket 074, la
   * misma `fechaLimiteMaxima` de la reja del motor).
   */
  inicioDeClases: Record<string, string>;
  inicioDeLaCohorteActiva: string | null;
  /** Productos activos del programa (para el dialogo de Compromiso Verbal). */
  productos: (OpcionCatalogo & { moneda: string; precio: string })[];
  /** Motivos activos por tipo (para las flechas que exigen motivo). */
  motivos: { id: string; nombre: string; tipo: string }[];
}

/**
 * Las opciones del programa para poblar los selectores del Kanban: los duenos que
 * tienen algun deal, las cohortes con deals, los canales presentes, y los catalogos
 * (productos activos, motivos activos) que los dialogos de arrastre necesitan.
 *
 * El programa es frontera (ADR 0043): todo se acota a `programId`. Los owners y las
 * cohortes salen de los deals del programa (no de la tabla entera) para no ofrecer
 * filtros que no filtran nada.
 */
export async function opcionesDeTablero(db: Db, programId: string): Promise<OpcionesDeTablero> {
  // Owners con deals vigentes en el programa.
  const ownerFilas = await db
    .selectDistinct({ id: users.id, nombre: users.nombre })
    .from(deals)
    .innerJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(eq(deals.programId, programId), vigente(deals)));
  const owners = ownerFilas
    .map((o) => ({ id: o.id, nombre: o.nombre ?? "Sin nombre" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Cohortes con deals vigentes en el programa.
  const cohorteFilas = await db
    .selectDistinct({ id: cohorts.id, codigo: cohorts.codigo, inicio: cohorts.fechaInicioClases })
    .from(deals)
    .innerJoin(cohorts, eq(cohorts.id, deals.cohortId))
    .where(and(eq(deals.programId, programId), vigente(deals)));
  const cohortes = cohorteFilas
    .map((c) => ({ id: c.id, nombre: c.codigo }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Canales presentes: pares source+medium de los leads con deal vigente.
  const canalFilas = await db
    .selectDistinct({ utmSource: leads.utmSource, utmMedium: leads.utmMedium })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.programId, programId), vigente(deals)));
  const canales = canalFilas
    .filter((c) => c.utmSource && c.utmMedium)
    .map((c) => ({ clave: `${c.utmSource}|${c.utmMedium}`, utmSource: c.utmSource!, utmMedium: c.utmMedium! }))
    .sort((a, b) => a.clave.localeCompare(b.clave));

  const productosFilas = await db
    .select({ id: productos.id, nombre: productos.nombre, moneda: productos.moneda, precio: productos.precioLista })
    .from(productos)
    .where(and(eq(productos.programId, programId), eq(productos.activo, true)));
  const listaProductos = productosFilas
    .map((p) => ({ id: p.id, nombre: p.nombre, moneda: p.moneda, precio: p.precio }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Los motivos son un catalogo GLOBAL (no por programa): la flecha decide la lista por
  // su tipo, y el dialogo la filtra en el cliente.
  const motivoFilas = await db
    .select({ id: motivos.id, nombre: motivos.nombre, tipo: motivos.tipo })
    .from(motivos)
    .where(eq(motivos.activo, true));
  const listaMotivos = motivoFilas.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const inicioDeClases = Object.fromEntries(cohorteFilas.map((c) => [c.id, c.inicio] as const));
  const inicioDeLaCohorteActiva = (await cohorteActiva(programId, db))?.fechaInicioClases ?? null;

  return { owners, cohortes, canales, inicioDeClases, inicioDeLaCohorteActiva, productos: listaProductos, motivos: listaMotivos };
}
