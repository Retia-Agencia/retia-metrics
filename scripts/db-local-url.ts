/**
 * La URL de la base local y su guardia (ticket 113). Vive aparte y sin efectos al
 * importarse: `db-local.ts` corre su `main()` al cargarse, y si `dev-local.ts` o
 * `seed-local.ts` lo importaran, arrancarian docker, migraciones y seed (el seed, en
 * bucle, porque `db-local` lo lanza).
 */

import { razonNoLocal } from "../lib/db/es-local";

export const LOCAL_DB_URL =
  process.env.LOCAL_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/retia_local";

/**
 * Aborta si la URL no es local. El predicado vive en `lib/db/es-local.ts` (una sola
 * respuesta, AGENTS.md); aqui solo se le pone el prefijo `[db:local] SEGURIDAD:` y se
 * lanza, que es lo que un script necesita y el proveedor de login no.
 */
export function validarUrlLocal(urlStr: string): void {
  const razon = razonNoLocal(urlStr);
  if (razon) throw new Error(`[db:local] SEGURIDAD: ${razon} Abortando.`);
}
