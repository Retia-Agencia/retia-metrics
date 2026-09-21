import { and, between, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, calls, motivos, origenes, leads, sales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilDe, diasHabilesEntre, metaDinamica, metaLineal } from "@/lib/dias-habiles";
import { claveDeCloser, claveDeCloserSql, igualCloser } from "@/lib/closers/identidad";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { vigente } from "@/lib/queries/vigente";

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
 * (`sales.fecha`, `abonos.fecha`) se comparan directo con `between`.
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
 * `closerId` ausente o `null` = todo el programa. Cuando trae un valor, la consulta
 * responde por ese closer solo (ticket 005). Es el texto copiado del closer
 * logueado (ADR 0011), no un id de `users`.
 *
 * Lo que el filtro NO hace es partir las metas: la meta de cupos y la de leads/dia
 * son de la cohorte (ADR 0022) y no existe reparto por closer en la base.
 */
export interface AlcanceDePrograma {
  programId: string;
  closerId?: string | null;
}

export interface Alcance extends AlcanceDePrograma {
  rango: Rango;
}

export interface CajaPorMoneda {
  moneda: string;
  total: number;
}

export interface EmbudoDelRango {
  agendas: number;
  llamadasConShow: number;
  pctShow: number | null;
  cierres: number;
  ventas: number;
  pctCierre: number | null;
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
  leads: number;
  diasHabiles: number;
  metaLeadsDia: number | null;
  metaDelRango: number | null;
  cumplimiento: number | null;
}

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
function fechaAnclaCall() {
  return sql<string>`(coalesce(${calls.fechaAgenda}, ${calls.fechaLlamada}) AT TIME ZONE 'America/Bogota')::date`;
}

/**
 * Condicion opcional de closer. `and()` de drizzle descarta los `undefined`, asi que
 * sin closer la consulta queda exactamente igual que antes del ticket 005: el filtro
 * no puede cambiar el total del programa.
 */
function delCloser(columna: PgColumn, closerId: string | null | undefined) {
  // Sin distinguir mayusculas (ADR 0030): `Mani` y `mani` son el mismo closer, y
  // la respuesta a eso vive en `lib/closers/identidad.ts`, no aca.
  return closerId == null ? undefined : igualCloser(columna, closerId);
}

/** Tasa que nunca divide por cero: `null` cuando el denominador es 0. */
function tasa(numerador: number, denominador: number): number | null {
  return denominador === 0 ? null : numerador / denominador;
}

/**
 * Caja recaudada del rango, agrupada por moneda (ADR 0013). Suma `abonos.monto`
 * por `abonos.fecha` entre `desde` y `hasta`, inclusive. Nunca convierte moneda:
 * devuelve una fila por moneda presente en el rango.
 */
export async function cajaRecaudada(
  { programId, rango, closerId }: Alcance,
  db: Db = dbDeLaApp,
): Promise<CajaPorMoneda[]> {
  return db
    .select({
      moneda: abonos.moneda,
      total: sql<number>`sum(${abonos.monto})::float8`,
    })
    .from(abonos)
    .where(
      and(
        eq(abonos.programId, programId),
        between(abonos.fecha, rango.desde, rango.hasta),
        delCloser(abonos.closerId, closerId),
        vigente(abonos),
      ),
    )
    .groupBy(abonos.moneda);
}

/**
 * Compromisos de pago abiertos del programa (decision de Mani). Un compromiso
 * abierto es un pendiente operativo: una llamada con `resultado = 'compromiso_pago'`
 * cuya persona todavia no tiene ninguna fila en `sales` de ese programa. NO se acota
 * al rango: un compromiso de hace tres semanas sigue abierto si nadie cerro. Se une
 * la venta por `sales.personId = calls.personId` dentro del mismo programa.
 */
