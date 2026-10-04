import { sumaDeAbonos } from "@/lib/queries/saldo";
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { abonos, calls, deals, dealEtapaHistorial, leads, submissions, users } from "@/lib/db/schema";
import type { Alcance, CajaPorMoneda, Rango } from "@/lib/queries/dashboard";
import { claveDeCloser, claveDeCloserSql } from "@/lib/closers/identidad";
import { vigente } from "@/lib/queries/vigente";
import { atendidaSinGrain } from "@/lib/queries/sin-grain";
import {
  fechaAnclaAgendaCreada, fechaAnclaCall, fechaAnclaDealCreado, fechaAnclaLead, filtroAgendasCreadas,
  claveDeRegistradorDeAbono, closerDeAbono, filtroCaja, filtroCierres, filtroCortesias, filtroDealsCreados, filtroLeads, filtroLlamadas, llamadaOcurrio,
  primerosMovimientosDeVenta, filtroNoShows,
} from "@/lib/queries/metricas-filtros";

export type Metrica = "caja" | "agendas" | "shows" | "no_shows" | "shows_sin_grain" | "cierres" | "cortesias" | "leads" | "deals_creados" | "agendas_creadas";

/** Las métricas que no se atribuyen a un closer: con closer no hay cifra ("—"), nunca el programa entero. */
export const METRICAS_SIN_CLOSER: readonly Metrica[] = ["leads", "deals_creados", "agendas_creadas"];
export const TAMANO_PAGINA = 50;

export interface FiltrosDeMetrica {
  programId: string | readonly string[];
  rango: Rango;
  closerId?: string | null;
  moneda?: string;
  /** Fecha de calendario que entrega hoyEnBogota(), nunca el reloj del navegador. */
  hoy: string;
}

export interface FilaDeMetrica {
  id: string;
  dealId: string | null;
  fecha: string;
  closer: string | null;
  etapa: string | null;
  antiguedad: number;
  bucket: string;
  moneda: string | null;
  monto: number | null;
  cantidad: number;
}

export interface SubtotalDeMetrica {
  cantidad: number;
  caja: CajaPorMoneda[];
}

export interface ResumenDeMetrica {
  programId: string;
  disponible: boolean;
  subtotal: SubtotalDeMetrica;
  /** Cruce de las tres dimensiones, agregado en SQL; nunca contiene filas de negocio. */
  grupos: Pick<FilaDeMetrica, "closer" | "etapa" | "bucket" | "moneda" | "monto" | "cantidad">[];
}

export interface ListaDeMetrica extends ResumenDeMetrica {
  pagina: number;
  filas: FilaDeMetrica[];
}

/**
 * Lo que cambia de una métrica a otra: de qué tabla sale la fila, qué fecha la ancla y
 * de qué columna sale el closer. Todo lo demás (antigüedad, buckets, paginación) es común.
 */
interface FuenteDeMetrica {
  id: SQL | PgColumn;
  fecha: SQL<string>;
  columnaCloser: PgColumn | SQL;
}

function fuenteDe(metrica: Metrica): FuenteDeMetrica {
  switch (metrica) {
    case "caja":
      return { id: abonos.id, fecha: sql<string>`${abonos.fecha}`, columnaCloser: closerDeAbono() };
    case "agendas":
    case "shows":
    case "no_shows":
    case "shows_sin_grain":
      return { id: calls.id, fecha: fechaAnclaCall(), columnaCloser: calls.closerId };
    case "leads":
      return { id: leads.id, fecha: fechaAnclaLead(), columnaCloser: users.closerId };
    case "cierres":
    case "cortesias":
      return {
        id: deals.id,
        fecha: sql<string>`(${dealEtapaHistorial.fecha} AT TIME ZONE 'America/Bogota')::date`,
        columnaCloser: users.closerId,
      };
    // Ticket 138: el closer es solo contexto (el dueño del deal); estas métricas no se filtran por él.
    case "deals_creados":
      return { id: deals.id, fecha: fechaAnclaDealCreado(), columnaCloser: users.closerId };
    case "agendas_creadas":
      return { id: calls.id, fecha: fechaAnclaAgendaCreada(), columnaCloser: users.closerId };
  }
}

