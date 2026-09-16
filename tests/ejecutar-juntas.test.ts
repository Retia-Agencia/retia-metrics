import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";

/**
 * Cubre la rama de produccion de `ejecutarJuntas`: la base real es
 * `drizzle-orm/neon-http`, que atomiza con `db.batch([...])`, no con transacciones
 * interactivas (ver AGENTS.md). Los tests con PGlite ejercen la OTRA rama
 * (`transaction`), asi que esta quedaba sin cubrir.
 *
 * No usa base real (ni Neon ni PGlite): solo un objeto falso minimo que simula la
 * superficie que `ejecutarJuntas` toca (`batch` y `transaction`). Asi el test es
 * hermetico y prueba SOLO la logica de decision del helper.
 */

/** Un `Db` de mentira con `batch` y `transaction` espiables. */
function baseFalsaConBatch() {
  // `batch` tipado para aceptar la tupla de consultas: asi `mock.calls[0][0]` es
  // legible sin destructurar una tupla vacia, y sin un parametro sin usar.
  const batch = vi.fn<(consultas: readonly Promise<unknown>[]) => Promise<unknown[]>>(
    () => Promise.resolve([]),
  );
  const transaction = vi.fn(async () => {});
  // Cast seguro para el test: NO es una base real, es un fake minimo que solo
  // expone los dos metodos que `ejecutarJuntas` consulta. El helper nunca toca
  // nada mas del `Db`, asi que darle la forma completa seria ruido.
  const db = { batch, transaction } as unknown as Db;
  return { db, batch, transaction };
}

describe("ejecutarJuntas — rama batch (neon-http)", () => {
  it("con batch disponible, llama batch UNA vez con todas las consultas en orden y no usa transaction", async () => {
    const { db, batch, transaction } = baseFalsaConBatch();

    // Consultas marcadas para poder verificar orden e identidad sin base real.
    const q0 = Promise.resolve("q0");
    const q1 = Promise.resolve("q1");
    const q2 = Promise.resolve("q2");

    await ejecutarJuntas(db, () => [q0, q1, q2]);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();

    // El unico argumento es la tupla con las tres consultas, en orden.
    const loteRecibido = batch.mock.calls[0][0];
    expect(loteRecibido).toEqual([q0, q1, q2]);
  });

  it("con una lista vacia de consultas no llama batch ni transaction", async () => {
    const { db, batch, transaction } = baseFalsaConBatch();

    await ejecutarJuntas(db, () => []);

    expect(batch).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
});
