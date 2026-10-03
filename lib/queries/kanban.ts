import { and, between, desc, eq, inArray, sql } from "drizzle-orm";
import {
  cohorts,
  calls,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leadContactos,
  leads,
  motivos,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ETAPAS_EN_ORDEN, type EtapaDeal, type PendienteDeal } from "@/lib/deals/etapas";
import { carteraVencida } from "@/lib/queries/cartera";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import { areas as catalogoAreas } from "@/lib/catalogo/areas";
import { hoyEnBogota } from "@/lib/format";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { filtroDeFechaDeLaUrl, type FiltroDeFecha } from "@/lib/periodo";
import { cerradosEn, fechaAnclaDealCreado } from "@/lib/queries/metricas-filtros";
import { ultimaActividadPorDeal } from "@/lib/queries/ultima-actividad";
import { dealsConAbonoSinComprobante } from "@/lib/deals/abono-sin-comprobante";
import type { AlcanceDeals } from "@/lib/auth/alcance-deals";
import { linkEnviadoSinCita } from "@/lib/deals/handoff";
import { esContactoRegistrado, hechosDeLlamadas } from "@/lib/deals/mover-etapa";
import { propiedadesQueLeFaltan } from "@/lib/deals/requisitos";

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
  /** Propiedades acumuladas que exige la etapa actual (rojo). */
  faltanALaEtapa: number;
  /** Compromiso Verbal con fecha limite de pago ya pasada (rojo). */
  compromisoVencido: boolean;
  /** Deal en cartera vencida: Abonado, saldo > 0, fecha limite pasada (rojo). */
  carteraVencida: boolean;
  /** Seguimiento con fecha de seguimiento ya pasada. */
  seguimientoVencido: boolean;
  /** El lead tiene un contacto sin confirmar: "unido por telefono" (ADR 0035 punto 4). */
  leadUnidoPorTelefono: boolean;
  /** Hay plata vigente sin soporte: no bloquea la venta, pero exige atención. */
  abonoSinComprobante: boolean;
  /** El setter marcó el link y llegó el siguiente hábil sin cita. */
  linkSinCita: boolean;
}

export interface TarjetaDeal {
  dealId: string;
  leadId: string;
  envios: number;
  nombreLead: string | null;
  emailLead: string;
  etapa: EtapaDeal;
  pendiente: PendienteDeal | null;
  ownerUserId: string | null;
  ownerNombre: string | null;
  /** El saldo tal como lo da `saldosDeDeals`: `null` sin total vendido. */
  saldo: number | null;
  moneda: string | null;
  cohortId: string | null;
  /** UTM del LEAD, para el filtro por canal (source + medium). */
  utmSource: string | null;
  utmMedium: string | null;
  leadQuality: string | null;
  leadValue: string | null;
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
  /** Canal del envio de origen del deal: `utm_source|utm_medium` (par exacto, ADR 0060). */
  canal?: string | null;
  /** Antiguedad minima en la etapa, en dias. */
  antiguedadMinima?: number | null;
  leadQuality?: string | null;
  leadValue?: string | null;
  /** Fecha de creacion, de ultima actividad o de cierre en el periodo A del selector (ticket 141). */
  fecha?: FiltroDeFecha<CampoDeFechaDeDeal> | null;
}

