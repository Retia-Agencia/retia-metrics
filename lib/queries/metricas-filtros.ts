import { and, asc, between, eq, gt, inArray, isNotNull, isNull, lte, ne, notExists, notInArray, or, sql } from "drizzle-orm";
import { alias, type PgColumn } from "drizzle-orm/pg-core";
import { abonos, calls, deals, dealEtapaHistorial, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { vigente } from "@/lib/queries/vigente";
import type { Alcance } from "@/lib/queries/dashboard";
import {
  claveCloserSql,
  etiquetaDeCloserSql,
  claveDeCloserSql,
  igualCloser,
  parsearClaveCloser,
} from "@/lib/closers/identidad";
import { noAsistioSql, ocurrioSql } from "@/lib/deals/resultados-de-llamada";
import { ETAPAS_EN_ORDEN, ETAPAS_VENDIDAS, type EtapaDeal } from "@/lib/deals/etapas";
import type { Rango } from "@/lib/queries/dashboard";
import { diaDeCreacionDelDeal, diaDeEnvio, diaEnBogota } from "@/lib/queries/hechos/fechas";

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
  return diaEnBogota(sql`coalesce(${calls.fechaAgenda}, ${calls.fechaLlamada})`);
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
    // La clave histórica vacía es la fila "sin closer" del comparativo (ticket 188): sin FK y sin
    // texto. Comparar el texto contra `null` no casaría nada y su celda no abriría lista.
    if (clave.clave === "") {
      return and(isNull(columnaUserId), sql`coalesce(${claveDeCloserSql(columnaTexto)}, '') = ''`);
    }
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
  // La clave histórica vacía es "sin dueño" (ticket 188): la fila del comparativo sin closer.
  if (clave.clave === "") return isNull(deals.ownerUserId);
  return igualCloser(users.closerId, clave.clave);
}

/**
 * Etiqueta visible de quien registro un abono. La FK manda para filas nuevas; solo
 * una fila historica sin FK cae al texto copiado, hasta el corte del ticket 159.
 */