/**
 * Las columnas de la consulta. En el resumen (`pagina === null`) se agrupa en Postgres y
 * las columnas de fila salen nulas: el resumen nunca transfiere filas de negocio.
 */
function camposDe(metrica: Metrica, fuente: FuenteDeMetrica, hoy: string, resumen: boolean) {
  const esCaja = metrica === "caja";
  // Las agendas futuras tienen edad cero; no se inventa un quinto bucket negativo.
  const edad = sql<number>`greatest(0, ${hoy}::date - (${fuente.fecha})::date)`;
  const bucket = sql<string>`case
    when ${edad} <= 7 then '0-7'
    when ${edad} <= 30 then '8-30'
    when ${edad} <= 90 then '31-90'
    else '>90' end`;
  // En el resumen las columnas de fila no existen: salen nulas con el tipo de la fila.
  const nulo = sql<string>`null::text`;

  let montoDeLaFila = sql<number | null>`null::float8`;
  if (esCaja) {
    montoDeLaFila = resumen
      ? sql<number | null>`${sumaDeAbonos()}::float8`
      : sql<number | null>`${abonos.monto}::float8`;
  }

  return {
    id: resumen ? nulo : sql<string>`${fuente.id}::text`,
    dealId: resumen ? nulo : sql<string | null>`${deals.id}::text`,
    fecha: resumen ? nulo : sql<string>`${fuente.fecha}::text`,
    closer: resumen
      ? sql<string | null>`min(${fuente.columnaCloser})`
      : sql<string | null>`${fuente.columnaCloser}`,
    etapa: sql<string | null>`${deals.etapa}::text`,
    antiguedad: resumen ? sql<number>`0::int` : edad,
    bucket: bucket.as("bucket_antiguedad"),
    moneda: esCaja ? sql<string | null>`${abonos.moneda}` : nulo,
    monto: montoDeLaFila,
    cantidad: resumen ? sql<number>`count(*)::int` : sql<number>`1::int`,
  };
}

/**
 * La consulta de cada métrica, con el MISMO filtro que su cifra en el dashboard
 * (`metricas-filtros.ts`). Los joins solo aportan contexto (deal, etapa, closer): son
 * `left join` para no descartar un abono, una llamada o un lead sin deal. `vigente()` va
 * dentro de cada cadena porque el guardián de vigencia la lee cadena por cadena.
 */
