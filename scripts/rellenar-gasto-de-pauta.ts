import "./load-env";
import { db } from "../lib/db";
import { tokensMeta } from "../lib/integraciones";
import { sincronizarPautaEnVentana } from "../lib/pauta/sincronizar";
import { hoyEnBogota } from "../lib/format";
import { leerTrm } from "../lib/trm/registrar";
import { fechaBogotaSchema } from "../lib/trm/fecha";

/**
 * Relleno del gasto de Meta de una ventana que el cron nunca leyó (ticket 351, auditoría C-01): `gasto_pauta`
 * y `tasas_cambio` empiezan el 2026-10-08 y el cron solo reescribe 7 días, así que el hueco no se cierra solo.
 * La escritura es la del cron (`sincronizarPautaEnVentana`, único escritor) y después `leerTrm`, que baja
 * hasta el primer gasto guardado.
 *
 *   npx tsx scripts/rellenar-gasto-de-pauta.ts --desde 2026-10-01 --hasta 2026-10-07 [--aplicar]
 *
 * ENSAYO por defecto: dice contra qué base y qué ventana, y no llama a Meta ni escribe. `--aplicar` escribe
 * en producción: pide el ok de Mani (DA-8). Idempotente: reescribir la misma ventana deja las mismas filas.
 */
function argumento(nombre: string): string {
  const i = process.argv.indexOf(nombre);
  return fechaBogotaSchema.parse(i >= 0 ? process.argv[i + 1] : undefined);
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const desde = argumento("--desde");
  const hasta = argumento("--hasta");
  if (desde > hasta) throw new Error("--desde va antes de --hasta.");
  const ref = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+)[:@]/)?.[1] ?? "local o sin ref";
  console.log(`Base: ${ref} · ventana ${desde} a ${hasta} · ${aplicar ? "APLICANDO" : "ensayo (no escribe)"}`);
  if (!aplicar) return;

  const resumen = await sincronizarPautaEnVentana(db, {
    tokens: await tokensMeta(db), desde, hasta, disparadaPor: "manual", refrescarArbol: false,
  });
  console.log(`Gasto: ${resumen.estado} · ${resumen.filas} filas · ${resumen.omitidas} omitidas`);
  if (resumen.estado === "error") throw new Error(resumen.error);
  const trm = await leerTrm(db, { hoy: hoyEnBogota() });
  console.log(`TRM: ${trm.leidas} publicaciones leídas (${trm.desde} a ${trm.hasta})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
