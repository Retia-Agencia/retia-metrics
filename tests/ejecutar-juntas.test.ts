import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { motivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * `ejecutarJuntas` es una transaccion de verdad (ADR 0047). Con `neon-http` habia dos
 * caminos —`batch` en produccion, `transaction` en los tests— y este archivo probaba
 * el de produccion con una base falsa. Con `postgres-js` hay UNO solo, el mismo que
 * PGlite, asi que se prueba contra la base real de migraciones.
 */

let db: Db;
let cerrar: () => Promise<void>;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
});

afterEach(async () => {
  await cerrar();
});

describe("ejecutarJuntas", () => {
  // Las migraciones siembran motivos, asi que se compara contra lo que ya habia.
  const contar = async () => (await db.select().from(motivos)).length;

  it("todas o ninguna: si una escritura falla, las anteriores se deshacen", async () => {
    const antes = await contar();
    const intento = ejecutarJuntas(db, (tx) => [
      tx.insert(motivos).values({ nombre: "Prueba A" }),
      tx.insert(motivos).values({ nombre: "Prueba B" }),
      // Choca con `motivos_nombre_idx` (unico sobre lower(nombre)).
      tx.insert(motivos).values({ nombre: "prueba a" }),
    ]);

    await expect(intento).rejects.toThrow();
    expect(await contar()).toBe(antes);
  });

  it("corre las escrituras en orden: una puede depender de la anterior", async () => {
    const id = crypto.randomUUID();
    await ejecutarJuntas(db, (tx) => [
      tx.insert(motivos).values({ id, nombre: "Prueba orden" }),
      // Si corrieran en paralelo o al reves, este update no encontraria la fila.
      tx.update(motivos).set({ activo: false }).where(eq(motivos.id, id)),
    ]);

    const [fila] = await db.select().from(motivos).where(eq(motivos.id, id));
    expect(fila.activo).toBe(false);
  });

  it("una lista vacia no escribe nada ni falla", async () => {
    const antes = await contar();
    await ejecutarJuntas(db, () => []);
    expect(await contar()).toBe(antes);
  });
});
