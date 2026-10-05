import { contratadoDeDeals, sumaDeAbonos, type ContratadoDeDeals } from "@/lib/queries/saldo";
import {
  closerDeAbono,
  cerradosEn,
  ETAPAS_VENDIDAS,
  fechaAnclaCall,
  filtroCaja,
  filtroCierres,
  filtroCortesias,
  filtroLeads,
  filtroLlamadas,
  llamadaOcurrio,
  llamadaPasadaSinResultado,
  porClaveDeDeal,
  vendidosEn,
} from "@/lib/queries/metricas-filtros";
export { fechaAnclaCall, vendidosEn, ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { and, asc, between, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import {
  abonos,
  areas,
  calls,
  cohorts,
  canales,
  deals,
  leads,
  motivos,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilDe, diasHabilesEntre, metaDinamica, metaLineal } from "@/lib/dias-habiles";
import { claveCloserSql, claveDeCloserSql, etiquetaDeCloserSql } from "@/lib/closers/identidad";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { vigente } from "@/lib/queries/vigente";
import type { FilaHechosDelEmbudo, OrigenDelHecho } from "@/lib/queries/hechos-embudo";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { carteraVencida } from "@/lib/queries/cartera";
import { grupoDeCitas, tasasDelAlcance, type TasasDelGrupo } from "@/lib/queries/tasas-del-grupo";

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
}

export interface Alcance extends AlcanceDePrograma {
  rango: Rango;
}

export interface CajaPorMoneda {
  moneda: string;
  total: number;
}

/**
 * `agendas`, `llamadasConShow` y `cierres` son CANTIDADES del periodo, cada una por su fecha. Las tres
 * tasas salen del grupo de citas del rango (ADR 0079, `tasas-del-grupo.ts`): nunca dividen dos
 * cantidades de grupos distintos.
 */
export interface EmbudoDelRango {
  agendas: number;
  llamadasConShow: number;
  pctShow: number | null;
  cierres: number;
  pctCierre: number | null;
  agendaAVenta: number | null;
  /** El grupo detrás de las tasas: deals con cita ocurrida, con show y con show vendidos hoy. */
  grupo: TasasDelGrupo;
  /** El rango termina hace menos de 30 días: las tasas todavía pueden subir. */
  madurando: boolean;
}

export interface VistaDeCohorte {  cohorteId: string;
  codigo: string;
  meta: number;
  /** Ventas de la cohorte completa. La meta se mide siempre contra este numero. */
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
 * Cuenta los deals cuya VENTA (`vendidosEn`: su primera entrada a Ganado Pago Parcial o Ganado Pagado Completo)
 * cae en el rango. Cada venta cuenta en un solo periodo.
 *
 * La fecha de venta es la del movimiento de etapa, no la del abono ni la de la
 * llamada. El dueño sale de `deals.ownerUserId`, que es la identidad actual de la
 * oportunidad y no el texto histórico de una llamada.
 */
async function ventasDelRango(
  { programId, rango, claveCloser }: Alcance,
  db: Db,
): Promise<number> {
  const condiciones = filtroCierres({ programId, rango, claveCloser }, db);
  const [fila] = await db
    .select({ ventas: sql<number>`count(distinct ${deals.id})::int` })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(condiciones, vigente(deals)));
  return fila?.ventas ?? 0;
}

export async function contarCortesias(
  { programId, rango, claveCloser }: Alcance,
  db: Db = dbDeLaApp,
): Promise<number> {
  const [fila] = await db
    .select({ cortesias: sql<number>`count(distinct ${deals.id})::int` })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(filtroCortesias({ programId, rango, claveCloser }, db), vigente(deals)));
  return fila?.cortesias ?? 0;
}

