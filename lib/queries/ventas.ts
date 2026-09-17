import { eq, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, sales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Lecturas de una venta y lo que lleva pagado (ticket 019, ADR 0013). La base entra
 * por inyeccion (por defecto la de la app) para correr los tests sobre PGlite sin
 * Neon, igual que `lib/queries/cohortes.ts`.
 */

/** Lo que lleva pagada una venta contra el precio del contrato. */
export interface SaldoDeVenta {
  saleId: string;
  /** Programa de la venta. El abono lo hereda de aca, nunca del llamador. */
  programId: string;
  /** Moneda de la venta. Nunca se convierte: el abono tiene que venir en esta. */
  moneda: string;
  /**
   * Precio del contrato (`sales.precioAplicadoUsd`). `null` en las filas viejas de
   * Sheets, que no lo traen: ahi no hay contra que comparar.
   */
  precioContrato: string | null;
  /** Suma de los abonos de la venta. "0" si no tiene ninguno. */
  abonado: string;
  /** Precio del contrato menos lo abonado. `null` si la venta no tiene precio. */
  saldo: string | null;
  /** La venta esta pagada completa cuando sus abonos alcanzan el precio (ADR 0013). */
  pagadaCompleta: boolean;
}

/**
 * El saldo de una venta, o `null` si la venta no existe.
 *
 * La resta se hace en SQL sobre `numeric` y sale como texto: Postgres es exacto con
 * decimales y JavaScript no, asi que el dinero nunca pasa por un `float`. Por la
 * misma razon el resultado se devuelve como string, igual que lo devuelve Drizzle
 * para una columna `numeric`.
 */
export async function saldoDeVenta(
  saleId: string,
  db: Db = dbDeLaApp,
): Promise<SaldoDeVenta | null> {
  const [fila] = await db
    .select({
      programId: sales.programId,
      moneda: sales.moneda,
      precioContrato: sales.precioAplicadoUsd,
      abonado: sql<string>`coalesce(sum(${abonos.monto}), 0)::text`,
      saldo: sql<
        string | null
      >`(${sales.precioAplicadoUsd} - coalesce(sum(${abonos.monto}), 0))::text`,
    })
    .from(sales)
    .leftJoin(abonos, eq(abonos.saleId, sales.id))
    .where(eq(sales.id, saleId))
    .groupBy(sales.id)
    .limit(1);

  if (!fila) return null;

  return {
    saleId,
    programId: fila.programId,
    moneda: fila.moneda,
    precioContrato: fila.precioContrato,
    abonado: fila.abonado,
    saldo: fila.saldo,
    // Sin precio del contrato no se puede afirmar que este pagada completa.
    pagadaCompleta: fila.saldo !== null && Number(fila.saldo) <= 0,
  };
}
