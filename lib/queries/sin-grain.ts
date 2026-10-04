import { and, isNull, or, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import { tasa, type Alcance } from "@/lib/queries/dashboard";
import { filtroLlamadas, llamadaOcurrio } from "@/lib/queries/metricas-filtros";
import { vigente } from "@/lib/queries/vigente";

/**
 * "¿Esta llamada fue atendida sin Grain?" (ADR 0066, ticket 135). UNA sola respuesta, derivada
 * y sin guardar nada: un resultado que ocurrio (`RESULTADOS_QUE_OCURRIERON`) con `link_grain`
 * vacio. Se apaga sola al pegar el Grain. El "sucedio sin grabar" tambien cuenta: no hay
 * excepcion por motivo. La vigencia NO va dentro del predicado: cada lector aplica
 * `vigente(calls)` en su propia cadena (guardian de `tests/vigencia-centralizada.test.ts`).
 */

export function sinGrabacion() {
  return or(isNull(calls.linkGrain), sql`trim(${calls.linkGrain}) = ''`);
}

export function atendidaSinGrain() {
  return and(llamadaOcurrio(), sinGrabacion());
}

export function esAtendidaSinGrain(call: {
  resultado: string;
  linkGrain: string | null;
  anuladoEn: Date | null;
}): boolean {
  return (
    call.anuladoEn == null &&
    (RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(call.resultado) &&
    (call.linkGrain == null || call.linkGrain.trim() === "")
  );
}

export async function showsSinGrain(
  alcance: Alcance,
  db: Db = dbDeLaApp,
): Promise<{ sinGrain: number; shows: number; pct: number | null }> {
  const [fila] = await db
    .select({
      sinGrain: sql<number>`count(*) filter (where ${atendidaSinGrain()})::int`,
      shows: sql<number>`count(*)::int`,
    })
    .from(calls)
    .where(and(filtroLlamadas(alcance, db), vigente(calls), llamadaOcurrio()));

  const sinGrain = fila?.sinGrain ?? 0;
  const shows = fila?.shows ?? 0;
  return { sinGrain, shows, pct: tasa(sinGrain, shows) };
}