function consultaDe(
  metrica: Metrica,
  campos: ReturnType<typeof camposDe>,
  alcance: Alcance,
  filtros: FiltrosDeMetrica,
  db: Db,
) {
  switch (metrica) {
    case "caja":
      return db
        .select(campos)
        .from(abonos)
        .leftJoin(deals, and(eq(deals.id, abonos.dealId), eq(deals.programId, abonos.programId), vigente(deals)))
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
            filtros.moneda ? eq(abonos.moneda, filtros.moneda) : undefined,
            vigente(abonos),
            vigente(deals),
          ),
        );
    case "agendas":
    case "shows":
    case "no_shows":
    case "shows_sin_grain":
      return db
        .select(campos)
        .from(calls)
        .leftJoin(deals, and(eq(deals.id, calls.dealId), eq(deals.programId, calls.programId), vigente(deals)))
        .where(
          and(
            filtroLlamadas(alcance),
            metrica === "shows" ? llamadaOcurrio() : undefined,
            metrica === "no_shows" ? filtroNoShows(alcance) : undefined,
            metrica === "shows_sin_grain" ? atendidaSinGrain() : undefined,
            vigente(calls),
            vigente(deals),
          ),
        );
    case "leads": {
      // Un lead puede tener varias oportunidades históricas. Su contexto es UNA sola:
      // la vigente más reciente, con id como desempate. El lead sigue contando una vez.
      const ultimoDeal = db
        .selectDistinctOn([deals.leadId], { id: deals.id })
        .from(deals)
        .where(and(eq(deals.programId, alcance.programId), vigente(deals)))
        .orderBy(deals.leadId, desc(deals.createdAt), desc(deals.id));
      return db
        .select(campos)
        .from(leads)
        .leftJoin(
          deals,
          and(
            eq(deals.leadId, leads.id),
            eq(deals.programId, leads.programId),
            inArray(deals.id, ultimoDeal),
            vigente(deals),
          ),
        )
        .leftJoin(users, eq(users.id, deals.ownerUserId))
        .where(and(filtroLeads(alcance), vigente(deals)));
    }
    case "cierres":
      return db
        .select(campos)
        .from(deals)
        .leftJoin(users, eq(users.id, deals.ownerUserId))
        .innerJoin(
          dealEtapaHistorial,
          and(
            eq(dealEtapaHistorial.dealId, deals.id),
            inArray(dealEtapaHistorial.id, primerosMovimientosDeVenta(db)),
          ),
        )
        .where(and(filtroCierres(alcance, db), vigente(deals)));
    case "cortesias":
      return db
        .select(campos)
        .from(deals)
        .leftJoin(users, eq(users.id, deals.ownerUserId))
        .innerJoin(
          dealEtapaHistorial,
          and(
            eq(dealEtapaHistorial.dealId, deals.id),
            inArray(dealEtapaHistorial.id, primerosMovimientosDeVenta(db)),
          ),
        )
        .where(and(filtroCortesias(alcance, db), vigente(deals)));
    case "deals_creados":
      return db
        .select(campos)
        .from(deals)
        .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
        .leftJoin(users, eq(users.id, deals.ownerUserId))
        .where(and(filtroDealsCreados(alcance), vigente(deals)));
    case "agendas_creadas":
      // Una llamada suelta (sin deal) también es una agenda: el join solo aporta contexto.
      return db
        .select(campos)
        .from(calls)
        .leftJoin(deals, and(eq(deals.id, calls.dealId), eq(deals.programId, calls.programId), vigente(deals)))
        .leftJoin(users, eq(users.id, deals.ownerUserId))
        .where(and(filtroAgendasCreadas(alcance), vigente(calls), vigente(deals)));
  }
}

/**
 * Lee el resumen (`pagina === null`, agrupado en Postgres) o una página de filas
 * (`limit`/`offset` en Postgres, más antiguas primero). La proyección cambia; el universo no.
 */
async function leerMetrica(
  metrica: Metrica,
  alcance: Alcance,
  filtros: FiltrosDeMetrica,
  pagina: number | null,
  db: Db,
): Promise<FilaDeMetrica[]> {
  const resumen = pagina === null;
  const fuente = fuenteDe(metrica);
  const campos = camposDe(metrica, fuente, filtros.hoy, resumen);
  const consulta = consultaDe(metrica, campos, alcance, filtros, db);

  if (resumen) {
    // El alias evita repetir el parámetro de hoy con posiciones distintas: Postgres no
    // considera $1 y $7 la misma expresión al validar un GROUP BY.
    const dimensiones: SQL[] = [
      metrica === "caja" ? claveDeRegistradorDeAbono() : claveDeCloserSql(fuente.columnaCloser),
      sql`${deals.etapa}`,
      sql`"bucket_antiguedad"`,
    ];
    if (metrica === "caja") dimensiones.push(sql`${abonos.moneda}`);
    return consulta.groupBy(...dimensiones);
  }

  return consulta
    .orderBy(asc(fuente.fecha), asc(fuente.id))
    .limit(TAMANO_PAGINA)
    .offset((pagina - 1) * TAMANO_PAGINA);
}

function subtotal(grupos: ResumenDeMetrica["grupos"]): SubtotalDeMetrica {
  const caja = new Map<string, number>();
  let cantidad = 0;
  for (const grupo of grupos) {
    cantidad += grupo.cantidad;
    if (grupo.moneda !== null && grupo.monto !== null) {
      caja.set(grupo.moneda, (caja.get(grupo.moneda) ?? 0) + grupo.monto);
    }
  }
  return {
    cantidad,
    caja: [...caja].map(([moneda, total]) => ({ moneda, total: Math.round(total * 100) / 100 })),
  };
}

