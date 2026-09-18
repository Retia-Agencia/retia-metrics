import { sql } from "drizzle-orm";
import { abonos, sales } from "@/lib/db/schema";

/**
 * La UNICA definicion de cuanto lleva pagada una venta y cuanto le falta
 * (ADR 0013, ADR 0024).
 *
 * Existia escrita dos veces —en `saldoDeVenta` y en `ventasDePersona`— con el mismo
 * SQL copiado. No es un problema estetico: `saldoDeVenta` alimenta la reja que
 * bloquea un sobrepago al registrar un abono, y `ventasDePersona` alimenta lo que el
 * closer ve en pantalla. Si una de las dos cambia (excluir un abono devuelto, tratar
 * otra moneda, redondear distinto) la pantalla muestra un saldo y la reja aplica
 * otro, y la diferencia aparece cuando el dinero ya no cuadra.
 *
 * Toda consulta que necesite "lo abonado" o "el saldo" usa estas expresiones. Si
 * mañana la regla cambia, se cambia aca y cambia en todas partes a la vez.
 *
 * Las dos exigen `groupBy(sales.id)` y un `leftJoin` a `abonos`: son agregados sobre
 * los abonos de la venta.
 */

/**
 * Lo abonado: la suma de los abonos de la venta, `"0"` si no tiene ninguno.
 *
 * Sale como texto y no como numero porque Postgres es exacto con `numeric` y
 * JavaScript no: el dinero nunca pasa por un `float` (restriccion dura de AGENTS.md).
 */
export const ABONADO = sql<string>`coalesce(sum(${abonos.monto}), 0)::text`;

/**
 * El saldo pendiente: el precio del contrato menos lo abonado.
 *
 * Es `null` cuando la venta no tiene precio del contrato (filas viejas de Sheets):
 * sin precio no hay contra que restar, y un `0` ahi afirmaria que esta pagada.
 */
export const SALDO = sql<
  string | null
>`(${sales.precioAplicadoUsd} - coalesce(sum(${abonos.monto}), 0))::text`;

/**
 * Una venta esta pagada completa cuando sus abonos alcanzaron el precio (ADR 0013).
 *
 * Sin precio del contrato (`saldo === null`) no se puede AFIRMAR que lo este, asi
 * que devuelve `false`: es la respuesta honesta, no un "todavia no".
 */
export function estaPagadaCompleta(saldo: string | null): boolean {
  return saldo !== null && Number(saldo) <= 0;
}
