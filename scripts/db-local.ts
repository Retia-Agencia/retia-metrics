import { execSync } from "node:child_process";
import postgres from "postgres";

/**
 * Script para levantar y preparar la base de datos local (Postgres 17 en Docker).
 *
 * Pasos:
 *  1. Valida estrictamente que la URL sea localhost / 127.0.0.1 (guardia contra producción).
 *  2. Levanta el contenedor con `docker compose up -d`.
 *  3. Espera a que Postgres acepte conexiones.
 *  4. Ejecuta todas las migraciones de `drizzle/` con `drizzle-kit migrate`.
 *  5. Ejecuta el seed local (`scripts/seed-local.ts`).
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

async function esperarPostgres(url: string, timeoutMs = 30000): Promise<void> {
  const inicio = Date.now();
  console.log(`[db:local] Esperando conexión a Postgres en ${url}...`);

  while (Date.now() - inicio < timeoutMs) {
    let sql: ReturnType<typeof postgres> | null = null;
    try {
      sql = postgres(url, { max: 1, connect_timeout: 1 });
      await sql`SELECT 1`;
      await sql.end({ timeout: 1 });
      console.log("[db:local] Postgres local listo para recibir conexiones.");
      return;
    } catch {
      if (sql) {
        try {
          await sql.end({ timeout: 0.1 });
        } catch {
          // Ignorar error al cerrar socket en fallo
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error(
    `[db:local] Timeout de ${timeoutMs / 1000}s esperando que Postgres local acepte conexiones en ${url}.`,
  );
}

async function main() {
  console.log("============================================================");
  console.log("  RETIA METRICS - INICIALIZACIÓN DE BASE DE DATOS LOCAL");
  console.log("============================================================");

  // 1. Guardia de seguridad
  validarUrlLocal(LOCAL_DB_URL);
  process.env.DATABASE_URL = LOCAL_DB_URL;
  process.env.DATABASE_URL_DIRECTA = LOCAL_DB_URL;

  // 2. Levantar contenedor
  console.log("\n[1/4] Levantando contenedor Postgres...");
  try {
    try {
      execSync("docker compose up -d", { stdio: "inherit" });
    } catch {
      execSync("docker-compose up -d", { stdio: "inherit" });
    }
  } catch (error) {
    console.error(
      "\n[ERROR] Falló 'docker compose up -d'. Verifica que Docker esté instalado y en ejecución.",
    );
    throw error;
  }

  // 3. Esperar a que acepte conexiones
  console.log("\n[2/4] Verificando salud del servidor Postgres...");
  await esperarPostgres(LOCAL_DB_URL);

  // 4. Migraciones
  console.log("\n[3/4] Aplicando migraciones de Drizzle contra la base local...");
  execSync("npx drizzle-kit migrate", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: LOCAL_DB_URL,
      DATABASE_URL_DIRECTA: LOCAL_DB_URL,
    },
  });

  // 5. Semilla local
  console.log("\n[4/4] Ejecutando siembra de datos de prueba...");
  execSync("npx tsx scripts/seed-local.ts", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: LOCAL_DB_URL,
      DATABASE_URL_DIRECTA: LOCAL_DB_URL,
    },
  });

  console.log("\n============================================================");
  console.log("  Base local lista con esquema y datos de ejemplo.");
  console.log("  Para iniciar la app: npm run dev:local");
  console.log("============================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n[db:local] Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
