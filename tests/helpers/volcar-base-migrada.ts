import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

/** Carpeta de migraciones, resuelta desde este archivo (no desde el cwd). */
const CARPETA_MIGRACIONES = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function volcarBaseMigrada(): Promise<File | Blob> {
  const cliente = new PGlite();
  try {
    await migrate(drizzle(cliente), { migrationsFolder: CARPETA_MIGRACIONES });
    // Sin comprimir: con gzip el volcado tarda ~15x mas y cada carga ~100 ms mas.
    return await cliente.dumpDataDir("none");
  } finally {
    await cliente.close();
  }
}