export async function compromisosAbiertos(
  { programId, closerId }: AlcanceDePrograma,
  db: Db = dbDeLaApp,
): Promise<number> {
  // Las personas que YA vendieron en el programa. Antes esto era un `not exists`
  // correlacionado contra `calls.personId`; se reescribio como subconsulta
  // independiente porque una correlacion mezcla en una sola consulta dos decisiones
  // de vigencia distintas (la de la venta, que es de aca, y la de la llamada, que es
  // de la consulta externa) y deja de poder leerse. `isNotNull` es obligatorio: un
  // `not in` contra una lista con un `null` no devuelve NINGUNA fila, en silencio.
  const personasQueYaVendieron = db
    .select({ personId: sales.personId })
    .from(sales)
    .where(and(eq(sales.programId, programId), isNotNull(sales.personId), vigente(sales)));

  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(calls)
    .where(
      and(
        eq(calls.programId, programId),
        eq(calls.resultado, "compromiso_pago"),
        notInArray(calls.personId, personasQueYaVendieron),
        vigente(calls),
        // El filtro acota QUIEN tomo el compromiso, no la venta que lo cierra: si
        // otro closer cerro a esa persona, el compromiso dejo de estar abierto para
        // todos. Por eso `personasQueYaVendieron` de arriba nunca lleva closer.
        delCloser(calls.closerId, closerId),
      ),
    );

  return fila?.n ?? 0;
}

/**
 * Embudo de llamadas y ventas del rango. `agendas`, `llamadasConShow` y `cierres`
 * salen de `calls` ancladas en `coalesce(fechaAgenda, fechaLlamada)`. `ventas` es el
 * conteo de `sales` por `sales.fecha` (ADR 0013): NO es el numerador de ninguna tasa.
 */
export async function embudoDelRango(
  { programId, rango, closerId }: Alcance,
  db: Db = dbDeLaApp,
): Promise<EmbudoDelRango> {
  const ancla = fechaAnclaCall();
  const [llamadas] = await db
    .select({
      agendas: sql<number>`count(*)::int`,
      llamadasConShow: sql<number>`count(*) filter (where ${calls.resultado} in ('show','compromiso_pago','cerrada'))::int`,
      cierres: sql<number>`count(*) filter (where ${calls.resultado} = 'cerrada')::int`,
    })
    .from(calls)
    .where(
      and(
        eq(calls.programId, programId),
        between(ancla, rango.desde, rango.hasta),
        delCloser(calls.closerId, closerId),
        vigente(calls),
      ),
    );

  const [ventasFila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sales)
    .where(
      and(
        eq(sales.programId, programId),
        between(sales.fecha, rango.desde, rango.hasta),
        delCloser(sales.closerId, closerId),
        vigente(sales),
      ),
    );

  const agendas = llamadas?.agendas ?? 0;
  const llamadasConShow = llamadas?.llamadasConShow ?? 0;
  const cierres = llamadas?.cierres ?? 0;

  return {
    agendas,
    llamadasConShow,
    pctShow: tasa(llamadasConShow, agendas),
    cierres,
    ventas: ventasFila?.n ?? 0,
    pctCierre: tasa(cierres, llamadasConShow),
  };
}

/**
 * Conteo de llamadas del rango agrupadas por motivo del catalogo `motivos` (join por
 * `calls.motivoId`, decision de Mani). Las filas viejas de Sheets que traen
 * `calls.motivoPerdida` como texto libre y sin `motivoId` quedan fuera del conteo:
 * el join interno las descarta. Se anclan por `coalesce(fechaAgenda, fechaLlamada)`
 * como todo el embudo de llamadas. Ordenado de mas a menos llamadas.
 */
export async function llamadasPorMotivo(
  { programId, rango, closerId }: Alcance,
  db: Db = dbDeLaApp,
): Promise<{ motivo: string; llamadas: number }[]> {
  const ancla = fechaAnclaCall();
  return db
    .select({
      motivo: motivos.nombre,
      llamadas: sql<number>`count(*)::int`,
    })
    .from(calls)
    .innerJoin(motivos, eq(motivos.id, calls.motivoId))
    .where(
      and(
        eq(calls.programId, programId),
        between(ancla, rango.desde, rango.hasta),
        delCloser(calls.closerId, closerId),
        vigente(calls),
      ),
    )
    .groupBy(motivos.nombre)
    .orderBy(sql`count(*) desc`);
}

/**
 * El mismo embudo del rango pero desglosado por closer, mas la caja de cada uno.
 *
 * Cruza TRES tablas por el texto `closerId` (`calls.closerId`, `sales.closerId`,
 * `abonos.closerId`): es texto copiado del closer logueado, no una relacion a `users`
 * (ADR 0011). Por eso el desglose se arma en memoria uniendo las tres agregaciones
 * por ese texto: un closer que en el rango solo tiene abonos (ningun call ni venta)
 * igual aparece en la lista, con su caja y ceros en el embudo. Los conteos por closer
 * suman el total del programa.
 *
 * Es el comparativo entre closers, y por eso su alcance NO admite `closerId`: filtrarlo
 * lo dejaria en una fila y el comparativo es justo lo que "todos ven todo" garantiza
 * (ADR 0009). El tipo lo impide; no es una convencion que haya que recordar.
 */
