import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
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
  const cliente = postgres(url, { prepare: false });
  const base = drizzle(cliente, { schema, logger: { logQuery } }) as Db;
  return {
    base,
    sql: <T>(texto: string, parametros: unknown[] = []) =>
      cliente.unsafe<T[]>(texto, parametros as Parameters<typeof cliente.unsafe>[1]),
    cerrar: () => cliente.end(),
  };
}