/** Una sección por programa: no existe una salida que mezcle sus filas. */
export async function resumenDeMetrica(metrica: Metrica, filtros: FiltrosDeMetrica, db: Db = dbDeLaApp): Promise<ResumenDeMetrica[]> {
  const programas = typeof filtros.programId === "string" ? [filtros.programId] : [...new Set(filtros.programId)];
  return Promise.all(programas.map(async (programId) => {
    const grupos = await leerMetrica(metrica, { ...filtros, programId }, filtros, null, db);
    return {
      programId,
      disponible: !(METRICAS_SIN_CLOSER.includes(metrica) && filtros.closerId),
      subtotal: subtotal(grupos),
      grupos: grupos.map(({ closer, etapa, bucket, moneda, monto, cantidad }) => ({ closer, etapa, bucket, moneda, monto, cantidad })),
    };
  }));
}

/** El total incluye todas las páginas; las filas solo la página pedida, de tama?o fijo. */
export async function listaDeMetrica(metrica: Metrica, filtros: FiltrosDeMetrica, pagina = 1, db: Db = dbDeLaApp): Promise<ListaDeMetrica[]> {
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1_000_000) throw new Error("Página inválida");
  const secciones = await resumenDeMetrica(metrica, filtros, db);
  return Promise.all(secciones.map(async (seccion) => ({
    ...seccion,
    pagina,
    filas: await leerMetrica(metrica, { ...filtros, programId: seccion.programId }, filtros, pagina, db),
  })));
}

/** Una línea de un desglose del resumen: la etiqueta, cuántos y, en caja, cuánto por moneda. */
export interface LineaDeDesglose {
  etiqueta: string;
  cantidad: number;
  caja: CajaPorMoneda[];
}

export interface DesglosesDelResumen {
  porCloser: LineaDeDesglose[];
  porEtapa: LineaDeDesglose[];
  porAntiguedad: LineaDeDesglose[];
}

const ORDEN_DE_BUCKETS = ["0-7", "8-30", "31-90", ">90"];

/**
 * Parte el resumen en los tres desgloses que pide el ADR 0067 (closer, etapa, antigüedad).
 * El cruce de las tres dimensiones ya viene agregado de Postgres; aquí solo se re-suma en
 * memoria, sin filas de negocio. Cada desglose suma exactamente el subtotal.
 */
export function desglosesDelResumen(
  grupos: ResumenDeMetrica["grupos"],
  nombreDeEtapa: (etapa: string) => string,
): DesglosesDelResumen {
  type Grupo = ResumenDeMetrica["grupos"][number];

  /**
   * `claveDe` decide QUÉ se junta y `etiquetaDe` CÓMO se lee. Se separan por el closer:
   * `Ana` y `  ANA  ` son el mismo (ADR 0030) y juntarlos por el texto los partiría en dos.
   */
  function desglosar(claveDe: (grupo: Grupo) => string, etiquetaDe: (grupo: Grupo) => string): LineaDeDesglose[] {
    const porClave = new Map<string, { etiqueta: string; grupos: Grupo[] }>();
    for (const grupo of grupos) {
      const clave = claveDe(grupo);
      const existente = porClave.get(clave);
      if (existente) existente.grupos.push(grupo);
      else porClave.set(clave, { etiqueta: etiquetaDe(grupo), grupos: [grupo] });
    }
    return [...porClave.values()].map(({ etiqueta, grupos: delGrupo }) => {
      const total = subtotal(delGrupo);
      return { etiqueta, cantidad: total.cantidad, caja: total.caja };
    });
  }

  const etiquetaDeCloser = (g: Grupo) => g.closer?.trim() || "Sin closer";
  const etiquetaDeEtapa = (g: Grupo) => (g.etapa ? nombreDeEtapa(g.etapa) : "Sin deal");

  const porCantidad = (a: LineaDeDesglose, b: LineaDeDesglose) =>
    b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta);

  return {
    porCloser: desglosar((g) => (g.closer ? claveDeCloser(g.closer) : ""), etiquetaDeCloser).sort(porCantidad),
    porEtapa: desglosar(etiquetaDeEtapa, etiquetaDeEtapa).sort(porCantidad),
    porAntiguedad: desglosar((g) => g.bucket, (g) => g.bucket).sort(
      (a, b) => ORDEN_DE_BUCKETS.indexOf(a.etiqueta) - ORDEN_DE_BUCKETS.indexOf(b.etiqueta),
    ),
  };
}
