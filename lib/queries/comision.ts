import { eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * La comision de un closer: UNA sola definicion (ticket 062, ADR 0024). Se calcula, nunca se
 * guarda: guardarla la dejaria discrepar el dia que el monto cambie.
 *
 * **Monto fijo por venta, en USD** (Alejo, 29-sep): `comision = ventas × programs.comision_por_venta_usd`.
 * No es un porcentaje del precio: la hoja pagaba un monto fijo por venta en cada programa (los
 * valores estan en el ticket 062), y el precio de lista puede cambiar sin que cambie lo que gana
 * el closer. Usa el monto VIGENTE: cambiarlo cambia la cifra de todos los rangos. Congelar el
 * monto de cada venta seria otra decision, con su ADR.
 *
 * La moneda es siempre USD y va escrita al lado del numero (`usd` de `lib/format.ts`). Es por
 * programa: dos programas pagan distinto y la comision no se suma entre ellos (ADR 0048).
 */

/** Las ventas del closer por el monto del programa, o `null` si el programa no tiene monto cargado. */
export function comisionUsd(ventas: number, comisionPorVentaUsd: string | number | null): number | null {
  if (comisionPorVentaUsd === null) return null;
  return ventas * Number(comisionPorVentaUsd);
}

/** El monto por venta vigente de un programa, o `null` si no está cargado. */
export async function comisionPorVentaDe(programId: string, db: Db = dbDeLaApp): Promise<string | null> {
  const [fila] = await db
    .select({ monto: programs.comisionPorVentaUsd })
    .from(programs)
    .where(eq(programs.id, programId));
  return fila?.monto ?? null;
}