export function closerDeAbono() {
  return sql<string | null>`case
    when ${abonos.registradoPorUserId} is not null
      then ${etiquetaDeCloserSql()}
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
 * Es la unica respuesta a "¿cuando se vendio?": la usan las consultas de cierres de este modulo.
 *
 * 🩸 Contar cualquier fila del historial que llegue a Ganado Pago Parcial o Ganado Pagado Completo dentro del rango
 * (como se hacia hasta el 29-sep) cuenta la MISMA venta en dos periodos: un deal que pasa a
 * Abonado en septiembre y a Completo en octubre salia como cierre en los dos meses, y la
 * comision (ticket 062) se habria pagado dos veces. Sin error y con cifras creibles.
 */
function diaDeVenta() {
  return diaEnBogota(sql`min(${dealEtapaHistorial.fecha})`);
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
/**
 * El predicado de venta sobre el deal (352, DA-1, Mani 3-nov): su etapa ACTUAL es Abonado o Completo.
 * Un deal que pasa a Cierre Perdido deja de ser venta y cuenta como perdido, en toda metrica a la vez.
 * Es la gemela SQL de `esEtapaVendida` (`lib/deals/etapas.ts`) y la UNICA lista de etapas con que se
 * cuenta una venta (guardian: `tests/venta-una-definicion.test.ts`).
 */
export const etapaVendida = () => inArray(deals.etapa, [...ETAPAS_VENDIDAS]);

const vendidoEnElRango = (rango: Rango) => between(diaDeVenta(), rango.desde, rango.hasta);

export function vendidosEn(db: Db, rango: Rango) {
  return db
    .select({ dealId: dealEtapaHistorial.dealId })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.cortesia, false), etapaVendida(), vigente(deals)))
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
export async function cerradosEn(db: Db, programId: string, rango: Rango, cohorteId?: string | null): Promise<string[]> {
  const historial = await db
    .select({ dealId: dealEtapaHistorial.dealId, a: dealEtapaHistorial.a, fecha: dealEtapaHistorial.fecha })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.programId, programId), cohorteId ? eq(deals.cohortId, cohorteId) : undefined, vigente(deals)))
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
    .select({ dealId: dealEtapaHistorial.dealId, dia: diaDeVenta().as("dia") })
    .from(dealEtapaHistorial)
    .innerJoin(deals, and(eq(deals.id, dealEtapaHistorial.dealId), eq(deals.cortesia, false), etapaVendida(), vigente(deals)))
    .where(esMovimientoDeVenta(db))
    .groupBy(dealEtapaHistorial.dealId)
    .having(vendidoEnElRango(rango));
}

export function llamadaOcurrio() {
  return ocurrioSql();
}

/** Una cita viva: las canceladas se informan aparte y nunca inflan la cifra de Citas. */
export function citaNoCancelada() {
  return ne(calls.resultado, "cancelada");
}


/**
 * El filtro de COHORTE del Hub (377): un hecho pertenece a la cohorte de su deal (`deals.cohort_id`), sea
 * un abono, una llamada o el deal mismo. Sin cohorte (`null`/ausente, "Todas") no filtra. Es la UNICA
 * respuesta a "¿este hecho es de la cohorte C?": cifra, resumen y lista la importan de aquí. Un hecho sin
 * deal (una llamada suelta) no es de ninguna cohorte, así que con una cohorte elegida no cuenta.
 */
export function dealsDeLaCohorte(db: Db, programId: string, cohorteId: string) {
  return db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.programId, programId), eq(deals.cohortId, cohorteId), vigente(deals)));
}

export function porCohorteDeDeal(cohorteId: string | null | undefined) {
  return cohorteId ? eq(deals.cohortId, cohorteId) : undefined;
}

/** Una definición del universo por métrica; la vigencia queda visible en cada lector. */
export function filtroCaja({ programId, rango, claveCloser, cohorteId }: Alcance, db: Db) {
  return and(
    eq(abonos.programId, programId),
    between(abonos.fecha, rango.desde, rango.hasta),
    porClaveConFk(abonos.registradoPorUserId, abonos.closerId, claveCloser, db),
    cohorteId ? inArray(abonos.dealId, dealsDeLaCohorte(db, programId, cohorteId)) : undefined,
  );
}

export function filtroLlamadas({ programId, rango, claveCloser, cohorteId }: Alcance, db: Db) {
  return and(
    eq(calls.programId, programId),
    between(fechaAnclaCall(), rango.desde, rango.hasta),
    porClaveConFk(calls.closerUserId, calls.closerId, claveCloser, db),
    cohorteId ? inArray(calls.dealId, dealsDeLaCohorte(db, programId, cohorteId)) : undefined,
  );
}

export function filtroCierres(alcance: Alcance, db: Db) {
  return and(
    eq(deals.programId, alcance.programId),
    inArray(deals.id, vendidosEn(db, alcance.rango)),
    porClaveDeDeal(alcance.claveCloser),
    porCohorteDeDeal(alcance.cohorteId),
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
    porCohorteDeDeal(alcance.cohorteId),
  );
}

/**
 * UN ancla de fecha del lead (ADR 0115 N1, ticket 389): el dia de Bogota de su primera aplicacion.
 * Sin respaldo a proposito: la ingesta la escribe al nacer el lead (N6) y la base lo exige para un
 * lead de formulario; leer con `coalesce` escondia los que nacieron sin ella.
 */
export function fechaAnclaLead() {
  return diaEnBogota(leads.fechaPrimeraAplicacion);
}

/**
 * "¿Cuando entro a la base?" para la lista Leads: el instante de la primera aplicacion si vino del
 * formulario (la misma que `fechaAnclaLead`), y el alta si fue creado a mano (no aplico a nada). Es
 * una respuesta por TIPO de entrada, no un parche sobre un dato faltante.
 */
export function fechaDeEntradaDelLead() {
  return sql<Date>`case when ${leads.entrada} = 'formulario' then ${leads.fechaPrimeraAplicacion} else ${leads.createdAt} end`;
}

export function filtroLeads({ programId, rango, claveCloser, cohorteId }: Alcance, db?: Db) {
  return and(
    eq(leads.programId, programId),
    eq(leads.entrada, "formulario"),
    between(fechaAnclaLead(), rango.desde, rango.hasta),
    // No hay atribución por closer de esta métrica: jamás devolver el programa entero.
    claveCloser ? sql`false` : undefined,
    // Un lead es de la cohorte si tiene un deal vigente en ella.
    cohorteId && db
      ? inArray(leads.id, db.select({ id: deals.leadId }).from(deals).where(and(
          eq(deals.programId, programId), eq(deals.cohortId, cohorteId), vigente(deals))))
      : undefined,
  );
}

/**
 * El dia (Bogota) en que nacio un deal (ticket 138, GC-07): el de su envio de origen, que es
 * cuando la persona lleno el formulario; sin envio (historico o alta manual), su alta en el CRM.
 * Exige un `left join` de `submissions` por `deals.submissionOrigenId`.
 */
export function fechaAnclaDealCreado() {
  return diaDeCreacionDelDeal();
}

/**
 * El dia (Bogota) en que se AGENDO una llamada (ticket 138): cuando entro su fila, por el
 * webhook de Calendly o a mano. No es `fechaAgenda`, que es el dia de la cita: una agenda hecha
 * hoy para el martes es una agenda de hoy. Es la misma fecha que usa la vista interina de Pauta.
 */
export function fechaAnclaAgendaCreada() {
  return diaEnBogota(calls.createdAt);
}

/** El día (Bogotá) en que se completó un envío de formulario. */
export function fechaAnclaEnvio() {
  return diaDeEnvio();
}

/**
 * Generar deals y agendas es del programa, no de un closer: un deal nace sin dueño. Como los
 * leads, con closer no se devuelve nada, jamas el programa entero. Exige el join de arriba.
 */
export function filtroDealsCreados({ programId, rango, claveCloser, cohorteId }: Alcance) {
  return and(
    eq(deals.programId, programId),
    between(fechaAnclaDealCreado(), rango.desde, rango.hasta),
    claveCloser ? sql`false` : undefined,
    porCohorteDeDeal(cohorteId),
  );
}

export function filtroAgendasCreadas({ programId, rango, claveCloser, cohorteId }: Alcance, db?: Db) {
  return and(
    eq(calls.programId, programId),
    between(fechaAnclaAgendaCreada(), rango.desde, rango.hasta),
    claveCloser ? sql`false` : undefined,
    cohorteId && db ? inArray(calls.dealId, dealsDeLaCohorte(db, programId, cohorteId)) : undefined,
  );
}

/**
 * Los deals creados del rango que ya agendaron (A-167): con al menos una llamada vigente
 * agendada a más tardar el último día del rango. Así el último punto de la curva de Deals contra
 * agendas cuadra con esta lista también en un periodo pasado. Exige el join de `filtroDealsCreados`.
 */
export function filtroDealsQueAgendaron(alcance: Alcance, db: Db) {
  return and(
    filtroDealsCreados(alcance),
    inArray(
      deals.id,
      db
        .select({ id: calls.dealId })
        .from(calls)
        .where(and(
          eq(calls.programId, alcance.programId),
          lte(fechaAnclaAgendaCreada(), alcance.rango.hasta),
          vigente(calls),
        )),
    ),
  );
}

/**
 * Si la persona terminó el formulario hasta el cierre del rango (381, D1). La clasificación es
 * por lead y programa, no por el primer envío que abrió el deal: un parcial seguido de un envío
 * completo es completo. Sin `submission_origen_id` el deal es manual y no pertenece a ninguna
 * mitad. El subquery no está correlacionado: así Drizzle no pierde la calificación de columnas.
 */
export type OrigenDeDeal = "completo" | "parcial";

function leadsConFormularioCompleto(alcance: Alcance) {
  return sql`(
    select "submissions"."lead_id"
    from "submissions"
    inner join "sources" on "sources"."id" = "submissions"."source_id"
    where "sources"."program_id" = ${alcance.programId}
      and "submissions"."lead_id" is not null
      and "submissions"."es_parcial" = false
      and ${diaDeEnvio()} <= ${alcance.rango.hasta}
  )`;
}

export function filtroDealsDesde(origen: OrigenDeDeal, alcance: Alcance) {
  const completos = inArray(deals.leadId, leadsConFormularioCompleto(alcance));
  return and(
    filtroDealsCreados(alcance),
    isNotNull(deals.submissionOrigenId),
    origen === "completo" ? completos : notInArray(deals.leadId, leadsConFormularioCompleto(alcance)),
  );
}

/** Los deals de una mitad que ya agendaron: el mismo universo que `filtroDealsDesde`, no el total (N2). */
export function filtroDealsDesdeQueAgendaron(origen: OrigenDeDeal, alcance: Alcance, db: Db) {
  const completos = inArray(deals.leadId, leadsConFormularioCompleto(alcance));
  return and(
    filtroDealsQueAgendaron(alcance, db),
    isNotNull(deals.submissionOrigenId),
    origen === "completo" ? completos : notInArray(deals.leadId, leadsConFormularioCompleto(alcance)),
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

/**
 * Una agenda FUTURA (ticket 189): la cita del rango cuya hora todavía no llega y que sigue
 * agendada. Es agenda, no resultado: no entra al no-show ni a ninguna tasa. La cancelada y la
 * reagendada no son una cita que viene (la reagendada la representa su cita nueva).
 */
export function filtroAgendasFuturas(alcance: Alcance, db: Db, ahora: Date) {
  return and(
    filtroLlamadas(alcance, db),
    eq(calls.resultado, "agendada"),
    or(gt(calls.fechaAgenda, ahora), and(isNull(calls.fechaAgenda), gt(calls.fechaLlamada, ahora))),
  );
}

/** Las citas cuyo resultado explícito fue no show, dentro del universo común de llamadas. */
export function filtroNoShows(alcance: Alcance, db: Db) {
  return and(filtroLlamadas(alcance, db), noAsistioSql());
}

export const ETAPAS_CERRADAS: readonly EtapaDeal[] = ["ganado_completo", "cierre_perdido"];

/**
 * Qué hacer con los negocios ya cerrados (ganados o perdidos) al contar citas sin resultado. Se DECLARA en cada
 * llamada (ticket 353, C-06): antes cuatro predicados contaban 251 contra 255 sin decir por qué.
 *  - `excluir`: lo que hay que ponerse al día (Inbox, bandera del Hub, "Sin resultado"): una cita vieja de un deal ya
 *    cerrado no se persigue.
 *  - `incluir`: la cobertura del show por cita (`citaDebidaSinMarcar`): una venta con la llamada sin marcar es justo
 *    lo que hay que ver.
 */
export type NegociosCerrados = "excluir" | "incluir";

/**
 * LA cita pasada sin resultado (353): sigue `agendada` aunque su hora (`coalesce(fecha_agenda, fecha_llamada)`)
 * ya pasó. El reloj entra como parámetro. Si excluye cerrados, el llamador debe haber unido `deals`. Que siga o no
 * el periodo lo decide el llamador con `filtroLlamadas`; el Inbox no lo usa y la bandera del Hub sí.
 */
export function citaVencidaSinResultado(ahora: Date, negociosCerrados: NegociosCerrados) {
  return and(
    eq(calls.resultado, "agendada"),
    llamadaYaDebiaOcurrir(ahora),
    negociosCerrados === "excluir" ? notInArray(deals.etapa, [...ETAPAS_CERRADAS]) : undefined,
  );
}


/**
 * La cita ya debía haber empezado al instante de corte compartido por cifra y lista. Es el
 * `coalesce(fecha_agenda, fecha_llamada) <= ahora` escrito con operadores de drizzle sobre las
 * columnas: un `Date` dentro de `sql` llega crudo a postgres-js y revienta solo en producción.
 */
export function llamadaYaDebiaOcurrir(ahora: Date) {
  return or(lte(calls.fechaAgenda, ahora), and(isNull(calls.fechaAgenda), lte(calls.fechaLlamada, ahora)));
}

/**
 * La cita que cuenta en el denominador del show (353, 378): ya debía ocurrir y NO está cancelada. Las
 * canceladas se informan aparte y nunca entran a una tasa; la cifra de Hoy y su lista importan esta MISMA
 * función. Antes la cifra las contaba y la lista de Citas del día no.
 */
export function citaDebida(ahora: Date) {
  return and(citaNoCancelada(), llamadaYaDebiaOcurrir(ahora));
}

/**
 * Una cita debida a la que el closer todavía no le marcó resultado (sigue "agendada" aunque su hora ya pasó).
 * Es la parte del denominador que NO se puede juzgar: no es un no show, es un dato que falta. No excluye los
 * negocios cerrados: una venta con la llamada sin marcar es justo lo que hay que ver.
 */
export function citaDebidaSinMarcar(ahora: Date) {
  return and(citaDebida(ahora), citaVencidaSinResultado(ahora, "incluir"));
}

/** El complemento: la cita todavía no llega al corte. Operadores de drizzle, nunca un `Date` dentro de `sql`. */
export function citaPorVenir(ahora: Date) {
  return or(gt(calls.fechaAgenda, ahora), and(isNull(calls.fechaAgenda), gt(calls.fechaLlamada, ahora)));
}
