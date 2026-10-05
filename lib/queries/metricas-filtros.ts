import { and, asc, between, eq, gt, inArray, isNull, lte, notExists, notInArray, or, sql } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { abonos, calls, deals, dealEtapaHistorial, leads, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { vigente } from "@/lib/queries/vigente";
import type { Alcance } from "@/lib/queries/dashboard";
import {
  claveCloserSql,
  claveDeCloserSql,
  igualCloser,
  parsearClaveCloser,
} from "@/lib/closers/identidad";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import { ETAPAS_EN_ORDEN, ETAPAS_VENDIDAS, type EtapaDeal } from "@/lib/deals/etapas";
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
 * Condicion de closer sobre una fila que tiene FK + texto historico (ticket 167,
 * Decision 7). `claveCloser` es `users.id` (cuenta) o `historico:<texto>`:
 *
 *  - cuenta: casa la FK, y ADEMAS las filas historicas SIN FK cuyo texto es el de
 *    ESE usuario (subconsulta por id; si el usuario no tiene `closer_id`, la rama
 *    historica no casa nada).
 *  - historico: solo las filas sin FK cuyo texto normaliza igual.
 *
 * Nunca compara texto en crudo (ADR 0030). Devuelve `undefined` si la clave no es
 * valida: el `and()` de drizzle lo descarta y la consulta no se filtra.
 */
function porClaveConFk(
  columnaUserId: PgColumn,
  columnaTexto: PgColumn,
  claveCloser: string | null | undefined,
  db: Db,
) {
  const clave = parsearClaveCloser(claveCloser);
  if (clave == null) return undefined;
  if (clave.tipo === "historico") {
    return and(isNull(columnaUserId), igualCloser(columnaTexto, clave.clave));
  }
  // El texto historico de ESTE usuario, resuelto por id: una fila vieja sin FK que
  // trae el mismo texto que su `closer_id` tambien es suya. Sin `closer_id`, el
  // `in (...)` queda vacio y la rama historica no suma nada.
  const textoDelUsuario = db.select({ clave: claveDeCloserSql(users.closerId) })
    .from(users)
    .where(eq(users.id, clave.userId));
  return or(
    eq(columnaUserId, clave.userId),
    and(isNull(columnaUserId), inArray(claveDeCloserSql(columnaTexto), textoDelUsuario)),
  );
}

/**
 * Condicion de closer sobre `deals`, cuyo dueno es SIEMPRE una FK (`owner_user_id`,
 * ADR 0037). Para una clave de cuenta se filtra por el id; para una historica se cae
 * al texto de `users.closerId` del dueno (el comportamiento previo al ticket 167),
 * que exige el join de `users` por `deals.ownerUserId` del llamador.
 */
export function porClaveDeDeal(claveCloser: string | null | undefined) {
  const clave = parsearClaveCloser(claveCloser);
  if (clave == null) return undefined;
  if (clave.tipo === "usuario") return eq(deals.ownerUserId, clave.userId);
  return igualCloser(users.closerId, clave.clave);
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
  return claveCloserSql(abonos.registradoPorUserId, abonos.closerId);
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
 * La REVERSA de una venta (ticket 200): salir de Abonado o Completo hacia una etapa abierta. Solo la
 * escribe A1, al anular el abono que habia vendido el deal: un error de tecleo, no un resultado del
 * negocio. Completo -> Abonado (A2) sigue vendido y Abonado -> Cierre Perdido (P) es una venta que
 * despues se perdio (ADR 0038): ninguna de las dos es reversa. La usan el SQL de abajo y el embudo
 * por etapas en memoria (`esReversaDeVenta`), con la misma lista.
 */
export const DESTINOS_DE_REVERSA: readonly EtapaDeal[] = ETAPAS_EN_ORDEN.filter(
  (etapa) => !ETAPAS_VENDIDAS.includes(etapa) && etapa !== "cierre_perdido",
);

export function esReversaDeVenta(de: EtapaDeal | null, a: EtapaDeal): boolean {
  return de != null && ETAPAS_VENDIDAS.includes(de) && DESTINOS_DE_REVERSA.includes(a);
}

const reversaDeVenta = alias(dealEtapaHistorial, "reversa_de_venta");

/**
 * Las dos piezas que definen una venta: que movimientos cuentan y en que dia cae la primera.
 * Una cortesía no es una venta (ADR 0071 punto 10).
 * `vendidosEn` y `ventasConDiaEn` solo difieren en la proyeccion (ticket 089).
 *
 * Cuenta un movimiento que vendio el deal y que NINGUNA reversa posterior deshizo (ticket 200): el dia
 * de la venta es la primera entrada a Abonado o Completo despues de la ultima reversa, y un deal cuyo
 * unico abono se anulo deja de ser venta en toda metrica. La subconsulta va con operadores de drizzle
 * sobre un alias, no con la plantilla `sql`, para que las columnas salgan calificadas (AGENTS.md).
 */
export const esMovimientoDeVenta = (db: Db) => and(
  inArray(dealEtapaHistorial.a, [...ETAPAS_VENDIDAS]),
  notExists(
    db
      .select({ id: reversaDeVenta.id })
      .from(reversaDeVenta)
      .where(and(
        eq(reversaDeVenta.dealId, dealEtapaHistorial.dealId),
        inArray(reversaDeVenta.de, [...ETAPAS_VENDIDAS]),
        inArray(reversaDeVenta.a, [...DESTINOS_DE_REVERSA]),
        gt(reversaDeVenta.fecha, dealEtapaHistorial.fecha),
      )),
  ),
);
const vendidoEnElRango = (rango: Rango) => between(diaDeVenta(), rango.desde, rango.hasta);

export function vendidosEn(db: Db, rango: Rango) {
  return db
    .select({ dealId: dealEtapaHistorial.dealId })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.cortesia, false), vigente(deals)))
    .where(esMovimientoDeVenta(db))
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
    .where(esMovimientoDeVenta(db))
    .groupBy(dealEtapaHistorial.dealId)
    .having(vendidoEnElRango(rango));
}

