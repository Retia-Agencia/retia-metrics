import { and, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";
import { tokensDeHoja } from "@/lib/sheets/tokens-hoja";

/**
 * Conciliacion Sheets ↔ CRM por programa (ticket 110): la prueba de que "todo lo que
 * entra a Sheets va al CRM tambien" (Mani, 28-sep). Mientras la hoja y el CRM convivan
 * (hasta el traslado de la etapa 7), compara los tokens de envio de la pestana fuente
 * contra los de `submissions` y muestra que falta en cada lado.
 *
 * Corre al ABRIR la pantalla, con boton de refrescar, sin cron (decision de Mani): asi
 * no hay otro proceso que escriba en produccion. Y NUNCA escribe en la hoja: solo lee.
 *
 * El nucleo es una funcion PURA (`conciliarTokens`): dos sets de tokens entran, la
 * diferencia sale. La red (leer la hoja) y la base (leer submissions) quedan afuera,
 * en `conciliarProgramaConHoja`, para que la logica se pruebe sin Sheets real.
 */

export interface Conciliacion {
  /** Tokens que estan en la hoja pero NO en el CRM: envios que no llegaron a la base. */
  enHojaNoEnCrm: string[];
  /** Tokens que estan en el CRM pero NO en la hoja: envios del CRM sin fila en la hoja. */
  enCrmNoEnHoja: string[];
  /** Cuantos tokens tiene cada lado (para el resumen: "1.253 en la hoja, 1.253 en el CRM"). */
  totalHoja: number;
  totalCrm: number;
}

/**
 * La diferencia entre dos conjuntos de tokens. PURA: sin red, sin base. La ordena para
 * que la pantalla no baile entre corridas.
 */
export function conciliarTokens(tokensHoja: Set<string>, tokensCrm: Set<string>): Conciliacion {
  const enHojaNoEnCrm: string[] = [];
  for (const t of tokensHoja) if (!tokensCrm.has(t)) enHojaNoEnCrm.push(t);
  const enCrmNoEnHoja: string[] = [];
  for (const t of tokensCrm) if (!tokensHoja.has(t)) enCrmNoEnHoja.push(t);

  enHojaNoEnCrm.sort();
  enCrmNoEnHoja.sort();
  return {
    enHojaNoEnCrm,
    enCrmNoEnHoja,
    totalHoja: tokensHoja.size,
    totalCrm: tokensCrm.size,
  };
}

/** El resultado de conciliar un programa: la diferencia, o por que no se pudo. */
export type ResultadoConciliacion =
  | { estado: "ok"; conciliacion: Conciliacion }
  | { estado: "sin_hoja" }
  | { estado: "error"; mensaje: string };

/**
 * Concilia un programa: lee los tokens de su hoja (la fuente de tipo `google_sheet`,
 * hoy inactiva) y los de sus `submissions`, y los compara. El programa es frontera:
 * los tokens del CRM son SOLO de las fuentes de ESE programa.
 *
 * Si el programa no tiene una fuente `google_sheet` con hoja configurada, devuelve
 * `sin_hoja` (no hay nada que conciliar, no es un error). Si la lectura de la hoja
 * falla (hoja no compartida, encabezado sin columna de token), devuelve `error` con el
 * mensaje: la pantalla lo muestra sin tumbarse.
 */
export async function conciliarProgramaConHoja(
  programId: string,
  db: Db = dbDeLaApp,
): Promise<ResultadoConciliacion> {
  const [hoja] = await db
    .select({
      sheetId: sources.sheetId,
      tab: sources.tab,
      rango: sources.rango,
      mapeoColumnas: sources.mapeoColumnas,
    })
    .from(sources)
    .where(and(eq(sources.programId, programId), eq(sources.tipo, "google_sheet")))
    .limit(1);

  if (!hoja?.sheetId || !hoja.tab) return { estado: "sin_hoja" };

  let tokensHoja: Set<string>;
  try {
    tokensHoja = await tokensDeHoja(hoja.sheetId, hoja.tab, {
      rango: hoja.rango,
      mapeo: (hoja.mapeoColumnas as MapeoColumnas | null) ?? null,
    });
  } catch (e) {
    return { estado: "error", mensaje: e instanceof Error ? e.message : String(e) };
  }

  const tokensCrm = await tokensDeSubmissions(db, programId);
  return { estado: "ok", conciliacion: conciliarTokens(tokensHoja, tokensCrm) };
}

/**
 * Los tokens de todos los envios del CRM de un programa. Se agrupa por la fuente del
 * programa (frontera). No se filtra por `google_sheet`: un token que entro por webhook
 * y NO esta en la hoja es justo lo que la conciliacion quiere ver.
 */
async function tokensDeSubmissions(db: Db, programId: string): Promise<Set<string>> {
  const filas = await db
    .select({ token: submissions.token })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(eq(sources.programId, programId));
  return new Set(filas.map((f) => f.token));
}
