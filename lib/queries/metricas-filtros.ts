import { and, asc, between, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { abonos, calls, deals, dealEtapaHistorial, leads, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { vigente } from "@/lib/queries/vigente";
import type { Alcance } from "@/lib/queries/dashboard";
import { claveDeCloserSql, igualCloser } from "@/lib/closers/identidad";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import { ETAPAS_VENDIDAS } from "@/lib/deals/etapas";
import type { Rango } from "@/lib/queries/dashboard";

/**
 * Fecha de calendario (Bogota) que ancla una fila de `calls`. Todo el embudo de
 * llamadas se ancla en UNA sola fecha por fila: `coalesce(fechaAgenda, fechaLlamada)`.
 * Asi `agendas` (todas las filas del rango) y sus subconjuntos `llamadasConShow` y
 * `cierres` salen del mismo universo, y las dos tasas cuadran. El `coalesce` evita
 * perder en silencio las filas viejas de Sheets que traen `fechaLlamada` pero no
 * `fechaAgenda`.
 *
 * Los timestamp son `timestamp with time zone`: se convierten a fecha de calendario
 * en Bogota ANTES de comparar. Comparar el timestamp crudo meteria el sesgo de zona
 * (una llamada del 15-sep 22:00 Bogota contaria como del 16-sep).
 */
export function fechaAnclaCall() {
  return sql<string>`(coalesce(${calls.fechaAgenda}, ${calls.fechaLlamada}) AT TIME ZONE 'America/Bogota')::date`;
}

/**
 * Condicion opcional de closer. `and()` de drizzle descarta los `undefined`, asi que
 * sin closer la consulta queda exactamente igual que antes del ticket 005: el filtro
 * no puede cambiar el total del programa.
 */
export function delCloser(columna: PgColumn, closerId: string | null | undefined) {
  // Sin distinguir mayusculas (ADR 0030): `Mani` y `mani` son el mismo closer, y
  // la respuesta a eso vive en `lib/closers/identidad.ts`, no aca.
  return closerId == null ? undefined : igualCloser(columna, closerId);
}

/**
 * Etiqueta visible de quien registro un abono. La FK manda para filas nuevas; solo
 * una fila historica sin FK cae al texto copiado, hasta el corte del ticket 159.
 */
export function closerDeAbono() {
  return sql<string | null>`case
    when ${abonos.registradoPorUserId} is not null
      then coalesce(${users.closerId}, ${users.nombre}, ${users.email})
    else ${abonos.closerId}
  end`;
}

/** Identidad de agrupacion: UUID para lo nuevo, texto normalizado solo para la historia. */
export function claveDeRegistradorDeAbono() {
  return sql<string>`case
    when ${users.id} is not null then ${users.id}::text
    else 'historico:' || coalesce(${claveDeCloserSql(abonos.closerId)}, '')
  end`;
}

export { ETAPAS_VENDIDAS };
/**
 * La fecha de VENTA de cada deal: el dia (Bogota) de su PRIMERA entrada a Ganado Pago Parcial o Ganado Pagado Completo.
 * Es la unica respuesta a "¿cuando se vendio?": la usan las consultas de cierres de este modulo
 * y la burbuja del origen declarado (`origen-declarado.ts`, ticket 121).
 *
 * 🩸 Contar cualquier fila del historial que llegue a Ganado Pago Parcial o Ganado Pagado Completo dentro del rango
 * (como se hacia hasta el 29-sep) cuenta la MISMA venta en dos periodos: un deal que pasa a
 * Abonado en septiembre y a Completo en octubre salia como cierre en los dos meses, y la
 * comision (ticket 062) se habria pagado dos veces. Sin error y con cifras creibles.
 */
function diaDeVenta() {
  return sql<string>`(min(${dealEtapaHistorial.fecha}) AT TIME ZONE 'America/Bogota')::date`;
}

/**
 * Las dos piezas que definen una venta: que movimientos cuentan y en que dia cae la primera.
 * Una cortesía no es una venta (ADR 0071 punto 10).
 * `vendidosEn` y `ventasConDiaEn` solo difieren en la proyeccion (ticket 089): sin subconsulta,
 * para que el guardian de vigencia siga leyendo cada cadena.
 */
export const esMovimientoDeVenta = () => inArray(dealEtapaHistorial.a, [...ETAPAS_VENDIDAS]);
const vendidoEnElRango = (rango: Rango) => between(diaDeVenta(), rango.desde, rango.hasta);

export function vendidosEn(db: Db, rango: Rango) {
  return db
    .select({ dealId: dealEtapaHistorial.dealId })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.cortesia, false), vigente(deals)))
    .where(esMovimientoDeVenta())
    .groupBy(dealEtapaHistorial.dealId)
    .having(vendidoEnElRango(rango));
}

