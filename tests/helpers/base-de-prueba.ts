import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { inject } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { volcarBaseMigrada } from "./volcar-base-migrada";

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

export interface BaseDePrueba {
  /** Cliente drizzle sobre PGlite, tipado con el mismo `Db` que la app. */
  db: Db;
  /** Cierra el PGlite y libera la memoria. Llamar en `afterEach`/`afterAll`. */
  cerrar: () => Promise<void>;
}

/**
 * La base recien migrada se vuelca UNA vez por corrida de vitest y cada archivo
 * carga esos bytes desde disco. Este cache sigue viviendo lo que vive el archivo,
 * pero ya no repite `new PGlite()` (~700 ms) ni las migraciones (~150 ms).
 *
 * Si el volcado global no esta disponible, conserva el fallback anterior: migra y
 * vuelca una vez para ese archivo. Una migracion invalida sigue reventando con su
 * error original; la garantia de arriba no se pierde.
 */
let plantilla: Promise<File | Blob> | undefined;

async function cargarPlantilla(): Promise<File | Blob> {
  const ruta = inject("rutaVolcadoMigrado");
  if (typeof ruta === "string" && existsSync(ruta)) {
    return new Blob([await readFile(ruta)]);
  }
  return volcarBaseMigrada();
}

/**
 * Crea una base PGlite en memoria con todas las migraciones aplicadas y devuelve el
 * cliente drizzle. Cada llamada es una base independiente: arranca de una copia del
 * volcado, y lo que escriba un test no llega a la plantilla ni a otra base.
 */
export async function crearBaseDePrueba(): Promise<BaseDePrueba> {
  plantilla ??= cargarPlantilla();
  const cliente = new PGlite({ loadDataDir: await plantilla });
  const db = drizzle(cliente, { schema });
  return {
    db: db as Db,
    cerrar: () => cliente.close(),
  };
}
