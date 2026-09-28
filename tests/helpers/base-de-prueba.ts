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
 * La base recien migrada, volcada UNA vez por archivo de test (vitest aisla los
 * modulos por archivo, asi que este cache vive lo que vive el archivo). Medido el
 * 28-sep: `new PGlite()` corre initdb y cuesta ~700 ms, las migraciones ~150 ms, y
 * arrancar desde este volcado ~150 ms en total, porque se salta las dos cosas.
 *
 * Si una migracion trae SQL invalido la promesa queda rechazada y TODA llamada a
 * `crearBaseDePrueba` del archivo revienta con ese error: la garantia de arriba no
 * se pierde, solo se paga una vez por archivo.
 */
let plantilla: Promise<File | Blob> | undefined;

async function volcarBaseMigrada(): Promise<File | Blob> {
  const cliente = new PGlite();
  try {
    await migrate(drizzle(cliente), { migrationsFolder: CARPETA_MIGRACIONES });
    // Sin comprimir: con gzip el volcado tarda ~15x mas y cada carga ~100 ms mas.
    return await cliente.dumpDataDir("none");
  } finally {
    await cliente.close();
  }
}

/**
 * Crea una base PGlite en memoria con todas las migraciones aplicadas y devuelve el
 * cliente drizzle. Cada llamada es una base independiente: arranca de una copia del
 * volcado, y lo que escriba un test no llega a la plantilla ni a otra base.
 */
export async function crearBaseDePrueba(): Promise<BaseDePrueba> {
  plantilla ??= volcarBaseMigrada();
  const cliente = new PGlite({ loadDataDir: await plantilla });
  const db = drizzle(cliente, { schema });
  return {
    db: db as Db,
    cerrar: () => cliente.close(),
  };
}
