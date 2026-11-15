import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import type { Db } from "./tipos";

/**
 * Una conexion de vida corta para un script de medicion (ADR 0047 punto 8: el driver vive solo en `lib/db/`).
 * Devuelve la base tipada con un logger de consultas y una puerta para correr SQL crudo (por ejemplo `EXPLAIN`).
 */
export function abrirBaseDeScript(
  url: string,
  logQuery: (sql: string, parametros: unknown[]) => void,
) {
  const pool = new Pool({ connectionString: url, max: 2 });
  const base = drizzle(pool, { schema, logger: { logQuery } }) as Db;
  return {
    base,
    sql: async <T>(texto: string, parametros: unknown[] = []) =>
      (await pool.query<T & Record<string, unknown>>(texto, parametros)).rows as T[],
    cerrar: () => pool.end(),
  };
}
