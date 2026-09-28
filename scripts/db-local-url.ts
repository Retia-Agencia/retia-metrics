/**
 * La URL de la base local y su guardia (ticket 113). Vive aparte y sin efectos al
 * importarse: `db-local.ts` corre su `main()` al cargarse, y si `dev-local.ts` o
 * `seed-local.ts` lo importaran, arrancarian docker, migraciones y seed (el seed, en
 * bucle, porque `db-local` lo lanza).
 */

export const LOCAL_DB_URL =
  process.env.LOCAL_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54329/retia_local";

export function validarUrlLocal(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`[db:local] URL de conexión inválida: "${urlStr}"`);
  }

  const host = parsed.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `[db:local] SEGURIDAD: La URL "${urlStr}" apunta a "${host}", que no es localhost ni 127.0.0.1. ` +
        `Operación abortada inmediatamente para proteger bases remotas y producción.`,
    );
  }

  if (
    urlStr.includes("supabase.com") ||
    urlStr.includes("pooler.supabase.com") ||
    urlStr.includes("hfqmiyiuyqapdsbywrag")
  ) {
    throw new Error(
      `[db:local] SEGURIDAD: La URL contiene referencias a Supabase/producción. Abortando.`,
    );
  }
}
