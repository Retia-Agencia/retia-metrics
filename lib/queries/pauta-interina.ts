import { and, between, eq, sql } from "drizzle-orm";
import { columnasUtmDelEnvio, esMacro, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { calls, deals, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import type { Rango } from "@/lib/queries/dashboard";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

/**
 * La vista interina de Pauta (ticket 093, enmienda del 29-sep): registros y agendas por UTM,
 * con lo que YA hay en la base, mientras llegan el catalogo de canales (101), el emparejador
 * (085) y el embudo de Pauta (123). Todo por programa: el programa es frontera (ADR 0043).
 *
 * Las definiciones son las de `docs/analytics.md` §6 y viven SOLO aqui:
 * - **Registro** = un token con envio COMPLETO, fechado por ese envio en Bogota (DP-11): el
 *   parcial y la completa del mismo token cuentan una vez, porque el parcial no cuenta.
 * - **Agenda** = una llamada vigente creada en el rango (`calls.created_at`), atribuida a los
 *   UTM del envio de origen de SU deal (ADR 0060). Una llamada sin deal, o de un deal sin envio
 *   de origen, va a la categoria "sin envio de origen": nunca se adivina de donde vino.
 * - **Sin UTM** = sin `utm_source`, `utm_medium` ni `utm_campaign`: un hecho del envio, no un
 *   error (ADR 0045). **Macro** = algun valor trae `{{...}}` sin expandir: un centinela, no un
 *   dato, y se cuenta aparte.
 *
 * La salida es una SERIE con dimensiones (dia + los cinco UTM + categoria): la pantalla agrupa
 * como quiera, y un filtro nuevo no toca la consulta.
 */

export type CategoriaOrigen = "con_utm" | "sin_utm" | "macro" | "sin_envio_origen";

export interface DimensionesUtm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  /** Crudo, tal como llego. Su significado depende del canal (ADR 0062): aqui no se interpreta. */
  content: string | null;
  /** Crudo, tal como llego. Su significado depende del canal (ADR 0062): aqui no se interpreta. */
  term: string | null;
}

export interface FilaPauta extends DimensionesUtm {
  /** Dia de Bogota, `YYYY-MM-DD`. */
  dia: string;
  categoria: CategoriaOrigen;
  registros: number;
  agendas: number;
}

export interface FiltrosPauta {
  source?: string;
  medium?: string;
  campaign?: string;
}

export interface EnvioSinUtm {
  id: string;
  fechaEnvio: Date;
  nombre: string | null;
}

export interface VistaPautaInterina {
  /** La serie, ya con los filtros de UTM aplicados. */
  filas: FilaPauta[];
  /**
   * Las categorias del rango SIN los filtros de UTM: "sin UTM" es una categoria del total, y
   * filtrar por un canal la haria desaparecer.
   */
  resumen: {
    registros: number;
    sinUtm: number;
    macro: number;
    agendas: number;
    agendasSinEnvioDeOrigen: number;
  };
  /** Los registros SIN UTM de HOY (DP-17: contador visible, sin umbral), con su lista, mire el rango que mire. */
  sinUtmHoy: EnvioSinUtm[];
}

/** El dia de Bogota de una columna `timestamptz`, el mismo ancla que usa el dashboard. */
const diaEnBogota = (columna: typeof submissions.fechaEnvio | typeof calls.createdAt) =>
  sql<string>`(${columna} AT TIME ZONE 'America/Bogota')::date`;

export function categoriaDe(d: DimensionesUtm): Exclude<CategoriaOrigen, "sin_envio_origen"> {
  const valores = [d.source, d.medium, d.campaign, d.content, d.term];
  if (valores.some(esMacro)) return "macro";
  if (d.source === null && d.medium === null && d.campaign === null) return "sin_utm";
  return "con_utm";
}

const DIMENSIONES_VACIAS: DimensionesUtm = { source: null, medium: null, campaign: null, content: null, term: null };

function pasaFiltros(d: DimensionesUtm, f: FiltrosPauta): boolean {
  if (f.source !== undefined && d.source !== f.source) return false;
  if (f.medium !== undefined && d.medium !== f.medium) return false;
  if (f.campaign !== undefined && d.campaign !== f.campaign) return false;
  return true;
}

/**
 * Los envios completos de las fuentes de ESTE programa cuyo dia de Bogota cae en el rango. El
 * rango son dias en texto, como en el dashboard: ningun `Date` entra a la plantilla (AGENTS.md).
 */
async function enviosCompletos(db: Db, programId: string, rango: Rango) {
  return db
    .select({
      id: submissions.id,
      fechaEnvio: submissions.fechaEnvio,
      nombre: submissions.nombre,
      ...columnasUtmDelEnvio,
    })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(
      and(
        eq(sources.programId, programId),
        eq(submissions.esParcial, false),
        between(diaEnBogota(submissions.fechaEnvio), rango.desde, rango.hasta),
      ),
    );
}

function dimensionesDe(e: Parameters<typeof utmsDelEnvio>[0]): DimensionesUtm {
  const { source, medium, campaign, content, term } = utmsDelEnvio(e);
  return { source, medium, campaign, content, term };
}

export async function pautaInterina(
  db: Db,
  programId: string,
  rango: Rango,
  filtros: FiltrosPauta = {},
  hoy: string,
): Promise<VistaPautaInterina> {
  const envios = await enviosCompletos(db, programId, rango);

  // Las agendas del rango con el envio de origen de su deal. Left joins: una llamada suelta o
  // un deal sin origen siguen contando como agenda, en su propia categoria. Lo que decide si
  // una agenda cuenta es la vigencia de la LLAMADA; el deal solo presta su origen, que es un
  // hecho y no cambia porque el deal se anule. Por eso `incluyendoAnulados(deals)`, escrito.
  const agendas = await db
    .select({
      createdAt: calls.createdAt,
      origenId: submissions.id,
      ...columnasUtmDelEnvio,
    })
    .from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(
      and(
        eq(calls.programId, programId),
        vigente(calls),
        between(diaEnBogota(calls.createdAt), rango.desde, rango.hasta),
      ),
    );

  const serie = new Map<string, FilaPauta>();
  const resumen = { registros: 0, sinUtm: 0, macro: 0, agendas: 0, agendasSinEnvioDeOrigen: 0 };
  const sumar = (dia: string, categoria: CategoriaOrigen, d: DimensionesUtm, campo: "registros" | "agendas") => {
    if (!pasaFiltros(d, filtros)) return;
    const llave = JSON.stringify([dia, categoria, d.source, d.medium, d.campaign, d.content, d.term]);
    const fila = serie.get(llave) ?? { dia, categoria, ...d, registros: 0, agendas: 0 };
    fila[campo]++;
    serie.set(llave, fila);
  };

  for (const e of envios) {
    // El filtro de fecha ya descarto los nulos; el tipo no lo sabe.
    if (e.fechaEnvio === null) continue;
    const d = dimensionesDe(e);
    const categoria = categoriaDe(d);
    resumen.registros++;
    if (categoria === "sin_utm") resumen.sinUtm++;
    if (categoria === "macro") resumen.macro++;
    sumar(fechaDeInstanteEnBogota(e.fechaEnvio), categoria, d, "registros");
  }

  for (const a of agendas) {
    const dia = fechaDeInstanteEnBogota(a.createdAt);
    resumen.agendas++;
    if (a.origenId === null) {
      resumen.agendasSinEnvioDeOrigen++;
      sumar(dia, "sin_envio_origen", DIMENSIONES_VACIAS, "agendas");
      continue;
    }
    const d = dimensionesDe(a);
    sumar(dia, categoriaDe(d), d, "agendas");
  }

  // "Hoy llegaron N sin UTM" (DP-17) es de HOY, mire el rango que mire la pantalla.
  const sinUtmHoy: EnvioSinUtm[] = (await enviosCompletos(db, programId, { desde: hoy, hasta: hoy }))
    .filter((e) => e.fechaEnvio !== null && categoriaDe(dimensionesDe(e)) === "sin_utm")
    .map((e) => ({ id: e.id, fechaEnvio: e.fechaEnvio!, nombre: e.nombre }))
    .sort((x, y) => y.fechaEnvio.getTime() - x.fechaEnvio.getTime());
  return { filas: [...serie.values()], resumen, sinUtmHoy };
}
