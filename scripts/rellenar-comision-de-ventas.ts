import "./load-env";
import { db } from "../lib/db";
import { rellenarComisionDeVentas } from "../lib/deals/rellenar-comision";
import { actorDelScript } from "./actor";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  if (process.argv.includes("--local")) {
    validarUrlLocal(LOCAL_DB_URL);
    process.env.DATABASE_URL = LOCAL_DB_URL;
    process.env.DATABASE_URL_DIRECTA = LOCAL_DB_URL;
  }
  const ref = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)[:@]/)?.[1] ?? "local o sin ref";
  console.log(`Base: ${ref} · ${aplicar ? "APLICANDO" : "ensayo (no escribe)"}`);

  const actorId = await actorDelScript(db);
  const resultado = await rellenarComisionDeVentas(db, { aplicar, actorId });
  for (const fila of resultado) {
    console.log(
      `${fila.programa} · ${fila.porcentaje === null ? "sin %" : `${fila.porcentaje} %`} · ` +
      `${fila.ventasSinPorcentaje} ventas sin porcentaje · ${fila.rellenables} rellenables`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
