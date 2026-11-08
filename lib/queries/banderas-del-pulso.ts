import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, calls, deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { etapasQueExigen } from "@/lib/deals/requisitos";
import { tasa } from "@/lib/queries/dashboard";
import { porClaveDeDeal, porCohorteDeDeal } from "@/lib/queries/metricas-filtros";
import { atendidaSinGrain } from "@/lib/queries/sin-grain";
import { vigente } from "@/lib/queries/vigente";

/**
 * Las banderas rojas del Pulso que miran al deal (ticket 191; GC-20, GC-32): "atendido sin valor" y
 * "atendido sin Grain". Son una FOTO DE HOY, como la cartera: el periodo no las acota, porque lo que
 * falta sigue faltando sin importar cuándo se agendó. La cifra y su lista salen de estos predicados
 * (`metricas-con-filas.ts` los importa), así no pueden discrepar.
 */

/** Atendido o más adelante, sin Cierre perdido: un deal perdido no tiene nada que completar. */
export const ETAPAS_ATENDIDAS: readonly EtapaDeal[] = [
  "atendido", "compromiso_verbal", "ganado_parcial", "ganado_completo",
];

/**
 * El universo de las dos banderas: deals del programa en una etapa atendida, sin cortesías (no
 * llevan valor vendido, `requisitos.ts`). El closer es el dueño del deal; con una clave histórica
 * exige el join de `users` por `deals.ownerUserId`. La vigencia la pone cada lector en su cadena.
 */
export function filtroAtendidos({ programId, claveCloser, cohorteId }: { programId: string; claveCloser?: string | null; cohorteId?: string | null }) {
  return and(
    eq(deals.programId, programId),
    inArray(deals.etapa, [...ETAPAS_ATENDIDAS]),
    eq(deals.cortesia, false),
    porClaveDeDeal(claveCloser),
    porCohorteDeDeal(cohorteId),
  );
}

/**
 * Las etapas donde el 128 exige el valor vendido (Ganado parcial y Completo). Antes de ganar el valor
 * es 0 por defecto (`comercial.md` §8) y la ficha no lo pide: contarlo ahí pintaba de rojo a todo
 * atendido sin ganar (revisión del cadenero, 5-oct).
 */
export const ETAPAS_QUE_EXIGEN_VALOR: readonly EtapaDeal[] = etapasQueExigen("valor_vendido");

/** Sin el valor vendido que exige el 128 ("Falta el valor vendido"): nulo o cero, en una etapa que lo exige. */
export function sinValorVendido() {
  return sql`(${inArray(deals.etapa, [...ETAPAS_QUE_EXIGEN_VALOR])} and coalesce(${deals.valorVendidoUsd}, 0) <= 0)`;
}

/**
 * Con una llamada vigente atendida sin Grain (ADR 0066): la misma regla que la alerta roja de la
 * ficha del deal (`esAtendidaSinGrain`), ahora por deal y no por llamada.
 */
export function conLlamadaSinGrain(db: Db) {
  return inArray(
    deals.id,
    db.select({ id: calls.dealId })
      .from(calls)
      .where(and(isNotNull(calls.dealId), atendidaSinGrain(), vigente(calls))),
  );
}

/**
 * "Cierre perdido con pagos registrados" (ticket 405, ADR 0115 N3): un deal no anulado en Cierre perdido
 * que conserva al menos un abono vigente. Es una INCONSISTENCIA (plata cobrada sobre una venta perdida), no un
 * caso de negocio; hoy no debería haber ninguno y si aparece uno se ve en vez de quedar callado. Foto de hoy,
 * como las otras banderas. El universo vive aquí y lo usan la cifra y la lista (ADR 0067).
 */
export function filtroPerdidosConPagos({ programId, claveCloser, cohorteId }: { programId: string; claveCloser?: string | null; cohorteId?: string | null }) {
  return and(
    eq(deals.programId, programId),
    eq(deals.etapa, "cierre_perdido"),
    porClaveDeDeal(claveCloser),
    porCohorteDeDeal(cohorteId),
  );
}

/** Con al menos un abono vigente (un abono anulado no es plata cobrada). */
export function conAbonoVigente(db: Db) {
  return inArray(deals.id, db.select({ id: abonos.dealId }).from(abonos).where(vigente(abonos)));
}

export interface BanderaDelPulso {
  cantidad: number;
  /** Sobre los deals atendidos del mismo alcance; `null` si no hay ninguno. */
  pct: number | null;
}

export interface BanderasDelPulso {
  atendidos: number;
  sinValor: BanderaDelPulso;
  sinGrain: BanderaDelPulso;
  /** Sin porcentaje: no hay un denominador natural, cualquier caso es un error de datos. */
  perdidosConPagos: { cantidad: number };
}

export async function banderasDelPulso(
  alcance: { programId: string; claveCloser?: string | null; cohorteId?: string | null },
  db: Db = dbDeLaApp,
): Promise<BanderasDelPulso> {
  const [fila] = await db
    .select({
      atendidos: sql<number>`count(*)::int`,
      sinValor: sql<number>`count(*) filter (where ${sinValorVendido()})::int`,
      sinGrain: sql<number>`count(*) filter (where ${conLlamadaSinGrain(db)})::int`,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(filtroAtendidos(alcance), vigente(deals)));

  const [perdidos] = await db
    .select({ cantidad: sql<number>`count(*)::int` })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(filtroPerdidosConPagos(alcance), conAbonoVigente(db), vigente(deals)));

  const atendidos = fila?.atendidos ?? 0;
  const bandera = (cantidad: number): BanderaDelPulso => ({ cantidad, pct: tasa(cantidad, atendidos) });
  return {
    atendidos,
    sinValor: bandera(fila?.sinValor ?? 0),
    sinGrain: bandera(fila?.sinGrain ?? 0),
    perdidosConPagos: { cantidad: perdidos?.cantidad ?? 0 },
  };
}