/** Sobre que fecha filtra la lista de deals (ticket 141), como en HubSpot. */
export const CAMPOS_DE_FECHA_DE_DEAL = ["creado", "actividad", "cierre"] as const;
export type CampoDeFechaDeDeal = (typeof CAMPOS_DE_FECHA_DE_DEAL)[number];

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
export function parsearFiltros(
  busqueda: Record<string, string | string[] | undefined>,
  hoy: string = hoyEnBogota(),
): FiltrosKanban {
  const fecha = filtroDeFechaDeLaUrl(busqueda, CAMPOS_DE_FECHA_DE_DEAL, hoy);
  const texto = (v: string | string[] | undefined): string | undefined =>
    typeof v === "string" && v !== "" ? v : undefined;
  const antiguedadCruda = texto(busqueda.antiguedad);
  const antiguedad = antiguedadCruda != null && /^\d+$/.test(antiguedadCruda) ? Number(antiguedadCruda) : null;
  return {
    ownerUserId: texto(busqueda.owner) ?? null,
    cohorteId: texto(busqueda.cohorte) ?? null,
    canal: texto(busqueda.canal) ?? null,
    ...(texto(busqueda.leadQuality) !== undefined ? { leadQuality: texto(busqueda.leadQuality) } : {}),
    ...(texto(busqueda.leadValue) !== undefined ? { leadValue: texto(busqueda.leadValue) } : {}),
    antiguedadMinima: antiguedad != null && antiguedad >= 1 ? antiguedad : null,
    ...(fecha ? { fecha } : {}),
  };
}