export async function embudoPorCloser(
  { programId, rango }: Omit<Alcance, "closerId">,
  db: Db = dbDeLaApp,
): Promise<(EmbudoDelRango & { closerId: string | null; caja: CajaPorMoneda[] })[]> {
  const ancla = fechaAnclaCall();

  const [llamadasPorCloser, ventasPorCloser, abonosPorCloser] = await Promise.all([
    db
      .select({
        // Se agrupa por la clave NORMALIZADA (ADR 0030) y se devuelve un
        // representante real de la ortografia con `min(...)`: la identidad es la
        // clave, lo que se pinta es una de las formas en que esta escrito.
        closerId: sql<string | null>`min(${calls.closerId})`,
        agendas: sql<number>`count(*)::int`,
        llamadasConShow: sql<number>`count(*) filter (where ${calls.resultado} in ('show','compromiso_pago','cerrada'))::int`,
        cierres: sql<number>`count(*) filter (where ${calls.resultado} = 'cerrada')::int`,
      })
      .from(calls)
      .where(
        and(
          eq(calls.programId, programId),
          between(ancla, rango.desde, rango.hasta),
          vigente(calls),
        ),
      )
      .groupBy(claveDeCloserSql(calls.closerId)),
    db
      .select({
        closerId: sql<string | null>`min(${sales.closerId})`,
        ventas: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.programId, programId),
          between(sales.fecha, rango.desde, rango.hasta),
          vigente(sales),
        ),
      )
      .groupBy(claveDeCloserSql(sales.closerId)),
    db
      .select({
        closerId: sql<string | null>`min(${abonos.closerId})`,
        moneda: abonos.moneda,
        total: sql<number>`sum(${abonos.monto})::float8`,
      })
      .from(abonos)
      .where(
        and(
          eq(abonos.programId, programId),
          between(abonos.fecha, rango.desde, rango.hasta),
          vigente(abonos),
        ),
      )
      .groupBy(claveDeCloserSql(abonos.closerId), abonos.moneda),
  ]);

  // Clave estable para agrupar por closer. Es la NORMALIZADA (ADR 0030): las tres
  // agregaciones vienen agrupadas por el texto crudo, asi que si una hoja trae
  // `Mani` y la app escribio `mani`, es esta union en memoria la que los junta en
  // una sola fila. Se conserva el texto original de la primera fila que llega para
  // mostrarlo: la identidad es la clave, la ortografia que se pinta es un
  // representante.
  const claveDe = claveDeCloser;

  const porClave = new Map<
    string,
    EmbudoDelRango & { closerId: string | null; caja: CajaPorMoneda[] }
  >();

  const asegurar = (closerId: string | null) => {
    const clave = claveDe(closerId);
    let fila = porClave.get(clave);
    if (!fila) {
      fila = {
        closerId,
        agendas: 0,
        llamadasConShow: 0,
        pctShow: null,
        cierres: 0,
        ventas: 0,
        pctCierre: null,
        caja: [],
      };
      porClave.set(clave, fila);
    }
    return fila;
  };

  for (const l of llamadasPorCloser) {
    const fila = asegurar(l.closerId);
    fila.agendas = l.agendas;
    fila.llamadasConShow = l.llamadasConShow;
    fila.cierres = l.cierres;
  }
  for (const v of ventasPorCloser) {
    asegurar(v.closerId).ventas = v.ventas;
  }
  for (const a of abonosPorCloser) {
    asegurar(a.closerId).caja.push({ moneda: a.moneda, total: a.total });
  }

  // Las tasas se calculan una vez armados los conteos, sin dividir por cero.
  for (const fila of porClave.values()) {
    fila.pctShow = tasa(fila.llamadasConShow, fila.agendas);
    fila.pctCierre = tasa(fila.cierres, fila.llamadasConShow);
  }

  return [...porClave.values()];
}

/**
 * El embudo de llamadas del rango desglosado por origen del lead. Es SOLO de
 * llamadas: `sales` y `abonos` no tienen `origenId`, asi que este desglose no lleva
 * ventas ni caja. Las llamadas sin `origenId` van a un grupo con `origen: null`, no
 * se descartan. Se anclan por `coalesce(fechaAgenda, fechaLlamada)` como todo el
 * embudo. Los conteos por origen suman el total de llamadas del programa.
 */