export const ETAPAS_DE_CIERRE = [...ETAPAS_VENDIDAS, "cierre_perdido"] as const;

/**
 * Los deals CERRADOS en el rango (ticket 141): la "Close date" de HubSpot, que vale para los
 * ganados y los perdidos. Es el dia (Bogota) en que el deal entro a su cierre ACTUAL: la primera
 * entrada a Abonado, Completo o Cierre Perdido despues de su ultima reapertura.
 *
 * - Abonado y despues Completo es UN cierre: cuenta el dia de Abonado, como `diaDeVenta`.
 * - Un perdido que se recupera (Cierre Perdido -> En Contacto, transicion R) deja de estar
 *   cerrado: su fecha vieja no cuenta, y si despues se vende, cierra el dia de la venta.
 * - Un deal abierto no tiene fecha de cierre.
 *
 * Se decide en memoria sobre el historial de los deals vigentes del programa (sin subconsultas
 * correlacionadas, AGENTS.md): a esta escala es gratis y la regla se lee. No es una venta: para
 * eso esta `vendidosEn`.
 */
export async function cerradosEn(db: Db, programId: string, rango: Rango): Promise<string[]> {
  const historial = await db
    .select({ dealId: dealEtapaHistorial.dealId, a: dealEtapaHistorial.a, fecha: dealEtapaHistorial.fecha })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.programId, programId), vigente(deals)))
    .orderBy(asc(dealEtapaHistorial.fecha), asc(dealEtapaHistorial.id));

  // Recorrido en orden: una entrada abierta borra el cierre; la primera cerrada despues lo fija.
  const cierre = new Map<string, Date | null>();
  for (const h of historial) {
    if (!esEtapaDeCierre(h.a)) cierre.set(h.dealId, null);
    else if (!cierre.get(h.dealId)) cierre.set(h.dealId, h.fecha);
  }
  return [...cierre]
    .filter(([, fecha]) => {
      if (!fecha) return false;
      const dia = diaDeCalendario(fecha);
      return dia >= rango.desde && dia <= rango.hasta;
    })
    .map(([dealId]) => dealId);
}

function esEtapaDeCierre(etapa: string): boolean {
  return (ETAPAS_DE_CIERRE as readonly string[]).includes(etapa);
}

/** Lo mismo que `vendidosEn`, con el dia de la venta. */
export function ventasConDiaEn(db: Db, rango: Rango) {
  return db
    .select({ dealId: dealEtapaHistorial.dealId, dia: diaDeVenta() })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.cortesia, false), vigente(deals)))
    .where(esMovimientoDeVenta())
    .groupBy(dealEtapaHistorial.dealId)
    .having(vendidoEnElRango(rango));
}

export function llamadaOcurrio() {
  return inArray(calls.resultado, [...RESULTADOS_QUE_OCURRIERON]);
}


/** Una definición del universo por métrica; la vigencia queda visible en cada lector. */
export function filtroCaja({ programId, rango, closerId }: Alcance, db: Db) {
  const usuariosDelCloser = closerId == null
    ? undefined
    : db.select({ id: users.id }).from(users).where(igualCloser(users.closerId, closerId));
  return and(
    eq(abonos.programId, programId),
    between(abonos.fecha, rango.desde, rango.hasta),
    closerId == null
      ? undefined
      : or(
          and(isNotNull(abonos.registradoPorUserId), inArray(abonos.registradoPorUserId, usuariosDelCloser!)),
          and(isNull(abonos.registradoPorUserId), igualCloser(abonos.closerId, closerId)),
        ),
  );
}

