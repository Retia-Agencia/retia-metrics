import { spawn } from "node:child_process";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local";

/**
 * Arranca Next.js en modo desarrollo apuntando EXCLUSIVAMENTE a la base local de Docker.
 *
 * Sobreescribe `DATABASE_URL` y `DATABASE_URL_DIRECTA` en `process.env` para el subproceso,
 * garantizando que ninguna lectura ni escritura toque producción ni `.env.local`.
 */

async function main() {
  validarUrlLocal(LOCAL_DB_URL);

  console.log("============================================================");
  console.log("  RETIA METRICS - SERVIDOR DEV LOCAL");
  console.log(`  DATABASE_URL: ${LOCAL_DB_URL}`);
  console.log("  PRODUCCIÓN: PROTEGIDA (.env.local sobreescrito para este proceso)");
  console.log("============================================================\n");

  const child = spawn("npx", ["next", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: LOCAL_DB_URL,
      DATABASE_URL_DIRECTA: LOCAL_DB_URL,
    },
  });

  const salir = (senal: NodeJS.Signals) => {
    child.kill(senal);
  };

  process.on("SIGINT", () => salir("SIGINT"));
  process.on("SIGTERM", () => salir("SIGTERM"));

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("[dev:local] Error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
