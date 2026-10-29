import { and, eq, inArray, sql } from "drizzle-orm";
import { columnasUtmDelEnvio, type utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { abonos, calls, deals, programs, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { etiquetaDeCloser, normalizarCloserId, parsearClaveCloser } from "@/lib/closers/identidad";
import { CLAVE_SIN_DUENO } from "@/lib/queries/embudo-con-filas";
import { diasHabilesEntre, diaDeCalendario, esDiaHabil } from "@/lib/dias-habiles";
import { RESULTADOS_FALLIDOS, RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import type { Rango } from "@/lib/queries/dashboard";
import { fechaAnclaCall, ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { dimensionesDeFecha } from "@/lib/queries/hechos/fechas";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

/**
 * La escalera de conversión (ADR 0109, ticket 319): en qué escalón paga, o se queda, cada deal.
 *
 * UNA sola función decide el escalón de un deal (`escalonDeDeal`, pura) y UNA lo carga
 * (`escaleraDeDeals`). Toda vista (Hub, media, insights) importa de aquí; ninguna recalcula un
 * escalón. El escalón se calcula al leer y nunca se guarda: un deal que paga sube de escalón solo.
 *
 * El universo de un periodo (ADR 0109 punto 1, precisado en `docs/metricas.md`):
 *  - los deals VENDIDOS en el periodo (`ventasConDiaEn`, la misma definición de venta del Hub, ADR
 *    0024) caen en los escalones 1 a 4 (`ESCALONES_QUE_PAGARON`), así que su suma es exactamente las
 *    ventas del periodo;
 *  - los deals CREADOS en el periodo que todavía no se han vendido caen en los escalones 5 a 7.
 * Un deal creado en el periodo y vendido después sale de 5-7 y entra a 1-4 en el periodo de su venta.
 * Las cortesías no son ventas ni intentos de venta: quedan fuera.
 *
 * ponytail: se decide en memoria sobre los deals y las llamadas del programa (a ~3.000 leads por
 * programa es gratis y la regla se lee; AGENTS.md). Si un programa pasara de ~50.000 deals, mover el
 * `first abono` y la última cita a SQL con un `DISTINCT ON`.
 */

export const ESCALONES = [
  "pago_en_llamada",
  "pago_rapido",
  "pago_despues",
  "pago_sin_llamada",
  "atendio_no_compro",
  "agendo_no_se_presento",
  "dejo_datos",
] as const;
export type Escalon = (typeof ESCALONES)[number];

export const NOMBRE_DE_ESCALON: Record<Escalon, string> = {
  pago_en_llamada: "Pagó en la llamada",
  pago_rapido: "Pagó rápido",
  pago_despues: "Pagó después",
  pago_sin_llamada: "Pagó sin llamada registrada",
  atendio_no_compro: "Atendió y no compró",
  agendo_no_se_presento: "Agendó y no se presentó",
  dejo_datos: "Dejó datos y sin cita ocurrida",
};

/** Los escalones de una venta: su suma es las ventas del periodo. Los tres primeros son los medibles. */
export const ESCALONES_QUE_PAGARON: readonly Escalon[] = ["pago_en_llamada", "pago_rapido", "pago_despues", "pago_sin_llamada"];

export function esEscalon(valor: string | undefined): valor is Escalon {
  return (ESCALONES as readonly string[]).includes(valor ?? "");
}

/** Lo que el CRM sabe de un deal para ubicarlo; todos los días son de calendario de Bogotá. */
export interface HechosDeEscalera {
  /** Es una venta del periodo (el universo de los escalones 1 a 4). */
  vendido: boolean;
  /** Día del primer abono vigente de ticket, si hay. */
  primerAbono: string | null;
  /** Días de las citas atendidas (resultado que prueba que ocurrió), vigentes. */
  citasAtendidas: readonly string[];
  /**
   * Hay alguna cita VENCIDA sin atender: su hora ya pasó y su resultado es de llamada fallida (no show
   * o cancelada). Una cita pendiente (futura, agendada sin resultado o reagendada) no es una cita que
   * haya sucedido y no cuenta (ADR 0109, enmienda del 28-oct).
   */
  citaVencidaSinAtender: boolean;
}

export interface UbicacionEnLaEscalera {
  escalon: Escalon;
  /** Días hábiles de la cita al primer abono (0 = el mismo día); solo si pagó y hay cita atendida. */
  diasCitaAPago: number | null;
}

/**
 * Los días hábiles que pasan DESPUÉS de `cita` hasta `pago`, inclusive este último (sábado y
 * domingo no cuentan; los festivos sí). El mismo día es 0.
 */
export function diasHabilesDespuesDe(cita: string, pago: string): number {
  return Math.max(0, diasHabilesEntre(cita, pago) - (esDiaHabil(cita) ? 1 : 0));
}

/**
 * El escalón de UN deal (ADR 0109 punto 2), en orden de precedencia. `corte` nulo: no hay un corte
 * de "rápido" y los escalones 2 y 3 se juntan en "pagó después".
 */
export function escalonDeDeal(hechos: HechosDeEscalera, corte: number | null): UbicacionEnLaEscalera {
  if (hechos.vendido) {
    const pago = hechos.primerAbono;
    // La última cita atendida que no es posterior al primer abono: la llamada en que se cerró.
    const cita = pago === null
      ? null
      : [...hechos.citasAtendidas].filter((dia) => dia <= pago).sort().at(-1) ?? null;
    // Sin una llamada atendida anterior al pago no hay contra qué medir (ADR 0109, enmienda del
    // 28-oct): el 48 % de las ventas históricas viene de las hojas o se creó a mano sin llamada.
    if (pago === null || cita === null) return { escalon: "pago_sin_llamada", diasCitaAPago: null };
    const dias = diasHabilesDespuesDe(cita, pago);
    if (cita === pago) return { escalon: "pago_en_llamada", diasCitaAPago: 0 };
    if (corte !== null && dias <= corte) return { escalon: "pago_rapido", diasCitaAPago: dias };
    return { escalon: "pago_despues", diasCitaAPago: dias };
  }
  if (hechos.citasAtendidas.length > 0) return { escalon: "atendio_no_compro", diasCitaAPago: null };
  if (hechos.citaVencidaSinAtender) return { escalon: "agendo_no_se_presento", diasCitaAPago: null };
  // Sin ninguna cita que haya sucedido (ni siquiera las pendientes cuentan): la escalera mide lo ocurrido.
  return { escalon: "dejo_datos", diasCitaAPago: null };
}

export const SIN_CALIDAD = "Sin calidad";

/** Los UTM crudos del envio que abrio el deal (`utmsDelEnvio` los interpreta); nulo si el deal no tiene envio de origen. */
export type EnvioDeOrigen = Parameters<typeof utmsDelEnvio>[0];

export interface DealEnLaEscalera extends UbicacionEnLaEscalera {
  dealId: string;
  /** El día de la venta (escalones 1 a 4) o el de creación del deal (5 a 7), de Bogotá. */
  fecha: string;
  etapa: string;
  closer: string | null;
  claveCloser: string;
  /** Para el filtro de closer: la cuenta del dueño y su texto histórico (`users.closer_id`). */
  ownerUserId: string | null;
  ownerCloserId: string | null;
  cohorteId: string | null;
  /** La calidad del envío que abrió el deal, tal como llegó; `SIN_CALIDAD` si no la trae. */
  calidad: string;
  /** El origen del deal: lo que Pauta reparte por canal y campana. */
  envio: EnvioDeOrigen | null;
}

export interface EscaleraCargada {
  /** Días hábiles del corte de "pagó rápido"; nulo = el programa no lo definió. */
  corteDias: number | null;
  deals: DealEnLaEscalera[];
}

const RANGO_TOTAL: Rango = { desde: "1900-01-01", hasta: "2999-12-31" };

export function ventasDelPrograma(db: Db, programId: string) {
  const ventas = ventasConDiaEn(db, RANGO_TOTAL).as("ventas_de_la_escalera");
  return db.select({ dealId: ventas.dealId, dia: ventas.dia }).from(ventas)
    .innerJoin(deals, and(eq(deals.id, ventas.dealId), vigente(deals)))
    .where(and(eq(deals.programId, programId), incluyendoAnulados(ventas)));
}

/**
 * Carga los hechos mínimos y aplica `escalonDeDeal` para un lote ya clasificado como vendido/no vendido.
 * Es la única puerta para que otras métricas reutilicen el mismo primer abono, citas y corte de la escalera.
 */
export async function ubicacionesDeEscalera(
  db: Db,
  args: { programId: string; dealIds: readonly string[]; vendidos: ReadonlySet<string> },
  ahora: Date = new Date(),
): Promise<{ corteDias: number | null; porDeal: Map<string, UbicacionEnLaEscalera> }> {
  if (args.dealIds.length === 0) {
    const [programa] = await db.select({ corte: programs.cortePagoRapidoDias }).from(programs).where(eq(programs.id, args.programId));
    return { corteDias: programa?.corte ?? null, porDeal: new Map() };
  }
  const [[programa], filasAbonos, filasCitas] = await Promise.all([
    db.select({ corte: programs.cortePagoRapidoDias }).from(programs).where(eq(programs.id, args.programId)),
    db.select({ dealId: abonos.dealId, primero: sql<string>`min(${abonos.fecha})` }).from(abonos)
      .where(and(eq(abonos.programId, args.programId), inArray(abonos.dealId, [...args.dealIds]),
        eq(abonos.concepto, "ticket"), vigente(abonos)))
      .groupBy(abonos.dealId),
    db.select({
      dealId: calls.dealId,
      dia: fechaAnclaCall(),
      instante: sql<Date>`coalesce(${calls.fechaAgenda}, ${calls.fechaLlamada})`,
      fallida: sql<boolean>`${calls.resultado} in (${sql.raw(RESULTADOS_FALLIDOS.map((r) => `'${r}'`).join(", "))})`,
      atendida: sql<boolean>`${calls.resultado} in (${sql.raw(RESULTADOS_QUE_OCURRIERON.map((r) => `'${r}'`).join(", "))})`,
    }).from(calls).where(and(eq(calls.programId, args.programId), inArray(calls.dealId, [...args.dealIds]), vigente(calls))),
  ]);
  const primerAbono = new Map(filasAbonos.map((fila) => [fila.dealId, diaDeCalendario(fila.primero)]));
  const citasPorDeal = new Map<string, { atendidas: string[]; vencida: boolean }>();
  for (const cita of filasCitas) {
    if (cita.dealId === null) continue;
    const acumulado = citasPorDeal.get(cita.dealId) ?? { atendidas: [], vencida: false };
    if (cita.atendida) acumulado.atendidas.push(diaDeCalendario(cita.dia));
    else if (cita.fallida && new Date(cita.instante).getTime() <= ahora.getTime()) acumulado.vencida = true;
    citasPorDeal.set(cita.dealId, acumulado);
  }
  const corteDias = programa?.corte ?? null;
  const porDeal = new Map<string, UbicacionEnLaEscalera>();
  for (const dealId of args.dealIds) {
    const citas = citasPorDeal.get(dealId);
    porDeal.set(dealId, escalonDeDeal({
      vendido: args.vendidos.has(dealId),
      primerAbono: primerAbono.get(dealId) ?? null,
      citasAtendidas: citas?.atendidas ?? [],
      citaVencidaSinAtender: citas?.vencida ?? false,
    }, corteDias));
  }
  return { corteDias, porDeal };
}

/** Carga la escalera de un programa en un periodo: el escalón de cada deal de su universo. */
export async function cargarEscalera(
  db: Db,
  alcance: { programId: string; rango: Rango },
  ahora: Date = new Date(),
): Promise<EscaleraCargada> {
  const { programId, rango } = alcance;
  const [dias, filasDeals] = await Promise.all([
    // La venta de un deal y su día vienen de la UNICA definición de venta; se pide de siempre y
    // se reparte en memoria: un deal vendido ayer no es "sin vender" aunque se creara este mes.
    // `ventasConDiaEn` no filtra por programa: se une a `deals` (vigente, INLINE) y se acota aquí.
    ventasDelPrograma(db, programId),
    db.select({
      id: deals.id,
      etapa: deals.etapa,
      cohorteId: deals.cohortId,
      ownerUserId: deals.ownerUserId,
      ownerCloserId: users.closerId,
      ownerNombre: users.nombre,
      ownerEmail: users.email,
      calidad: submissions.leadQuality,
      envioId: submissions.id,
      envio: columnasUtmDelEnvio,
      creado: dimensionesDeFecha(deals.createdAt).dia,
    }).from(deals)
      .leftJoin(users, eq(users.id, deals.ownerUserId))
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(and(eq(deals.programId, programId), eq(deals.cortesia, false), vigente(deals))),
  ]);

  const diaDeVenta = new Map(dias.map((fila) => [fila.dealId, diaDeCalendario(fila.dia)]));
  const enRango = (dia: string) => dia >= rango.desde && dia <= rango.hasta;
  const incluidos = filasDeals.filter((deal) => {
    const venta = diaDeVenta.get(deal.id);
    const creado = diaDeCalendario(deal.creado);
    return (venta !== undefined && enRango(venta)) || (venta === undefined && enRango(creado));
  });
  const vendidosEnPeriodo = new Set(incluidos.filter((deal) => diaDeVenta.has(deal.id)).map((deal) => deal.id));
  const ubicaciones = await ubicacionesDeEscalera(db, {
    programId, dealIds: incluidos.map((deal) => deal.id), vendidos: vendidosEnPeriodo,
  }, ahora);
  const resultado: DealEnLaEscalera[] = [];
  for (const deal of incluidos) {
    const venta = diaDeVenta.get(deal.id);
    const creado = diaDeCalendario(deal.creado);
    // Vendidos en el periodo (1 a 4) o creados en el periodo sin vender nunca (5 a 7).
    const vendidoEnElPeriodo = venta !== undefined && enRango(venta);
    const ubicacion = ubicaciones.porDeal.get(deal.id)!;
    resultado.push({
      ...ubicacion,
      dealId: deal.id,
      fecha: vendidoEnElPeriodo ? venta : creado,
      etapa: deal.etapa,
      closer: deal.ownerUserId === null
        ? null
        : etiquetaDeCloser({ closerId: deal.ownerCloserId, nombre: deal.ownerNombre, email: deal.ownerEmail }),
      claveCloser: deal.ownerUserId ?? CLAVE_SIN_DUENO,
      ownerUserId: deal.ownerUserId,
      ownerCloserId: deal.ownerCloserId,
      cohorteId: deal.cohorteId,
      calidad: deal.calidad && deal.calidad.trim() !== "" ? deal.calidad : SIN_CALIDAD,
      envio: deal.envioId === null ? null : deal.envio,
    });
  }
  // Más antiguos primero, como toda lista.
  resultado.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.dealId.localeCompare(b.dealId));
  return { corteDias: ubicaciones.corteDias, deals: resultado };
}

/** Las dimensiones por las que se abre la escalera (lista blanca, contrato C-2). */
export type DimensionDeEscalera = "closer" | "calidad" | "cohorte";

export interface FiltrosDeEscalera {
  escalon?: Escalon;
  /** Varios escalones a la vez (Pauta: "ventas" son los cuatro que pagaron). Si viene, manda sobre `escalon`. */
  escalones?: readonly Escalon[];
  /** Solo ventas: pago completo (`ganado_completo`) o parcial (`ganado_parcial`). */
  pago?: "completo" | "parcial";
  claveCloser?: string | null;
  calidad?: string;
  cohorteId?: string;
}

/**
 * El filtro de closer, con la MISMA regla que `porClaveDeDeal` (la de la lista `cierres`): una cuenta casa
 * por `owner_user_id`; la clave histórica vacía, los deals sin dueño; y una clave histórica con texto, los
 * deals cuyo dueño tiene ese `users.closer_id` (normalizado, ADR 0030). Una clave inválida no filtra.
 */
function delCloser(deal: DealEnLaEscalera, claveCloser: string | null | undefined): boolean {
  const clave = parsearClaveCloser(claveCloser);
  if (clave === null) return true;
  if (clave.tipo === "usuario") return deal.ownerUserId === clave.userId;
  if (clave.clave === "") return deal.ownerUserId === null;
  return deal.ownerUserId !== null && normalizarCloserId(deal.ownerCloserId) === normalizarCloserId(clave.clave);
}

/** Los deals que cumplen los filtros: la cifra, el desglose y la lista salen de aquí. */
export function filtrarEscalera(cargada: EscaleraCargada, filtros: FiltrosDeEscalera): DealEnLaEscalera[] {
  return cargada.deals.filter((deal) =>
    delCloser(deal, filtros.claveCloser)
    && (!filtros.calidad || deal.calidad === filtros.calidad)
    && (!filtros.cohorteId || deal.cohorteId === filtros.cohorteId)
    && (!filtros.escalon || deal.escalon === filtros.escalon)
    && (!filtros.escalones || filtros.escalones.includes(deal.escalon))
    && (!filtros.pago || deal.etapa === (filtros.pago === "completo" ? "ganado_completo" : "ganado_parcial")));
}

export interface LineaDeEscalon {
  escalon: Escalon;
  deals: number;
  /** Sobre todos los deals del universo filtrado; nulo si no hay ninguno (base cero). */
  porcentaje: number | null;
  /** Mediana de días hábiles de la cita al primer abono; solo en los escalones 2 y 3. */
  diasMedianos: number | null;
}

export interface ResumenDeEscalera {
  total: number;
  lineas: LineaDeEscalon[];
  /** El programa no definió el corte: "pagó rápido" no existe y sus pagos están en "pagó después". */
  sinCorte: boolean;
}

export function medianaDe(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[medio]! : (ordenados[medio - 1]! + ordenados[medio]!) / 2;
}

/** La distribución por escalón de un conjunto de deals, con su porcentaje y los días medianos. */
export function resumirEscalera(delConjunto: readonly DealEnLaEscalera[], corteDias: number | null): ResumenDeEscalera {
  const total = delConjunto.length;
  return {
    total,
    sinCorte: corteDias === null,
    lineas: ESCALONES.map((escalon) => {
      const delEscalon = delConjunto.filter((deal) => deal.escalon === escalon);
      const dias = delEscalon.flatMap((deal) => (deal.diasCitaAPago === null ? [] : [deal.diasCitaAPago]));
      return {
        escalon,
        deals: delEscalon.length,
        porcentaje: total === 0 ? null : (delEscalon.length / total) * 100,
        diasMedianos: escalon === "pago_rapido" || escalon === "pago_despues" ? medianaDe(dias) : null,
      };
    }),
  };
}

export interface GrupoDeEscalera {
  /** La clave de la dimensión: `users.id`/`historico:` del closer, la calidad o el id de la cohorte. */
  clave: string;
  etiqueta: string;
  resumen: ResumenDeEscalera;
}

/** La escalera abierta por una dimensión de la lista blanca (closer, calidad o cohorte). */
export function agruparEscalera(
  cargada: EscaleraCargada,
  dimension: DimensionDeEscalera,
  filtros: FiltrosDeEscalera = {},
): GrupoDeEscalera[] {
  const delConjunto = filtrarEscalera(cargada, { ...filtros, escalon: undefined });
  const grupos = new Map<string, { etiqueta: string; deals: DealEnLaEscalera[] }>();
  for (const deal of delConjunto) {
    const [clave, etiqueta] = dimension === "closer"
      ? [deal.claveCloser, deal.closer ?? "Sin closer"]
      : dimension === "calidad"
        ? [deal.calidad, deal.calidad]
        : [deal.cohorteId ?? "", deal.cohorteId ?? "Sin cohorte"];
    const grupo = grupos.get(clave) ?? { etiqueta, deals: [] };
    grupo.deals.push(deal);
    grupos.set(clave, grupo);
  }
  return [...grupos]
    .map(([clave, { etiqueta, deals: delGrupo }]) => ({ clave, etiqueta, resumen: resumirEscalera(delGrupo, cargada.corteDias) }))
    .sort((a, b) => b.resumen.total - a.resumen.total || a.etiqueta.localeCompare(b.etiqueta));
}

/**
 * LA función de la escalera (ADR 0109 punto 4): carga el programa y entrega el resumen del
 * conjunto pedido. Una vista que necesite más (desglose, lista) usa `cargarEscalera` UNA vez y
 * `filtrarEscalera`/`agruparEscalera` sobre lo cargado.
 */
export async function escaleraDeDeals(
  db: Db,
  alcance: { programId: string; rango: Rango },
  filtros: FiltrosDeEscalera = {},
): Promise<ResumenDeEscalera> {
  const cargada = await cargarEscalera(db, alcance);
  return resumirEscalera(filtrarEscalera(cargada, { ...filtros, escalon: undefined }), cargada.corteDias);
}
