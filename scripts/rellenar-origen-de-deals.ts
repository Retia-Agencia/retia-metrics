import "./load-env";
import { db } from "../lib/db";
import { rellenarOrigenDeDeals } from "../lib/deals/rellenar-origen";
import { actorDelScript } from "./actor";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

/**
 * El relleno UNICO del envio de origen de los deals vivos que no lo tienen (ticket 115,
 * ADR 0060). La regla vive en `lib/deals/rellenar-origen.ts`; esto solo la invoca.
 *
 *   npx tsx scripts/rellenar-origen-de-deals.ts [--aplicar] [--local]
 *
 * ENSAYO por defecto: cuenta lo que haria y no escribe. `--aplicar` escribe de verdad (pide
 * el ok de Mani). `--local` apunta a la base de Docker (`npm run db:local`). Siempre exige
 * `SCRIPT_ACTOR_EMAIL` (ADR 0029): su correo queda en `change_log`.
 *
 * Solo imprime conteos, nunca datos personales. Idempotente: solo toca deals sin origen.
 */
async function main() {
  const aplicar = process.argv.includes("--aplicar");
  if (process.argv.includes("--local")) {
    validarUrlLocal(LOCAL_DB_URL);
    process.env.DATABASE_URL = LOCAL_DB_URL;
    process.env.DATABASE_URL_DIRECTA = LOCAL_DB_URL;
  }
  // El ref del proyecto, no la cadena: antes de escribir se mira CONTRA que base (AGENTS.md).
  const ref = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)@/)?.[1] ?? "local o sin ref";
  console.log(`Base: ${ref} · ${aplicar ? "APLICANDO" : "ensayo (no escribe)"}`);

  const actorId = await actorDelScript(db);
  const r = await rellenarOrigenDeDeals(db, { actorId, aplicar });
  console.log(`Deals vivos sin origen: ${r.sinOrigen}`);
  console.log(`  ${aplicar ? "rellenados" : "se rellenarian"}: ${r.rellenados}`);
  console.log(`  quedan en nulo, el lead no tiene envíos: ${r.sinEnvios}`);
  console.log(`  quedan en nulo, todos sus envíos son posteriores al deal: ${r.sinEnviosPrevios}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