export function filtroLlamadas({ programId, rango, closerId }: Alcance) {
  return and(
    eq(calls.programId, programId),
    between(fechaAnclaCall(), rango.desde, rango.hasta),
    delCloser(calls.closerId, closerId),
  );
}

export function filtroCierres(alcance: Alcance, db: Db) {
  return and(
    eq(deals.programId, alcance.programId),
    inArray(deals.id, vendidosEn(db, alcance.rango)),
    delCloser(users.closerId, alcance.closerId),
  );
}

export function cortesiasEn(db: Db, rango: Rango) {
  return db
    .select({ dealId: dealEtapaHistorial.dealId })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.cortesia, true), vigente(deals)))
    .where(esMovimientoDeVenta())
    .groupBy(dealEtapaHistorial.dealId)
    .having(vendidoEnElRango(rango));
}

export function filtroCortesias(alcance: Alcance, db: Db) {
  return and(
    eq(deals.programId, alcance.programId),
    inArray(deals.id, cortesiasEn(db, alcance.rango)),
    delCloser(users.closerId, alcance.closerId),
  );
}

export function fechaAnclaLead() {
  return sql<string>`(${leads.fechaPrimeraAplicacion} AT TIME ZONE 'America/Bogota')::date`;
}

export function filtroLeads({ programId, rango, closerId }: Alcance) {
  return and(
    eq(leads.programId, programId),
    eq(leads.entrada, "formulario"),
    between(fechaAnclaLead(), rango.desde, rango.hasta),
    // No hay atribución por closer de esta métrica: jamás devolver el programa entero.
    closerId ? sql`false` : undefined,
  );
}

/**
 * El dia (Bogota) en que nacio un deal (ticket 138, GC-07): el de su envio de origen, que es
 * cuando la persona lleno el formulario; sin envio (historico o alta manual), su alta en el CRM.
 * Exige un `left join` de `submissions` por `deals.submissionOrigenId`.
 */
export function fechaAnclaDealCreado() {
  return sql<string>`(coalesce(${submissions.fechaEnvio}, ${deals.createdAt}) AT TIME ZONE 'America/Bogota')::date`;
}

/**
 * El dia (Bogota) en que se AGENDO una llamada (ticket 138): cuando entro su fila, por el
 * webhook de Calendly o a mano. No es `fechaAgenda`, que es el dia de la cita: una agenda hecha
 * hoy para el martes es una agenda de hoy. Es la misma fecha que usa la vista interina de Pauta.
 */
export function fechaAnclaAgendaCreada() {
  return sql<string>`(${calls.createdAt} AT TIME ZONE 'America/Bogota')::date`;
}

/**
 * Generar deals y agendas es del programa, no de un closer: un deal nace sin dueño. Como los
 * leads, con closer no se devuelve nada, jamas el programa entero. Exige el join de arriba.
 */
export function filtroDealsCreados({ programId, rango, closerId }: Alcance) {
  return and(
    eq(deals.programId, programId),
    between(fechaAnclaDealCreado(), rango.desde, rango.hasta),
    closerId ? sql`false` : undefined,
  );
}

export function filtroAgendasCreadas({ programId, rango, closerId }: Alcance) {
  return and(
    eq(calls.programId, programId),
    between(fechaAnclaAgendaCreada(), rango.desde, rango.hasta),
    closerId ? sql`false` : undefined,
  );
}

/** El movimiento que da fecha a la venta, sin correlación ni duplicar sus etapas. */
export function primerosMovimientosDeVenta(db: Db) {
  return db
    .selectDistinctOn([dealEtapaHistorial.dealId], { id: dealEtapaHistorial.id })
    .from(dealEtapaHistorial)
    .where(esMovimientoDeVenta())
    .orderBy(dealEtapaHistorial.dealId, dealEtapaHistorial.fecha, dealEtapaHistorial.id);
}

/** Las citas cuyo resultado explícito fue no show, dentro del universo común de llamadas. */
export function filtroNoShows(alcance: Alcance) {
  return and(filtroLlamadas(alcance), eq(calls.resultado, "no_show"));
}