export async function tableroKanban(
  db: Db,
  programId: string,
  alcance: AlcanceDeals,
  filtros: FiltrosKanban = {},
  hoy: string = hoyEnBogota(),
  ahora: Date = new Date(),
): Promise<TableroKanban> {
  // Un deal + su lead + su dueno, en una sola lectura de la tabla `deals`
  // con joins (sin subconsultas correlacionadas: son joins directos, no plantillas).
  const { creado, actividad, cierre } = rangosDeFecha(filtros);
  const cerrados = cierre ? await cerradosEn(db, programId, cierre) : null;
  let filas = await db
    .select({
      dealId: deals.id,
      cortesia: deals.cortesia,
      leadId: deals.leadId,
      etapa: deals.etapa,
      pendiente: deals.pendiente,
      ownerUserId: deals.ownerUserId,
      fechaLimitePago: deals.fechaLimitePago,
      fechaSeguimiento: deals.fechaSeguimiento,
      cohortId: deals.cohortId,
      areaDeclaradaId: deals.areaDeclaradaId,
      valorVendidoUsd: deals.valorVendidoUsd,
      motivoId: deals.motivoId,
      createdAt: deals.createdAt,
      handoffEn: deals.handoffEn,
      nombreLead: leads.nombre,
      emailLead: leads.emailNormalizado,
      envios: leads.numAplicaciones,
      // El origen es del envio que abrio el deal (ADR 0060), nunca un resumen del lead.
      utmSource: submissions.utmSource,
      utmMedium: submissions.utmMedium,
        leadQuality: leads.leadQuality,
        leadValue: leads.leadValue,
      ownerNombre: users.nombre,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(
      and(
        eq(deals.programId, programId),
        vigente(deals),
        alcance.tipo === "dueno" ? eq(deals.ownerUserId, alcance.userId) : undefined,
        // Creado y cierre se deciden en SQL con la MISMA definicion que el dashboard (138, 141).
        creado ? between(fechaAnclaDealCreado(), creado.desde, creado.hasta) : undefined,
        // Un arreglo vacio en `inArray` no filtra nada: sin cerrados, la condicion es falsa.
        cerrados ? (cerrados.length > 0 ? inArray(deals.id, cerrados) : sql`false`) : undefined,
      ),
    );

  const columnasVacias = (): ColumnaKanban[] => ETAPAS_EN_ORDEN.map((etapa) => ({ etapa, tarjetas: [] }));
  if (actividad && filas.length > 0) {
    // La ultima actividad sale de la funcion que decide "estancado" en el Inbox, no de una copia.
    // Solo lo que ya ocurrio: una cita agendada para el martes no es actividad de hoy.
    const ultima = await ultimaActividadPorDeal(db, filas.map((f) => f.dealId), filas, ahora);
    filas = filas.filter((f) => {
      const dia = diaDeCalendario(ultima.get(f.dealId) ?? f.createdAt);
      return dia >= actividad.desde && dia <= actividad.hasta;
    });
  }
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
  const sinComprobante = await dealsConAbonoSinComprobante(db, dealIds);
  const llamadas = await db
    .select({ dealId: calls.dealId, resultado: calls.resultado, fechaAgenda: calls.fechaAgenda, createdAt: calls.createdAt })
    .from(calls)
    .where(and(inArray(calls.dealId, dealIds), vigente(calls)))
    .orderBy(desc(calls.createdAt));
  const actividades = await db
    .select({ dealId: dealActividades.dealId, tipo: dealActividades.tipo, canal: dealActividades.canal })
    .from(dealActividades)
    .where(inArray(dealActividades.dealId, dealIds));
  const conCitaVigente = new Set(llamadas.flatMap((c) => c.dealId && c.resultado === "agendada" ? [c.dealId] : []));
  const llamadasPorDeal = new Map<string, typeof llamadas>();
  for (const llamada of llamadas) {
    if (!llamada.dealId) continue;
    const suyas = llamadasPorDeal.get(llamada.dealId) ?? [];
    suyas.push(llamada);
    llamadasPorDeal.set(llamada.dealId, suyas);
  }
  const contactos = new Set(actividades.filter(esContactoRegistrado).map((a) => a.dealId));

  const tarjetas: TarjetaDeal[] = filas.map((f) => {
    const saldo = saldos.get(f.dealId);
    const entrada = entradas.get(f.dealId) ?? f.createdAt;
    const compromisoVencido =
      f.etapa === "compromiso_verbal" && f.fechaLimitePago != null && f.fechaLimitePago < hoy;
    const seguimientoVencido =
      f.pendiente === "seguimiento" && f.fechaSeguimiento != null && f.fechaSeguimiento < hoy;
    const { tieneLlamadaConFecha, llamadaSucedio } = hechosDeLlamadas(llamadasPorDeal.get(f.dealId) ?? []);
    const faltanALaEtapa = propiedadesQueLeFaltan(f.etapa, {
      cortesia: f.cortesia,
      tieneCohorte: f.cohortId != null,
      tieneDueno: f.ownerUserId != null,
      tieneContactoRegistrado: contactos.has(f.dealId),
      tieneLlamadaConFecha,
      llamadaSucedio,
      areaDeclaradaId: f.areaDeclaradaId,
      fechaLimitePago: f.fechaLimitePago,
      valorVendidoUsd: f.valorVendidoUsd == null ? null : Number(f.valorVendidoUsd),
      abonosVigentes: saldo?.abonosVigentes ?? 0,
      saldo: saldo?.saldo ?? null,
      motivoId: f.motivoId,
    }).length;
    return {
      dealId: f.dealId,
      leadId: f.leadId,
      envios: f.envios,
      nombreLead: f.nombreLead,
      emailLead: f.emailLead,
      etapa: f.etapa,
      pendiente: f.pendiente,
      ownerUserId: f.ownerUserId,
      ownerNombre: f.ownerNombre,
      saldo: saldo?.saldo ?? null,
      moneda: saldo?.moneda ?? null,
      cohortId: f.cohortId,
      utmSource: f.utmSource,
      utmMedium: f.utmMedium,
      leadQuality: f.leadQuality,
      leadValue: f.leadValue,
      diasEnEtapa: diasDesde(entrada, hoy),
      avisos: {
        faltanALaEtapa,
        compromisoVencido,
        carteraVencida: enCartera.has(f.dealId),
        seguimientoVencido,
        leadUnidoPorTelefono: sinConfirmar.has(f.leadId),
        abonoSinComprobante: sinComprobante.has(f.dealId),
        linkSinCita: linkEnviadoSinCita({
          handoffEn: f.handoffEn,
          tieneCitaVigente: conCitaVigente.has(f.dealId),
          hoy,
        }),
      },
    };
  });

  const filtrosVisibles = alcance.tipo === "dueno" ? { ...filtros, ownerUserId: null } : filtros;
  const filtradas = tarjetas.filter((t) => pasaFiltros(t, filtrosVisibles));

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
  if (f.leadQuality && t.leadQuality !== f.leadQuality) return false;
  if (f.leadValue && t.leadValue !== f.leadValue) return false;
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
  cohortesDestino: OpcionCatalogo[];
  canales: OpcionCanal[];
  leadQualities: string[];
  leadValues: string[];
  /**
   * Inicio de clases (`YYYY-MM-DD`) de cada cohorte con deals, y el de la cohorte activa:
   * con ellos el dialogo de Compromiso Verbal prellena la fecha limite (ticket 074, la
   * misma `fechaLimiteMaxima` de la reja del motor).
   */
  inicioDeClases: Record<string, string>;
  inicioDeLaCohorteActiva: string | null;
  areas: OpcionCatalogo[];
  /** Motivos activos por tipo (para las flechas que exigen motivo). */
  motivos: { id: string; nombre: string; tipo: string }[];
}

/**
 * Las opciones del programa para poblar los selectores del Kanban: los duenos que
 * tienen algun deal, las cohortes con deals, los canales presentes, y los catalogos
 * (motivos y áreas activos) que los diálogos de arrastre necesitan.
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
  const cohortesDestino = (await db
    .select({ id: cohorts.id, nombre: cohorts.codigo })
    .from(cohorts)
    .where(and(eq(cohorts.programId, programId), eq(cohorts.estado, "futuro"))))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Canales presentes: pares source+medium del envio de origen de los deals vigentes.
  const canalFilas = await db
    .selectDistinct({ utmSource: submissions.utmSource, utmMedium: submissions.utmMedium })
    .from(deals)
    .innerJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(and(eq(deals.programId, programId), vigente(deals)));
  const canales = canalFilas
    .filter((c) => c.utmSource && c.utmMedium)
    .map((c) => ({ clave: `${c.utmSource}|${c.utmMedium}`, utmSource: c.utmSource!, utmMedium: c.utmMedium! }))
    .sort((a, b) => a.clave.localeCompare(b.clave));
  const etiquetasFilas = await db
    .selectDistinct({ leadQuality: leads.leadQuality, leadValue: leads.leadValue })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.programId, programId), vigente(deals)));
  const leadQualities = etiquetasFilas.map((f) => f.leadQuality).filter((v): v is string => v !== null).sort();
  const leadValues = etiquetasFilas.map((f) => f.leadValue).filter((v): v is string => v !== null).sort();

  // Los motivos son un catalogo GLOBAL (no por programa): la flecha decide la lista por
  // su tipo, y el dialogo la filtra en el cliente.
  const motivoFilas = await db
    .select({ id: motivos.id, nombre: motivos.nombre, tipo: motivos.tipo })
    .from(motivos)
    .where(eq(motivos.activo, true));
  const listaMotivos = motivoFilas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  const listaAreas = (await catalogoAreas(db).listar({ soloActivos: true })).map((a) => ({
    id: a.id,
    nombre: String(a.nombre),
  }));

  const inicioDeClases = Object.fromEntries(cohorteFilas.map((c) => [c.id, c.inicio] as const));
  const inicioDeLaCohorteActiva = (await cohorteActiva(programId, db))?.fechaInicioClases ?? null;

  return { owners, cohortes, cohortesDestino, canales, leadQualities, leadValues, inicioDeClases, inicioDeLaCohorteActiva, areas: listaAreas, motivos: listaMotivos };
}

/** El rango del filtro de fecha, bajo la llave del campo que filtra; los otros dos, ausentes. */
function rangosDeFecha(f: FiltrosKanban): Partial<Record<CampoDeFechaDeDeal, { desde: string; hasta: string }>> {
  return f.fecha ? { [f.fecha.campo]: f.fecha.periodo.a } : {};
}