export async function embudoPorOrigen(
  { programId, rango, closerId }: Alcance,
  db: Db = dbDeLaApp,
): Promise<
  {
    origen: string | null;
    agendas: number;
    llamadasConShow: number;
    cierres: number;
    pctShow: number | null;
    pctCierre: number | null;
  }[]
> {
  const ancla = fechaAnclaCall();
  const filas = await db
    .select({
      origen: origenes.nombre,
      agendas: sql<number>`count(*)::int`,
      llamadasConShow: sql<number>`count(*) filter (where ${calls.resultado} in ('show','compromiso_pago','cerrada'))::int`,
      cierres: sql<number>`count(*) filter (where ${calls.resultado} = 'cerrada')::int`,
    })
    .from(calls)
    // leftJoin para no perder las llamadas sin origenId: caen en el grupo null.
    .leftJoin(origenes, eq(origenes.id, calls.origenId))
    .where(
      and(
        eq(calls.programId, programId),
        between(ancla, rango.desde, rango.hasta),
        delCloser(calls.closerId, closerId),
        vigente(calls),
      ),
    )
    .groupBy(origenes.nombre);

  return filas.map((f) => ({
    origen: f.origen,
    agendas: f.agendas,
    llamadasConShow: f.llamadasConShow,
    cierres: f.cierres,
    pctShow: tasa(f.llamadasConShow, f.agendas),
    pctCierre: tasa(f.cierres, f.llamadasConShow),
  }));
}

/**
 * Conteo de `sales` de una cohorte entera (no del rango): los vendidos de la cohorte.
 * Con `closerId` cuenta solo los de ese closer, que es su CONTRIBUCION a la cohorte;
 * la meta sigue siendo la de la cohorte.
 */
async function ventasDeCohorte(
  cohorteId: string,
  db: Db,
  closerId?: string | null,
): Promise<number> {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sales)
    .where(and(eq(sales.cohortId, cohorteId), delCloser(sales.closerId, closerId), vigente(sales)));
  return fila?.n ?? 0;
}

/**
 * Vista de la cohorte activa de un programa a fecha `hoy` ('YYYY-MM-DD', Bogota), o
 * `null` si el programa no tiene cohorte activa.
 *
 * `vendidos` es el conteo de `sales` de TODA la cohorte, no del rango. Los dias
 * habiles de la ventana salen SIEMPRE de `fechaInicioVentas` y `fechaCierreVentas`
 * (ADR 0022), inclusive en ambos extremos, nunca de un calculo. Si la cohorte no
 * tiene `fechaInicioVentas` (cohortes cerradas viejas), `ventana` es `null`: no se
 * inventa ningun dia habil.
 */
export async function vistaDeCohorteActiva(
  { programId, closerId }: AlcanceDePrograma,
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
    closerId == null ? null : await ventasDeCohorte(cohorte.id, db, closerId);
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
  { programId, rango, closerId }: Alcance,
  db: Db = dbDeLaApp,
): Promise<LeadsDelRango> {
  const anclaLead = sql<string>`(${leads.fechaPrimeraAplicacion} AT TIME ZONE 'America/Bogota')::date`;
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.programId, programId),
        eq(leads.entrada, "formulario"),
        between(anclaLead, rango.desde, rango.hasta),
        // Con closer, los leads suyos son de los que es RESPONSABLE (ADR 0021). Ojo:
        // "sin responsable" es un estado valido, asi que la suma de los closers no
        // tiene por que dar el total del programa. La pantalla lo dice.
        delCloser(leads.responsableCloserId, closerId),
      ),
    );
  const conteoLeads = fila?.n ?? 0;

  const diasHabiles = diasHabilesEntre(rango.desde, rango.hasta);

  const cohorte = await cohorteActiva(programId, db);
  const metaLeadsDia = cohorte?.metaLeadsDia ?? null;
  const metaDelRango = metaLeadsDia === null ? null : metaLeadsDia * diasHabiles;
  const cumplimiento =
    metaDelRango === null || metaDelRango === 0 ? null : conteoLeads / metaDelRango;

  return { leads: conteoLeads, diasHabiles, metaLeadsDia, metaDelRango, cumplimiento };
}
