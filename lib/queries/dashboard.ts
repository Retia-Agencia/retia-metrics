import { hoyEnBogota } from "@/lib/format";
import { sumaDeAbonos } from "@/lib/queries/saldo";
import {
  agendadaSql,
  canceladaSql,
  noAsistioSql,
  reagendadaSql,
  showSql,
} from "@/lib/deals/resultados-de-llamada";
import {
  closerDeAbono,
  fechaAnclaCall,
  filtroCaja,
  filtroCierres,
  filtroCortesias,
  filtroLeads,
  filtroLlamadas,
  citaNoCancelada,
  citaPorVenir,
  citaVencidaSinResultado,
  llamadaOcurrio,
} from "@/lib/queries/metricas-filtros";
export { fechaAnclaCall, ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { and, asc, between, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import {
  abonos,
  calls,
  cohorts,
  deals,
  leads,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { diaHabilDe, diasHabilesEntre, esperadoLineal, metaDeHoy, metaLineal } from "@/lib/dias-habiles";
import { ventasDeLaCohorte } from "@/lib/queries/ventas-de-la-cohorte";
import { claveCloserSql, claveDeCloserSql, etiquetaDeCloserSql } from "@/lib/closers/identidad";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { vigente } from "@/lib/queries/vigente";
import { dineroDeVentas, SIN_DINERO, type DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import { saldosDeLineas, type SaldoDeLinea } from "@/lib/queries/saldo";
import { grupoDeCitas, tasasDelAlcance, type TasasDelGrupo } from "@/lib/queries/tasas-del-grupo";
import { razonVacia, type RazonConCobertura } from "@/lib/cobertura";

/**
 * Consultas del dashboard (ticket 004). Todo lo que pide el reporte diario de Retia
 * dado un programa y un rango de fechas, listo para pintar (la UI es el ticket 005).
 *
 * La base entra por inyeccion (por defecto la de la app) para poder correr los tests
 * sobre PGlite sin Neon, igual que `lib/queries/programas.ts`.
 *
 * Reglas de dominio que gobiernan este archivo:
 *  - Caja recaudada = suma de `abonos.monto` por `abonos.fecha` (ADR 0013). NUNCA se
 *    deriva de las ventas ni al reves. Se agrupa por moneda: nunca se mezclan dos
 *    monedas en un solo numero (restriccion dura de AGENTS.md).
 *  - Toda consulta filtra por `programId`: nunca se suman programas distintos.
 *  - Las filas `origen = 'sheets'` y `origen = 'app'` se suman sin logica especial:
 *    no se filtra jamas por la columna `origen`.
 *
 * Anclaje de fechas: el rango es un par de dias de calendario en America/Bogota,
 * inclusive en ambos extremos, como strings 'YYYY-MM-DD'. Las columnas `date`
 * (`abonos.fecha`) se comparan directo con `between`.
 *
 * Notas de tipos en SQL:
 *  - Los conteos se castean a int (`count(*)::int`), como `lib/queries/fuentes.ts`.
 *  - Los montos se suman en `numeric` en Postgres (aritmetica decimal exacta) y se
 *    castean al borde (`::float8`) para salir como `number`, listos para
 *    `lib/format.ts`.
 */

export interface Rango {
  desde: string;
  hasta: string;
}

/** Una sola definicion de los conteos de llamadas que consumen el total y el comparativo. */
export function conteosDeLlamadas(ahora: Date) {
  return {
    agendas: sql<number>`count(*) filter (where ${citaNoCancelada()})::int`,
    canceladas: sql<number>`count(*) filter (where ${canceladaSql()})::int`,
    porVenir: sql<number>`count(*) filter (where ${citaNoCancelada()} and ${agendadaSql()} and ${citaPorVenir(ahora)})::int`,
    sinResultado: sql<number>`count(*) filter (where ${citaNoCancelada()} and ${citaVencidaSinResultado(ahora, "excluir")})::int`,
    show: sql<number>`count(*) filter (where ${showSql()})::int`,
    noShow: sql<number>`count(*) filter (where ${noAsistioSql()})::int`,
    otro: sql<number>`count(*) filter (where ${citaNoCancelada()} and not (
      (${agendadaSql()} and ${citaPorVenir(ahora)})
      or coalesce(${citaVencidaSinResultado(ahora, "excluir")}, false)
      or (${showSql()} or ${noAsistioSql()} or ${reagendadaSql()})
    ))::int`,
    reagendadas: sql<number>`count(*) filter (where ${reagendadaSql()})::int`,
    llamadasConShow: sql<number>`count(*) filter (where ${llamadaOcurrio()})::int`,
  };
}

/**
 * A que pregunta responde una consulta del dashboard: un programa, y opcionalmente
 * un closer. Es UN concepto (el alcance de la pregunta), por eso va como objeto y
 * no como lista de argumentos posicionales.
 *
 * `claveCloser` ausente o `null` = todo el programa. Cuando trae un valor, la
 * consulta responde por ese closer solo (ticket 005). El closer se identifica por
 * `users.id` (ticket 167, Decision 7): la clave es un `users.id` uuid cuando el
 * closer tiene cuenta, o `historico:<texto normalizado>` para las filas viejas sin
 * FK (una llamada o un abono historico, un closer sin cuenta). El texto copiado
 * `closer_id` ya no filtra por si solo: solo casa las filas historicas sin FK
 * (ADR 0030, ticket 159). La forma de la clave vive en `lib/closers/identidad.ts`.
 *
 * Lo que el filtro NO hace es partir las metas: la meta de cupos y la de leads/dia
 * son de la cohorte (ADR 0022) y no existe reparto por closer en la base.
 */
export interface AlcanceDePrograma {
  programId: string;
  claveCloser?: string | null;
  nombreDeSku?: string | null;
  skuId?: string | null;
  /**
   * La cohorte del filtro del Hub (377): solo los hechos de los deals de esa cohorte. Ausente o `null`
   * = "Todas". Se filtra en SQL por `deals.cohort_id` (`metricas-filtros.ts`), nunca en memoria.
   */
  cohorteId?: string | null;
}

export interface Alcance extends AlcanceDePrograma {
  rango: Rango;
}

export interface CajaPorMoneda {
  moneda: string;
  total: number;
}

/**
 * La moneda en que el CRM recauda (los abonos solo entran en USD, decisión del 16-sep; `abonos.moneda`).
 * «Entró a caja» sin abonos es 0 en esta moneda, no «—» ni «sin datos» (ADR 0115 N5: una suma sin filas es 0).
 */
export const MONEDA_DE_CAJA = "USD";

/**
 * D-3: el ÚNICO sitio que decide el vacío de la caja. Sin filas, una de la moneda del programa con 0; con filas, las mismas.
 * Cada pantalla y el MCP leen esto; ninguna inventa su propio «—», «[]» o texto (lo vigila la regla de lint en `eslint.config.mjs`).
 */
export function cajaConMonedaDelPrograma(filas: readonly CajaPorMoneda[]): CajaPorMoneda[] {
  return filas.length === 0 ? [{ moneda: MONEDA_DE_CAJA, total: 0 }] : [...filas];
}

/**
 * `agendas`, `llamadasConShow` y `cierres` son CANTIDADES del periodo, cada una por su fecha. Las tres
 * tasas salen del grupo de citas del rango (ADR 0079, `tasas-del-grupo.ts`): nunca dividen dos
 * cantidades de grupos distintos.
 */
export interface EmbudoDelRango {
  agendas: number;
  canceladas: number;
  estadosDeCitas: {
    porVenir: number;
    sinResultado: number;
    show: number;
    noShow: number;
    reagendadas: number;
    otro: number;
  };
  reagendadas: number;
  llamadasConShow: number;
  razonShow: RazonConCobertura;
  cierres: number;
  razonCierre: RazonConCobertura;
  agendaAVenta: number | null;
  pendientesDeResultado: number;
  /** El grupo detrás de las tasas: deals con cita ocurrida, con show y con show vendidos hoy. */
  grupo: TasasDelGrupo;
  /** El rango termina hace menos de 30 días: las tasas todavía pueden subir. */
  madurando: boolean;
}

export interface VistaDeCohorte {  cohorteId: string;
  codigo: string;
  meta: number;
  /** Ventas de la cohorte completa hasta el día de la vista. La meta se mide contra este número. */
  vendidos: number;
  /**
   * Ventas de la cohorte hechas por el closer del alcance: su contribucion. `null`
   * cuando el alcance no trae closer. NO existe meta individual (ADR 0022).
   */
  vendidosDelCloser: number | null;
  faltan: number;
  /** null cuando la cohorte no tiene fechaInicioVentas declarada (ADR 0022): se dice, no se inventa. */
  ventana: {
    inicio: string;
    cierre: string;
    dia: number;
    total: number;
    habilesRestantes: number;
    metaDinamica: number;
    metaLineal: number;
    esperado: number;
    cumplimiento: number | null;
  } | null;
}

export interface LeadsDelRango {
  /**
   * `null` cuando el dashboard viene filtrado por closer. **No es "cero leads":
   * es "esta pregunta no tiene respuesta todavia"**, y por eso no es un numero.
   *
   * Un lead se atribuia a un closer por `leads.responsableCloserId`, que se fue con
   * el ADR 0035. Su reemplazo es `deals.owner_user_id` (ADR 0037), que existe desde
   * el ticket 037 pero no tiene una sola fila hasta que el sync de la etapa 3 cree
   * deals. Devolver el conteo del programa entero bajo el nombre de un closer seria
   * justo la familia de bug de la que este repo ya sangro tres veces: una cifra
   * creible, equivocada, que no lanza ningun error. La pantalla muestra un guion.
   *
   */
  leads: number | null;
  diasHabiles: number;
  metaLeadsDia: number | null;
  metaDelRango: number | null;
  cumplimiento: number | null;
}

/** Tasa que nunca divide por cero: `null` cuando el denominador es 0. */
export function tasa(numerador: number, denominador: number): number | null {
  return denominador === 0 ? null : numerador / denominador;
}

/**
 * Cuenta los deals cuya VENTA (`ventasConDiaEn`: su primera entrada a Ganado Pago Parcial o Ganado Pagado Completo)
 * cae en el rango. Cada venta cuenta en un solo periodo.
 *
 * La fecha de venta es la del movimiento de etapa, no la del abono ni la de la
 * llamada. El dueño sale de `deals.ownerUserId`, que es la identidad actual de la
 * oportunidad y no el texto histórico de una llamada.
 */
async function ventasDelRango(
  alcance: Alcance,
  db: Db,
): Promise<number> {
  const { programId, rango, claveCloser, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("ventasDelRango", programId, rango.desde, rango.hasta,
    claveCloser ?? null, cohorteId ?? null, nombreDeSku ?? null, skuId ?? null), () => leerVentasDelRango(alcance, db));
}

async function leerVentasDelRango(
  alcance: Alcance,
  db: Db,
): Promise<number> {
  const condiciones = filtroCierres(alcance, db);
  const [fila] = await db
    .select({ ventas: sql<number>`count(distinct ${deals.id})::int` })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(condiciones, vigente(deals)));
  return fila?.ventas ?? 0;
}

export async function contarCortesias(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<number> {
  const { programId, rango, claveCloser, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("contarCortesias", programId, rango.desde, rango.hasta,
    claveCloser ?? null, cohorteId ?? null, nombreDeSku ?? null, skuId ?? null), () => leerCortesias(alcance, db));
}

async function leerCortesias(
  alcance: Alcance,
  db: Db,
): Promise<number> {
  const [fila] = await db
    .select({ cortesias: sql<number>`count(distinct ${deals.id})::int` })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(filtroCortesias(alcance, db), vigente(deals)));
  return fila?.cortesias ?? 0;
}

function ventasPorCloser(
  alcance: Omit<Alcance, "claveCloser">,
  db: Db,
): Promise<{ clave: string; closerId: string | null; cierres: number }[]> {
  const { programId, rango, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("ventasPorCloser", programId, rango.desde, rango.hasta, cohorteId ?? null, nombreDeSku ?? null, skuId ?? null), () => db
    .select({
      clave: claveCloserSql(users.id, users.closerId),
      closerId: sql<string | null>`min(${etiquetaDeCloserSql()})`,
      cierres: sql<number>`count(distinct ${deals.id})::int`,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(
      and(
        filtroCierres(alcance, db),
        vigente(deals),
      ),
    )
    .groupBy(claveCloserSql(users.id, users.closerId)));
}

export interface VentaDelRangoConValor {
  dealId: string;
  claveCloser: string;
  /** La clave que usaría el filtro histórico del mismo dueño; null si su cuenta no tiene texto de closer. */
  claveCloserHistorica: string | null;
  cohortId: string | null;
  valorVendidoUsd: string | null;
}

/** Las ventas del rango con los valores necesarios para dinero derivado. */
export async function ventasDelRangoConValor(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<VentaDelRangoConValor[]> {
  return unaVezPorSolicitud(db, claveDe("ventasDelRangoConValor", alcance.programId, alcance.rango.desde,
    alcance.rango.hasta, alcance.claveCloser ?? null, alcance.cohorteId ?? null,
    alcance.nombreDeSku ?? null, alcance.skuId ?? null), () => db
    .select({
      dealId: deals.id,
      claveCloser: claveCloserSql(users.id, users.closerId),
      claveCloserHistorica: sql<string | null>`case
        when ${users.id} is null or ${users.closerId} is not null
          then ${claveCloserSql(sql`null::uuid`, users.closerId)}
        else null
      end`,
      cohortId: deals.cohortId,
      valorVendidoUsd: deals.valorVendidoUsd,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(filtroCierres(alcance, db), vigente(deals))));
}

/** Las ventas del rango y sus líneas vendidas, leídas una sola vez; los filtros de SKU acotan las líneas, no solo los deals. */
async function ventasConLineasDelRango(
  alcance: Alcance,
  db: Db,
): Promise<{ ventas: VentaDelRangoConValor[]; lineas: SaldoDeLinea[] }> {
  const ventas = await ventasDelRangoConValor(alcance, db);
  const saldos = await saldosDeLineas(db, ventas.map((venta) => venta.dealId));
  const lineas = [...saldos.values()].filter((linea) => linea.vendida
    && (!alcance.nombreDeSku || linea.skuSlug === alcance.nombreDeSku)
    && (!alcance.skuId || linea.skuId === alcance.skuId));
  return { ventas, lineas };
}

/** Líneas vendidas de las ventas elegidas (la fuente de SKUs vendidos, Vendido, Recaudado y Por cobrar). */
export async function lineasVendidasDelRango(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<SaldoDeLinea[]> {
  return (await ventasConLineasDelRango(alcance, db)).lineas;
}

/**
 * Vendido, Recaudado y Por cobrar de las ventas del rango (369): las tres sobre el MISMO conjunto de
 * ventas, el que dejan pasar el periodo, la cohorte y el closer. Lo recaudado es a hoy, no por fecha.
 */
export async function dineroDelRango(alcance: Alcance, db: Db = dbDeLaApp): Promise<DineroDeVentas> {
  const { ventas, lineas } = await ventasConLineasDelRango(alcance, db);
  return dineroDeVentas(db, ventas.map((venta) => venta.dealId), lineas);
}

/** El dinero de todas las filas del comparativo desde una sola lectura de ventas y otra de sus saldos. */
export async function dineroPorCloserDelRango(
  alcance: Omit<Alcance, "claveCloser">,
  claves: readonly string[],
  db: Db = dbDeLaApp,
): Promise<Map<string, DineroDeVentas>> {
  const unicas = [...new Set(claves)];
  const resultado = new Map<string, DineroDeVentas>(
    unicas.map((clave): [string, DineroDeVentas] => [clave, { ...SIN_DINERO }]),
  );
  if (unicas.length === 0) return resultado;

  const { ventas, lineas } = await ventasConLineasDelRango(alcance, db);
  const idsPorCloser = new Map<string, string[]>();
  for (const venta of ventas) {
    for (const clave of new Set([venta.claveCloser, venta.claveCloserHistorica])) {
      if (clave === null || !resultado.has(clave)) continue;
      const ids = idsPorCloser.get(clave);
      if (ids) ids.push(venta.dealId);
      else idsPorCloser.set(clave, [venta.dealId]);
    }
  }
  for (const [clave, ids] of idsPorCloser) {
    const conjunto = new Set(ids);
    resultado.set(clave, await dineroDeVentas(db, ids, lineas.filter((linea) => conjunto.has(linea.dealId))));
  }
  return resultado;
}

export interface VentasDeCohorte {
  cohorteId: string | null;
  codigo: string | null;
  ventas: number;
  contratadoUsd: number;
  /** Las tres cifras de esa cohorte (369): lo recaudado es a hoy, lo que falta es el saldo de esas ventas. */
  dinero: DineroDeVentas;
}

/** Ventas del rango por cohorte, incluidas las que aún no iniciaron clases. */
export function ventasPorCohorte(alcance: Alcance, db: Db = dbDeLaApp): Promise<VentasDeCohorte[]> {
  return unaVezPorSolicitud(db, claveDe("ventasPorCohorte", alcance.programId, alcance.rango.desde, alcance.rango.hasta,
    alcance.claveCloser ?? null, alcance.cohorteId ?? null, alcance.nombreDeSku ?? null, alcance.skuId ?? null), () => leerVentasPorCohorte(alcance, db));
}

async function leerVentasPorCohorte(alcance: Alcance, db: Db): Promise<VentasDeCohorte[]> {
  const ventas = await db
    .select({
      dealId: deals.id,
      cohorteId: deals.cohortId,
      codigo: cohorts.codigo,
      fechaInicioClases: cohorts.fechaInicioClases,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .leftJoin(cohorts, and(eq(cohorts.id, deals.cohortId), eq(cohorts.programId, deals.programId)))
    .where(and(filtroCierres(alcance, db), vigente(deals)))
    .orderBy(asc(cohorts.fechaInicioClases));

  const grupos = new Map<string, typeof ventas>();
  for (const venta of ventas) {
    const clave = venta.cohorteId ?? "\u0000sin-cohorte";
    const grupo = grupos.get(clave) ?? [];
    grupo.push(venta);
    grupos.set(clave, grupo);
  }
  const lineas = await lineasVendidasDelRango(alcance, db);

  return Promise.all([...grupos.values()].map(async (grupo) => {
    const ids = grupo.map((venta) => venta.dealId);
    const conjunto = new Set(ids);
    const dinero = await dineroDeVentas(db, ids, lineas.filter((linea) => conjunto.has(linea.dealId)));
    return {
      cohorteId: grupo[0]!.cohorteId,
      codigo: grupo[0]!.codigo,
      ventas: grupo.length,
      contratadoUsd: dinero.vendido,
      dinero,
    };
  }));
}

/**
 * Citas pasadas pendientes (la bandera del Hub). Mismo criterio que el Inbox (353): excluye negocios cerrados; a
 * diferencia del Inbox, SÍ sigue el periodo (`filtroLlamadas`). Con un rango que cubra todo, dan la misma cifra.
 */
export async function sinResultadoDelRango(
  alcance: Alcance,
  ahora: Date,
  db: Db = dbDeLaApp,
): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(calls)
    .innerJoin(deals, and(eq(deals.id, calls.dealId), eq(deals.programId, calls.programId), vigente(deals)))
    .where(and(
      filtroLlamadas(alcance, db),
      citaVencidaSinResultado(ahora, "excluir"),
      vigente(calls),
      vigente(deals),
    ));
  return fila?.total ?? 0;
}

/**
 * Caja recaudada del rango, agrupada por moneda (ADR 0013). Suma `abonos.monto`
 * por `abonos.fecha` entre `desde` y `hasta`, inclusive. Nunca convierte moneda:
 * devuelve una fila por moneda presente en el rango, y sin abonos una sola de la moneda del
 * programa con 0 (D-3, `cajaConMonedaDelPrograma`).
 */
export async function cajaRecaudada(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<CajaPorMoneda[]> {
  const { programId, rango, claveCloser, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("cajaRecaudada", programId, rango.desde, rango.hasta,
    claveCloser ?? null, cohorteId ?? null, nombreDeSku ?? null, skuId ?? null), () => db
    .select({
      moneda: abonos.moneda,
      total: sql<number>`${sumaDeAbonos()}::float8`,
    })
    .from(abonos)
    .where(
      and(
        filtroCaja(alcance, db),
        vigente(abonos),
      ),
    )
    .groupBy(abonos.moneda)
    .then(cajaConMonedaDelPrograma));
}

/**
 * Embudo de llamadas del rango: `agendas`, `llamadasConShow` y `cierres` salen de
 * `calls` ancladas en `coalesce(fechaAgenda, fechaLlamada)`.
 *
 * Una venta es un deal cuya primera entrada a Ganado Pago Parcial o Ganado Pagado
 * Completo cae en el rango. Contar deals a secas inflaría la cifra sin lanzar error.
 *
 * Las tasas NO salen de esas cantidades: salen del grupo de citas (ADR 0079). Con closer,
 * son las de su parte del grupo, la misma que muestra su fila del comparativo.
 */
export function embudoDelRango(
  alcance: Alcance,
  db: Db = dbDeLaApp,
  ahora: Date = new Date(),
): Promise<EmbudoDelRango> {
  const { programId, rango, claveCloser, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("embudoDelRango", programId, rango.desde, rango.hasta,
    claveCloser ?? null, cohorteId ?? null, nombreDeSku ?? null, skuId ?? null, ahora), () => leerEmbudoDelRango(alcance, db, ahora));
}

async function leerEmbudoDelRango(
  alcance: Alcance,
  db: Db,
  ahora: Date,
): Promise<EmbudoDelRango> {
  const { claveCloser } = alcance;
  const [llamadas] = await db
    .select({
      ...conteosDeLlamadas(ahora),
    })
    .from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), eq(deals.programId, calls.programId), vigente(deals)))
    .where(
      and(
        filtroLlamadas(alcance, db),
        vigente(calls),
      ),
    );

  const agendas = llamadas?.agendas ?? 0;
  const canceladas = llamadas?.canceladas ?? 0;
  const reagendadas = llamadas?.reagendadas ?? 0;
  const llamadasConShow = llamadas?.llamadasConShow ?? 0;
  const [cierres, grupo] = await Promise.all([
    ventasDelRango(alcance, db),
    grupoDeCitas(db, { ...alcance, ahora }),
  ]);
  const tasas = tasasDelAlcance(grupo, claveCloser);

  return {
    agendas,
    canceladas,
    estadosDeCitas: {
      porVenir: llamadas?.porVenir ?? 0,
      sinResultado: llamadas?.sinResultado ?? 0,
      show: llamadas?.show ?? 0,
      noShow: llamadas?.noShow ?? 0,
      reagendadas,
      otro: llamadas?.otro ?? 0,
    },
    reagendadas,
    llamadasConShow,
    razonShow: tasas.razonShow,
    cierres,
    razonCierre: tasas.razonCierre,
    agendaAVenta: tasas.agendaAVenta,
    pendientesDeResultado: tasas.pendientes,
    grupo: tasas,
    madurando: grupo.madurando,
  };
}

/** Una opcion del selector de closer: el `users.id` (valor) y su etiqueta visible. */
export interface OpcionDeCloser {
  id: string;
  label: string;
}

/**
 * Los closers CON CUENTA que tuvieron actividad en el rango (ticket 167, Decision 5):
 * dueno de un deal del programa, o quien registro una llamada o un abono por su FK.
 * Son las opciones del selector del dashboard, cuyo valor es el `users.id`. Los
 * closers solo historicos (texto sin cuenta) NO se ofrecen aqui: el comparativo los
 * sigue mostrando como filas, pero el filtro por URL es por id.
 */
export function closersConCuenta(
  alcance: Omit<Alcance, "claveCloser">,
  db: Db = dbDeLaApp,
): Promise<OpcionDeCloser[]> {
  return unaVezPorSolicitud(db, claveDe("closersConCuenta", alcance.programId, alcance.rango.desde, alcance.rango.hasta),
    () => leerClosersConCuenta(alcance, db));
}

async function leerClosersConCuenta(
  { programId, rango }: Omit<Alcance, "claveCloser">,
  db: Db,
): Promise<OpcionDeCloser[]> {
  const owners = db
    .select({ userId: deals.ownerUserId })
    .from(deals)
    .where(and(eq(deals.programId, programId), vigente(deals)));
  const deCalls = db
    .select({ userId: calls.closerUserId })
    .from(calls)
    .where(and(eq(calls.programId, programId), between(fechaAnclaCall(), rango.desde, rango.hasta), vigente(calls)));
  const deAbonos = db
    .select({ userId: abonos.registradoPorUserId })
    .from(abonos)
    .where(and(eq(abonos.programId, programId), between(abonos.fecha, rango.desde, rango.hasta), vigente(abonos)));

  const filas = await db
    .select({
      id: users.id,
      label: sql<string>`${etiquetaDeCloserSql()}`,
    })
    .from(users)
    .where(or(inArray(users.id, owners), inArray(users.id, deCalls), inArray(users.id, deAbonos)));

  return filas.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * El mismo embudo del rango pero desglosado por closer, mas la caja de cada uno.
 *
 * Las tres fuentes devuelven la misma clave de identidad: `users.id` para cuentas y
 * `historico:<texto>` para filas viejas. Un closer que solo tiene abonos igual aparece.
 *
 * Es el comparativo entre closers, y por eso su alcance NO admite `closerId`: filtrarlo
 * lo dejaría en una fila y rompería el comparativo (ADR 0023). El tipo lo impide.
 */
export function embudoPorCloser(
  alcance: Omit<Alcance, "claveCloser">,
  db: Db = dbDeLaApp,
  ahora: Date = new Date(),
): Promise<(EmbudoDelRango & { clave: string; closerId: string | null; caja: CajaPorMoneda[] })[]> {
  const { programId, rango, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("embudoPorCloser", programId, rango.desde, rango.hasta,
    cohorteId ?? null, nombreDeSku ?? null, skuId ?? null, ahora), () => leerEmbudoPorCloser(alcance, db, ahora));
}

/** La caja del rango por closer y moneda: no depende del instante, así que el Hub la lee una vez por solicitud. */
function cajaPorCloser(
  alcance: Omit<Alcance, "claveCloser">,
  db: Db,
): Promise<{ clave: string; closerId: string | null; moneda: string; total: number }[]> {
  const { programId, rango, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("cajaPorCloser", programId, rango.desde, rango.hasta, cohorteId ?? null, nombreDeSku ?? null, skuId ?? null), () =>
    db
      .select({
        clave: claveCloserSql(users.id, abonos.closerId),
        closerId: sql<string | null>`min(${closerDeAbono()})`,
        moneda: abonos.moneda,
        total: sql<number>`${sumaDeAbonos()}::float8`,
      })
      .from(abonos)
      .leftJoin(
        users,
        or(
          eq(users.id, abonos.registradoPorUserId),
          and(
            isNull(abonos.registradoPorUserId),
            eq(claveDeCloserSql(users.closerId), claveDeCloserSql(abonos.closerId)),
          ),
        ),
      )
      .where(
        and(
          filtroCaja(alcance, db),
          vigente(abonos),
        ),
      )
      .groupBy(claveCloserSql(users.id, abonos.closerId), abonos.moneda));
}

async function leerEmbudoPorCloser(
  alcance: Omit<Alcance, "claveCloser">,
  db: Db,
  ahora: Date,
): Promise<(EmbudoDelRango & { clave: string; closerId: string | null; caja: CajaPorMoneda[] })[]> {
  const [llamadasPorCloser, abonosPorCloser, cierresPorCloser, grupo] = await Promise.all([
    db
      .select({
        clave: claveCloserSql(users.id),
        closerId: sql<string | null>`min(${etiquetaDeCloserSql()})`,
        ...conteosDeLlamadas(ahora),
      })
      .from(calls)
      .leftJoin(deals, and(eq(deals.id, calls.dealId), eq(deals.programId, calls.programId), vigente(deals)))
      .leftJoin(users, eq(users.id, calls.closerUserId))
      .where(
        and(
          filtroLlamadas(alcance, db),
          vigente(calls),
        ),
      )
      .groupBy(claveCloserSql(users.id)),
    cajaPorCloser(alcance, db),
    ventasPorCloser(alcance, db),
    grupoDeCitas(db, { ...alcance, ahora }),
  ]);

  const porClave = new Map<
    string,
    EmbudoDelRango & { clave: string; closerId: string | null; caja: CajaPorMoneda[] }
  >();

  const asegurar = (clave: string, closerId: string | null) => {
    let fila = porClave.get(clave);
    if (!fila) {
      fila = {
        clave,
        closerId,
        agendas: 0,
        canceladas: 0,
        estadosDeCitas: { porVenir: 0, sinResultado: 0, show: 0, noShow: 0, reagendadas: 0, otro: 0 },
        reagendadas: 0,
        llamadasConShow: 0,
        razonShow: razonVacia("Sin citas en el periodo"),
        cierres: 0,
        razonCierre: razonVacia("Sin shows en el periodo"),
        agendaAVenta: null,
        pendientesDeResultado: 0,
        grupo: tasasDelAlcance(grupo, clave),
        madurando: grupo.madurando,
        caja: [],
      };
      porClave.set(clave, fila);
    }
    return fila;
  };

  for (const l of llamadasPorCloser) {
    const fila = asegurar(l.clave, l.closerId);
    fila.agendas = l.agendas;
    fila.canceladas = l.canceladas;
    fila.reagendadas = l.reagendadas;
    fila.llamadasConShow = l.llamadasConShow;
  }
  for (const c of cierresPorCloser) {
    asegurar(c.clave, c.closerId).cierres = c.cierres;
  }
  for (const a of abonosPorCloser) {
    asegurar(a.clave, a.closerId).caja.push({ moneda: a.moneda, total: a.total });
  }

  // Un closer con grupo y sin otra actividad del periodo igual tiene fila: su tasa existe.
  for (const [clave, tasas] of grupo.porCloser) asegurar(clave, tasas.closer);
  for (const fila of porClave.values()) fila.caja = cajaConMonedaDelPrograma(fila.caja);

  // Las tasas salen del grupo de citas (ADR 0079): cada deal cuenta en un solo closer.
  for (const fila of porClave.values()) {
    fila.grupo = tasasDelAlcance(grupo, fila.clave);
    fila.razonShow = fila.grupo.razonShow;
    fila.razonCierre = fila.grupo.razonCierre;
    fila.agendaAVenta = fila.grupo.agendaAVenta;
    fila.pendientesDeResultado = fila.grupo.pendientes;
  }

  return [...porClave.values()];
}

/**
 * Vista de la cohorte activa de un programa a fecha `hoy` ('YYYY-MM-DD', Bogota), o
 * `null` si el programa no tiene cohorte activa.
 *
 * `vendidos` es el conteo de deals VENDIDOS de TODA la cohorte hasta `hoy`, no del rango. Los dias
 * habiles de la ventana salen SIEMPRE de `fechaInicioVentas` y `fechaCierreVentas`
 * (ADR 0022), inclusive en ambos extremos, nunca de un calculo. Si la cohorte no
 * tiene `fechaInicioVentas` (cohortes cerradas viejas), `ventana` es `null`: no se
 * inventa ningun dia habil.
 */
export async function vistaDeCohorteActiva(
  { programId, claveCloser }: AlcanceDePrograma,
  hoy: string,
  db: Db = dbDeLaApp,
): Promise<VistaDeCohorte | null> {
  const cohorte = await cohorteActiva(programId, db, hoy);
  if (!cohorte) return null;

  const meta = cohorte.metaCupos;
  // `vendidos` es SIEMPRE el de la cohorte completa: toda la matematica de meta
  // (dinamica, lineal, esperado, cumplimiento) se mide contra la cohorte, nunca
  // contra un closer. Lo del closer va aparte, como contribucion.
  // Una sola definicion de venta y de cohorte (352): `ventasDeLaCohorte`, sin limite inferior (DA-2).
  const ventasDeLaCohorteHoy = await ventasDeLaCohorte(db, cohorte.id, hoy);
  const vendidos = ventasDeLaCohorteHoy.length;
  const vendidosDelCloser =
    claveCloser == null ? null : (await ventasDeLaCohorte(db, cohorte.id, hoy, claveCloser)).length;
  const vendidosAntesDeHoy = ventasDeLaCohorteHoy.filter((venta) => venta.dia < hoy).length;
  const faltan = Math.max(meta - vendidos, 0);

  const base: VistaDeCohorte = {
    cohorteId: cohorte.id,
    codigo: cohorte.codigo,
    meta,
    vendidos,
    vendidosDelCloser,
    faltan,
    ventana: null,
  };

  if (!cohorte.fechaInicioVentas || !cohorte.fechaCierreVentas) return base;

  const inicio = cohorte.fechaInicioVentas;
  const cierre = cohorte.fechaCierreVentas;
  const { dia, total } = diaHabilDe(hoy, inicio, cierre);
  // Si hoy ya paso el cierre, `diasHabilesEntre(hoy, cierre)` da 0 por definicion.
  const habilesRestantes = diasHabilesEntre(hoy, cierre);
  // Meta de APERTURA del dia (DA-5): no descuenta lo vendido hoy, asi el cumplimiento del dia tiene tope.
  const metaDin = metaDeHoy({ meta, vendidosAntesDeHoy, hoy, cierre });
  const metaLin = metaLineal({ meta, diasHabilesTotales: total });
  const esperado = esperadoLineal({ meta, inicio, cierre, hasta: hoy });

  return {
    ...base,
    ventana: {
      inicio,
      cierre,
      dia,
      total,
      habilesRestantes,
      metaDinamica: metaDin,
      metaLineal: metaLin,
      esperado,
      cumplimiento: esperado === 0 ? null : vendidos / esperado,
    },
  };
}

/**
 * Leads del rango contra la meta de leads por dia habil de la cohorte activa.
 *
 * `leads` cuenta SOLO personas con `entrada = 'formulario'` (decision de Mani,
 * ADR 0021): las creadas a mano en el CRM (`entrada = 'crm'`) no son leads del
 * formulario y no cuentan contra `metaLeadsDia`. Se anclan por
 * `leads.fechaPrimeraAplicacion`, que es `timestamp with time zone`: se convierte a
 * fecha de calendario en Bogota antes de comparar, como el embudo de llamadas.
 *
 * `metaLeadsDia` sale de la cohorte activa; `null` si no hay cohorte activa o si no
 * la tiene seteada. `metaDelRango = metaLeadsDia * diasHabiles`, y `cumplimiento`
 * nunca divide por cero (null si no hay meta o es 0).
 */
export async function leadsDelRango(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<LeadsDelRango> {
  const { programId, rango, claveCloser, cohorteId, nombreDeSku, skuId } = alcance;
  return unaVezPorSolicitud(db, claveDe("leadsDelRango", programId, rango.desde, rango.hasta,
    claveCloser ?? null, cohorteId ?? null, nombreDeSku ?? null, skuId ?? null), () => leerLeadsDelRango(alcance, db));
}

async function leerLeadsDelRango(
  alcance: Alcance,
  db: Db,
): Promise<LeadsDelRango> {
  const { programId, rango, claveCloser } = alcance;
  // Filtrado por closer no hay a que preguntarle: la atribucion vivia en
  // `responsableCloserId` y se fue con el ADR 0035. Ver la nota de `LeadsDelRango`.
  const [fila] = claveCloser
    ? [undefined]
    : await db
        .select({ n: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          filtroLeads(alcance, db),
        );
  const conteoLeads = claveCloser ? null : (fila?.n ?? 0);

  const diasHabiles = diasHabilesEntre(rango.desde, rango.hasta);

  // La meta de leads es la de la cohorte que vendia al final del rango (o hoy, si el rango sigue abierto).
  const hoy = hoyEnBogota();
  const cohorte = await cohorteActiva(programId, db, rango.hasta < hoy ? rango.hasta : hoy);
  const metaLeadsDia = cohorte?.metaLeadsDia ?? null;
  const metaDelRango = metaLeadsDia === null ? null : metaLeadsDia * diasHabiles;
  const cumplimiento =
    conteoLeads === null || metaDelRango === null || metaDelRango === 0
      ? null
      : conteoLeads / metaDelRango;

  return { leads: conteoLeads, diasHabiles, metaLeadsDia, metaDelRango, cumplimiento };
}
