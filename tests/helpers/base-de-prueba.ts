import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Base de datos en memoria para los tests, decision de infraestructura de Mani
 * (ticket 011): PGlite (Postgres compilado a WASM) corriendo en el proceso, sin
 * red ni Neon.
 *
 * Aplica TODAS las migraciones reales de `./drizzle` con el migrador de PGlite. Eso
 * ademas prueba, gratis, que 0000..0003 aplican en un Postgres de verdad y en
 * orden: si una migracion tiene SQL invalido, el helper revienta y todos los tests
 * de base fallan a la vez.
 *
 * Esta es la primera pieza de tests de base del repo; 012, 017, 018, 002 y 019 la
 * van a reusar. Por eso vive aca y no dentro de un test.
 *
 * No lleva `.test.ts` a proposito: vitest solo recoge los archivos que terminan en
 * `.test.ts` dentro de `tests/`, asi que este archivo es solo un helper, nunca una
 * suite vacia.
 */

/** Carpeta de migraciones, resuelta desde este archivo (no desde el cwd). */
const CARPETA_MIGRACIONES = fileURLToPath(new URL("../../drizzle", import.meta.url));

export interface BaseDePrueba {
  /** Cliente drizzle sobre PGlite, tipado con el mismo `Db` que la app. */
  db: Db;
  /** Cierra el PGlite y libera la memoria. Llamar en `afterEach`/`afterAll`. */
  cerrar: () => Promise<void>;
}

/**
 * Crea una base PGlite en memoria, le aplica todas las migraciones y devuelve el
 * cliente drizzle ya sembrado. Cada llamada es una base independiente.
 */
export async function crearBaseDePrueba(): Promise<BaseDePrueba> {
  const cliente = new PGlite();
  const db = drizzle(cliente, { schema });
  await migrate(db, { migrationsFolder: CARPETA_MIGRACIONES });
  return {
    db: db as Db,
    cerrar: () => cliente.close(),
  };
}