async function ventasPorCloser(
  { programId, rango }: Omit<Alcance, "claveCloser">,
  db: Db,
): Promise<{ clave: string; closerId: string | null; cierres: number }[]> {
  return db
    .select({
      clave: claveCloserSql(users.id, users.closerId),
      closerId: sql<string | null>`min(${etiquetaDeCloserSql()})`,
      cierres: sql<number>`count(distinct ${deals.id})::int`,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(
      and(
        eq(deals.programId, programId),
        inArray(deals.id, vendidosEn(db, rango)),
        vigente(deals),
      ),
    )
    .groupBy(claveCloserSql(users.id, users.closerId));
}

export interface VentaDelRangoConValor {
  dealId: string;
  cohortId: string | null;
  ticketUsd: string | null;
  valorVendidoUsd: string | null;
  comisionPorcentaje: string | null;
}

/** Las ventas del rango con los valores necesarios para dinero derivado. */
export async function ventasDelRangoConValor(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<VentaDelRangoConValor[]> {
  return db
    .select({
      dealId: deals.id,
      cohortId: deals.cohortId,
      ticketUsd: cohorts.precioUsd,
      valorVendidoUsd: deals.valorVendidoUsd,
      comisionPorcentaje: deals.comisionPorcentaje,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .leftJoin(cohorts, and(eq(cohorts.id, deals.cohortId), eq(cohorts.programId, deals.programId)))
    .where(and(filtroCierres(alcance, db), vigente(deals)));
}

/** Valor vendido de las ventas del rango. Un valor ausente no se inventa. */
export async function contratadoDelRango(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<ContratadoDeDeals> {
  const ventas = await ventasDelRangoConValor(alcance, db);
  return contratadoDeDeals(db, ventas.map((venta) => venta.dealId));
}

export interface VentasDeCohorte {
  cohorteId: string | null;
  codigo: string | null;
  ventas: number;
  contratadoUsd: number;
}

/** Ventas del rango por cohorte, incluidas las que aún no iniciaron clases. */
export async function ventasPorCohorte(alcance: Alcance, db: Db = dbDeLaApp): Promise<VentasDeCohorte[]> {
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

  return Promise.all([...grupos.values()].map(async (grupo) => ({
    cohorteId: grupo[0]!.cohorteId,
    codigo: grupo[0]!.codigo,
    ventas: grupo.length,
    contratadoUsd: (await contratadoDeDeals(db, grupo.map((venta) => venta.dealId))).usd,
  })));
}

/** Citas pasadas pendientes, con el mismo universo que la primera sección del Inbox. */
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
      llamadaPasadaSinResultado(ahora),
      vigente(calls),
      vigente(deals),
    ));
  return fila?.total ?? 0;
}

/** Foto de la cartera abierta del programa; no depende del rango elegido. */
export async function carteraDelPrograma(
  programId: string,
  hoy: string,
  db: Db = dbDeLaApp,
): Promise<{
  deals: number;
  saldoUsd: number;
  vencidos: number;
  sinFechaDeReferencia: number;
  sinSaldoCalculable: number;
}> {
  const filas = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(
      eq(deals.programId, programId),
      eq(deals.cortesia, false),
      eq(deals.etapa, "ganado_parcial"),
      vigente(deals),
    ));
  const saldos = await saldosDeDeals(db, filas.map((fila) => fila.id));
  const saldoUsd = [...saldos.values()].reduce(
    (total, saldo) => total + (saldo.moneda === "USD" && saldo.saldo !== null ? saldo.saldo : 0),
    0,
  );
  const sinSaldoCalculable = filas.filter((fila) => {
    const saldo = saldos.get(fila.id);
    return !saldo || saldo.saldo === null || saldo.moneda !== "USD";
  }).length;
  const vencida = await carteraVencida(db, programId, hoy);
  return {
    deals: filas.length,
    saldoUsd: Math.round(saldoUsd * 100) / 100,
    vencidos: vencida.vencidos.length,
    sinFechaDeReferencia: vencida.sinFechaDeReferencia,
    sinSaldoCalculable,
  };
}

/**
 * Caja recaudada del rango, agrupada por moneda (ADR 0013). Suma `abonos.monto`
 * por `abonos.fecha` entre `desde` y `hasta`, inclusive. Nunca convierte moneda:
 * devuelve una fila por moneda presente en el rango.
 */
export async function cajaRecaudada(
  { programId, rango, claveCloser }: Alcance,
  db: Db = dbDeLaApp,
): Promise<CajaPorMoneda[]> {
  return db
    .select({
      moneda: abonos.moneda,
      total: sql<number>`${sumaDeAbonos()}::float8`,
    })
    .from(abonos)
    .where(
      and(
        filtroCaja({ programId, rango, claveCloser }, db),
        vigente(abonos),
      ),
    )
    .groupBy(abonos.moneda);
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
export async function embudoDelRango(
  { programId, rango, claveCloser }: Alcance,
  db: Db = dbDeLaApp,
  ahora: Date = new Date(),
): Promise<EmbudoDelRango> {
  const [llamadas] = await db
    .select({
      agendas: sql<number>`count(*)::int`,
      llamadasConShow: sql<number>`count(*) filter (where ${llamadaOcurrio()})::int`,
    })
    .from(calls)
    .where(
      and(
        filtroLlamadas({ programId, rango, claveCloser }, db),
        vigente(calls),
      ),
    );

  const agendas = llamadas?.agendas ?? 0;
  const llamadasConShow = llamadas?.llamadasConShow ?? 0;
  const [cierres, grupo] = await Promise.all([
    ventasDelRango({ programId, rango, claveCloser }, db),
    grupoDeCitas(db, { programId, rango, ahora }),
  ]);
  const tasas = tasasDelAlcance(grupo, claveCloser);

  return {
    agendas,
    llamadasConShow,
    pctShow: tasas.pctShow,
    cierres,
    pctCierre: tasas.pctCierre,
    agendaAVenta: tasas.agendaAVenta,
    grupo: tasas,
    madurando: grupo.madurando,
  };
}

/** Deals que cerraron como perdidos en el rango, agrupados por su motivo. */
export async function dealsPerdidosPorMotivo(
  { programId, rango, claveCloser }: Alcance,
  db: Db = dbDeLaApp,
): Promise<{ motivo: string; deals: number }[]> {
  const idsCerrados = await cerradosEn(db, programId, rango);
  if (idsCerrados.length === 0) return [];

  return db
    .select({
      motivo: motivos.nombre,
      deals: sql<number>`count(*)::int`,
    })
    .from(deals)
    .innerJoin(motivos, eq(motivos.id, deals.motivoId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(
      and(
        eq(deals.etapa, "cierre_perdido"),
        vigente(deals),
        eq(deals.programId, programId),
        inArray(deals.id, idsCerrados),
        porClaveDeDeal(claveCloser),
      ),
    )
    .groupBy(motivos.nombre)
    .orderBy(sql`count(*) desc`);
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
export async function closersConCuenta(
  { programId, rango }: Omit<Alcance, "claveCloser">,
  db: Db = dbDeLaApp,
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
export async function embudoPorCloser(
  { programId, rango }: Omit<Alcance, "claveCloser">,
  db: Db = dbDeLaApp,
  ahora: Date = new Date(),
): Promise<(EmbudoDelRango & { clave: string; closerId: string | null; caja: CajaPorMoneda[] })[]> {
  const ancla = fechaAnclaCall();

  const [llamadasPorCloser, abonosPorCloser, cierresPorCloser, grupo] = await Promise.all([
    db
      .select({
        clave: claveCloserSql(users.id, calls.closerId),
        closerId: sql<string | null>`min(${etiquetaDeCloserSql(calls.closerId)})`,
        agendas: sql<number>`count(*)::int`,
        llamadasConShow: sql<number>`count(*) filter (where ${llamadaOcurrio()})::int`,
      })
      .from(calls)
      .leftJoin(
        users,
        or(
          eq(users.id, calls.closerUserId),
          and(
            isNull(calls.closerUserId),
            eq(claveDeCloserSql(users.closerId), claveDeCloserSql(calls.closerId)),
          ),
        ),
      )
      .where(
        and(
          eq(calls.programId, programId),
          between(ancla, rango.desde, rango.hasta),
          vigente(calls),
        ),
      )
      .groupBy(claveCloserSql(users.id, calls.closerId)),
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
          eq(abonos.programId, programId),
          between(abonos.fecha, rango.desde, rango.hasta),
          vigente(abonos),
        ),
      )
      .groupBy(claveCloserSql(users.id, abonos.closerId), abonos.moneda),
    ventasPorCloser({ programId, rango }, db),
    grupoDeCitas(db, { programId, rango, ahora }),
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
        llamadasConShow: 0,
        pctShow: null,
        cierres: 0,
        pctCierre: null,
        agendaAVenta: null,
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

  // Las tasas salen del grupo de citas (ADR 0079): cada deal cuenta en un solo closer.
  for (const fila of porClave.values()) {
    fila.grupo = tasasDelAlcance(grupo, fila.clave);
    fila.pctShow = fila.grupo.pctShow;
    fila.pctCierre = fila.grupo.pctCierre;
    fila.agendaAVenta = fila.grupo.agendaAVenta;
  }

  return [...porClave.values()];
}

export interface FilaEmbudoPorCanal {
  origen: OrigenDelHecho;
  canalId: string | null;
  canal: string | null;
  area: string | null;
  envios: number;
  agendas: number;
  shows: number;
  ventas: number;
  pctShow: number | null;
}

/** Reagrupa los hechos ya filtrados sin cambiar su universo. */
export function embudoPorCanal(
  hechos: FilaHechosDelEmbudo[],
  nombres: ReadonlyMap<string, { canal: string; area: string | null }>,
): FilaEmbudoPorCanal[] {
  const filas = new Map<string, FilaEmbudoPorCanal>();

  for (const hecho of hechos) {
    const clave = hecho.origen === "canal" ? `canal:${hecho.canalId ?? ""}` : hecho.origen;
    const nombre = hecho.canalId === null ? undefined : nombres.get(hecho.canalId);
    const fila = filas.get(clave) ?? {
      origen: hecho.origen,
      canalId: hecho.origen === "canal" ? hecho.canalId : null,
      canal: hecho.origen === "canal" ? (nombre?.canal ?? null) : null,
      area: hecho.origen === "canal" ? (nombre?.area ?? null) : null,
      envios: 0,
      agendas: 0,
      shows: 0,
      ventas: 0,
      pctShow: null,
    };
    fila.envios += hecho.envios;
    fila.agendas += hecho.agendas;
    fila.shows += hecho.shows;
    fila.ventas += hecho.ventas;
    filas.set(clave, fila);
  }

  const conTasa = [...filas.values()]
    .filter((fila) => fila.envios + fila.agendas + fila.shows + fila.ventas > 0)
    .map((fila) => ({ ...fila, pctShow: tasa(fila.shows, fila.agendas) }));
  const canalesAgrupados = conTasa
    .filter((fila) => fila.origen === "canal")
    .sort((a, b) => b.envios - a.envios || (a.canal ?? "").localeCompare(b.canal ?? ""));
  const ordenHuerfanos: OrigenDelHecho[] = ["sin_clasificar", "sin_utm", "sin_envio_origen"];
  return [
    ...canalesAgrupados,
    ...ordenHuerfanos.flatMap((origen) => conTasa.filter((fila) => fila.origen === origen)),
  ];
}

export async function nombresDeCanales(
  db: Db,
): Promise<Map<string, { canal: string; area: string | null }>> {
  const filas = await db
    .select({ id: canales.id, canal: canales.nombre, area: areas.nombre })
    .from(canales)
    .leftJoin(areas, eq(areas.id, canales.areaId));
  return new Map(filas.map((fila) => [fila.id, { canal: fila.canal, area: fila.area }]));
}

/**
 * Los vendidos de una cohorte entera (no del rango).
 *
 * 🎯 Esta es la UNICA metrica de venta que sobrevive al ticket 038, y sobrevive
 * porque tiene definicion honesta HOY: **una venta es un deal en Abonado o
 * Completo** (ADR 0037), y esta pregunta es de la cohorte completa, asi que no
 * necesita la fecha del movimiento —que es lo que tumba al embudo del rango y al
 * comparativo—. Contar deals a secas seria la trampa que el ticket 038 nombra: una
 * cifra inflada que no lanza ningun error.
 *
 * Con `claveCloser` cuenta solo los de ese closer, que es su CONTRIBUCION a la
 * cohorte; la meta sigue siendo la de la cohorte y no se reparte (ADR 0023). El
 * dueno de un deal es una FK a `users`, asi que una clave de cuenta se resuelve por
 * `deals.ownerUserId` y una historica cae al texto de `users.closerId` con
 * `igualCloser` (ADR 0030, ticket 167): la respuesta vive en `porClaveDeDeal`.
 */
async function ventasDeCohorte(
  cohorteId: string,
  db: Db,
  claveCloser?: string | null,
): Promise<number> {
  const deLaCohorte = and(
    eq(deals.cohortId, cohorteId),
    inArray(deals.etapa, [...ETAPAS_VENDIDAS]),
    eq(deals.cortesia, false),
  );
  const conteo = { n: sql<number>`count(*)::int` };

  // `vigente(deals)` va DENTRO de cada cadena y no izado a `deLaCohorte`, aunque
  // repetirlo se vea redundante: el guardian de `tests/vigencia-centralizada.test.ts`
  // lee cadena por cadena, y una condicion escondida en una variable le pasa por
  // debajo. Quien lee la consulta tiene que ver la decision ahi mismo.
  const [fila] =
    claveCloser == null
      // Sin closer no hace falta el join: `deals` solo, que incluye los Unclaimed.
      ? await db.select(conteo).from(deals).where(and(deLaCohorte, vigente(deals)))
      : await db
          .select(conteo)
          .from(deals)
          .innerJoin(users, eq(users.id, deals.ownerUserId))
          .where(and(deLaCohorte, vigente(deals), porClaveDeDeal(claveCloser)));

  return fila?.n ?? 0;
}

/**
 * Vista de la cohorte activa de un programa a fecha `hoy` ('YYYY-MM-DD', Bogota), o
 * `null` si el programa no tiene cohorte activa.
 *
 * `vendidos` es el conteo de deals VENDIDOS de TODA la cohorte, no del rango. Los dias
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
  const cohorte = await cohorteActiva(programId, db);
  if (!cohorte) return null;

  const meta = cohorte.metaCupos;
  // `vendidos` es SIEMPRE el de la cohorte completa: toda la matematica de meta
  // (dinamica, lineal, esperado, cumplimiento) se mide contra la cohorte, nunca
  // contra un closer. Lo del closer va aparte, como contribucion.
  const vendidos = await ventasDeCohorte(cohorte.id, db);
  const vendidosDelCloser =
    claveCloser == null ? null : await ventasDeCohorte(cohorte.id, db, claveCloser);
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

  if (!cohorte.fechaInicioVentas) return base;

  const inicio = cohorte.fechaInicioVentas;
  const cierre = cohorte.fechaCierreVentas;
  const { dia, total } = diaHabilDe(hoy, inicio, cierre);
  // Si hoy ya paso el cierre, `diasHabilesEntre(hoy, cierre)` da 0 por definicion.
  const habilesRestantes = diasHabilesEntre(hoy, cierre);
  const metaDin = metaDinamica({ meta, vendidos, diasHabilesRestantes: habilesRestantes });
  const metaLin = metaLineal({ meta, diasHabilesTotales: total });
  const esperado = metaLin * dia;

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
  { programId, rango, claveCloser }: Alcance,
  db: Db = dbDeLaApp,
): Promise<LeadsDelRango> {
  // Filtrado por closer no hay a que preguntarle: la atribucion vivia en
  // `responsableCloserId` y se fue con el ADR 0035. Ver la nota de `LeadsDelRango`.
  const [fila] = claveCloser
    ? [undefined]
    : await db
        .select({ n: sql<number>`count(*)::int` })
        .from(leads)
        .where(
          filtroLeads({ programId, rango, claveCloser }),
        );
  const conteoLeads = claveCloser ? null : (fila?.n ?? 0);

  const diasHabiles = diasHabilesEntre(rango.desde, rango.hasta);

  const cohorte = await cohorteActiva(programId, db);
  const metaLeadsDia = cohorte?.metaLeadsDia ?? null;
  const metaDelRango = metaLeadsDia === null ? null : metaLeadsDia * diasHabiles;
  const cumplimiento =
    conteoLeads === null || metaDelRango === null || metaDelRango === 0
      ? null
      : conteoLeads / metaDelRango;

  return { leads: conteoLeads, diasHabiles, metaLeadsDia, metaDelRango, cumplimiento };
}
