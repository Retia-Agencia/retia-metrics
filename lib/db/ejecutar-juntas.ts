import type { Db } from "./tipos";

/**
 * Ejecuta varias escrituras como una sola unidad atomica: todas o ninguna.
 *
 * Es una transaccion de verdad, igual en produccion (`postgres-js` sobre Supabase,
 * ADR 0047) y en los tests (PGlite). Antes, con `neon-http`, produccion usaba
 * `db.batch` y los tests `db.transaction`, y el camino de produccion no lo probaba
 * nadie; esa bifurcacion desaparecio con el cambio de driver.
 *
 * Las consultas corren EN ORDEN, una tras otra, dentro de la transaccion: hay
 * llamadores que dependen del orden (por ejemplo `versionar.ts`, que primero retira
 * la version vigente y despues inserta la nueva, porque un indice unico no deja
 * convivir a las dos).
 *
 * Los ids de las filas nuevas se siguen generando en codigo (`crypto.randomUUID()`)
 * antes de llamar aca, y eso ya no es una limitacion sino la forma mas simple:
 * la fila y su registro en `change_log` se arman juntos, sin leer nada de vuelta.
 * Quien necesite leer y decidir dentro de la misma transaccion (el motor de etapas,
 * un abono que valida el saldo) usa `db.transaction` directo.
 */
export async function ejecutarJuntas(
  db: Db,
  consultas: (tx: Db) => readonly PromiseLike<unknown>[],
): Promise<void> {
  // El cast une las dos firmas de `transaction` (postgres-js y PGlite), que son
  // equivalentes pero TypeScript no sabe llamar sobre la union.
  await (db as { transaction: (fn: (tx: Db) => Promise<void>) => Promise<void> }).transaction(
    async (tx) => {
      for (const consulta of consultas(tx)) await consulta;
    },
  );
}
