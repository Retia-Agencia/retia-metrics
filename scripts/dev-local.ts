import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

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
      // Auth.js exige un secreto incluso para el proveedor local. Si no existe uno
      // configurado, usa uno efimero: el proceso local no debe depender de secretos
      // de produccion ni escribirlos en el repositorio.
      AUTH_SECRET: process.env.AUTH_SECRET ?? randomBytes(32).toString("base64url"),
      // Habilita el proveedor de login local (ticket 069): sin el, nadie puede entrar a
      // la app local porque Google no autentica un correo `.local`. Solo tiene efecto si
      // ADEMAS la base es local (lo comprueba `esUrlLocal`); aqui ya lo es.
      AUTH_LOGIN_LOCAL: "1",
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
