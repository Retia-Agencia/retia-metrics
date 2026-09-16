import type { Db } from "./tipos";

/**
 * Ejecuta varias escrituras como una sola unidad atomica.
 *
 * La base de produccion usa `drizzle-orm/neon-http`, que NO soporta transacciones
 * interactivas (cada consulta es una peticion HTTP aparte; ver AGENTS.md) pero SI
 * `db.batch([...])`, que las manda en una sola transaccion del lado del servidor.
 * PGlite (los tests) es al reves: no tiene `batch`, pero soporta `db.transaction`.
 *
 * Este helper detecta cual tiene delante y usa el mecanismo que corresponde. Por
 * eso el alta de una fila y su registro en `change_log` deben construirse ANTES de
 * llamar aca (con el id generado en codigo con `crypto.randomUUID()`), no depender
 * de leer el id recien insertado: `batch` no deja encadenar resultados.
 */
export async function ejecutarJuntas(
  db: Db,
  consultas: (tx: Db) => readonly Promise<unknown>[],
): Promise<void> {
  // neon-http: una sola transaccion via batch.
  if (tieneBatch(db)) {
    const lote = consultas(db);
    // batch exige una tupla no vacia; si no hay nada que hacer, no llamamos.
    if (lote.length === 0) return;
    await db.batch(lote as unknown as readonly [Promise<unknown>, ...Promise<unknown>[]]);
    return;
  }

  // pglite: transaccion interactiva real.
  await db.transaction(async (tx) => {
    await Promise.all(consultas(tx as unknown as Db));
  });
}

/** neon-http expone `batch`; pglite no. Es la unica forma de distinguirlos en runtime. */
function tieneBatch(
  db: Db,
): db is Db & { batch(consultas: readonly [Promise<unknown>, ...Promise<unknown>[]]): Promise<unknown> } {
  return typeof (db as { batch?: unknown }).batch === "function";
}