export function llamadaOcurrio() {
  return inArray(calls.resultado, [...RESULTADOS_QUE_OCURRIERON]);
}


/** Una definición del universo por métrica; la vigencia queda visible en cada lector. */
export function filtroCaja({ programId, rango, claveCloser }: Alcance, db: Db) {
  return and(
    eq(abonos.programId, programId),
    between(abonos.fecha, rango.desde, rango.hasta),
    porClaveConFk(abonos.registradoPorUserId, abonos.closerId, claveCloser, db),
  );
}

export function filtroLlamadas({ programId, rango, claveCloser }: Alcance, db: Db) {
  return and(
    eq(calls.programId, programId),
    between(fechaAnclaCall(), rango.desde, rango.hasta),
    porClaveConFk(calls.closerUserId, calls.closerId, claveCloser, db),
  );
}

export function filtroCierres(alcance: Alcance, db: Db) {
  return and(
    eq(deals.programId, alcance.programId),
    inArray(deals.id, vendidosEn(db, alcance.rango)),
    porClaveDeDeal(alcance.claveCloser),
  );
}

export function cortesiasEn(db: Db, rango: Rango) {
  return db
    .select({ dealId: dealEtapaHistorial.dealId })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.cortesia, true), vigente(deals)))
    .where(esMovimientoDeVenta(db))
    .groupBy(dealEtapaHistorial.dealId)
    .having(vendidoEnElRango(rango));
}

export function filtroCortesias(alcance: Alcance, db: Db) {
  return and(
    eq(deals.programId, alcance.programId),
    inArray(deals.id, cortesiasEn(db, alcance.rango)),
    porClaveDeDeal(alcance.claveCloser),
  );
}

export function fechaAnclaLead() {
  return sql<string>`(${leads.fechaPrimeraAplicacion} AT TIME ZONE 'America/Bogota')::date`;
}

export function filtroLeads({ programId, rango, claveCloser }: Alcance) {
  return and(
    eq(leads.programId, programId),
    eq(leads.entrada, "formulario"),
    between(fechaAnclaLead(), rango.desde, rango.hasta),
    // No hay atribución por closer de esta métrica: jamás devolver el programa entero.
    claveCloser ? sql`false` : undefined,
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
export function filtroDealsCreados({ programId, rango, claveCloser }: Alcance) {
  return and(
    eq(deals.programId, programId),
    between(fechaAnclaDealCreado(), rango.desde, rango.hasta),
    claveCloser ? sql`false` : undefined,
  );
}

export function filtroAgendasCreadas({ programId, rango, claveCloser }: Alcance) {
  return and(
    eq(calls.programId, programId),
    between(fechaAnclaAgendaCreada(), rango.desde, rango.hasta),
    claveCloser ? sql`false` : undefined,
  );
}

/** El movimiento que da fecha a la venta, sin correlación ni duplicar sus etapas. */
export function primerosMovimientosDeVenta(db: Db) {
  return db
    .selectDistinctOn([dealEtapaHistorial.dealId], { id: dealEtapaHistorial.id })
    .from(dealEtapaHistorial)
    .where(esMovimientoDeVenta(db))
    .orderBy(dealEtapaHistorial.dealId, dealEtapaHistorial.fecha, dealEtapaHistorial.id);
}

/** Las citas cuyo resultado explícito fue no show, dentro del universo común de llamadas. */
export function filtroNoShows(alcance: Alcance, db: Db) {
  return and(filtroLlamadas(alcance, db), eq(calls.resultado, "no_show"));
}

export const ETAPAS_CERRADAS: readonly EtapaDeal[] = ["ganado_completo", "cierre_perdido"];

/**
 * Una cita ya vencida cuyo resultado sigue pendiente. El reloj entra como parámetro.
 * El llamador debe haber unido `deals`.
 */
export function llamadaPasadaSinResultado(ahora: Date) {
  return and(
    eq(calls.resultado, "agendada"),
    lte(calls.fechaAgenda, ahora),
    notInArray(deals.etapa, [...ETAPAS_CERRADAS]),
  );
}
