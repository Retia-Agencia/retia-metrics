import { execSync } from "node:child_process";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

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
      // `--wait` espera el healthcheck (pg_isready): sin importar el driver fuera de lib/db/ (ADR 0047).
      execSync("docker compose up -d --wait", { stdio: "inherit" });
    } catch {
      execSync("docker-compose up -d --wait", { stdio: "inherit" });
    }
  } catch (error) {
    console.error(
      "\n[ERROR] Falló 'docker compose up -d'. Verifica que Docker esté instalado y en ejecución.",
    );
    throw error;
  }


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
