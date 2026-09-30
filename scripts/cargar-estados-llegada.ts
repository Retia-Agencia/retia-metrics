import "./load-env";
import { db } from "../lib/db";
import { listarProgramas } from "../lib/catalogo/programas";
import { estadosDeLlegada } from "../lib/catalogo/estados-llegada";
import { llaveDeEstado } from "../lib/ingesta/estados-llegada";
import { actorDelScript } from "./actor";
import { ESTADOS_LLEGADA_BASE } from "./estados-llegada-base";

/**
 * Siembra los Estados de llegada de cada programa (ticket 117, ADR 0061) por la función del
 * catálogo, con su `change_log` (ADR 0029). Idempotente: un valor que el programa ya tiene
 * no se toca (ni se pisa lo que un gerente haya editado). Sin `--aplicar` solo muestra.
 *
 *   npm run cargar-estados-llegada            # ensayo
 *   npm run cargar-estados-llegada -- --aplicar
 *
 * Los valores viven en `estados-llegada-base.ts` (los comparte `seed-local`).
 */

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const actor = await actorDelScript(db);
  const cat = estadosDeLlegada(db);
  const existentes = new Set(
    (await cat.listar()).map((f) => `${String(f.programId)}\u0000${llaveDeEstado(String(f.valor))}`),
  );

  for (const programa of await listarProgramas(db)) {
    console.log(`${programa.nombre}:`);
    for (const d of ESTADOS_LLEGADA_BASE) {
      const llave = `${programa.id}\u0000${llaveDeEstado(d.valor)}`;
      if (existentes.has(llave)) {
        console.log(`  = ${d.valor}`);
        continue;
      }
      if (aplicar) await cat.crear(actor, { programId: programa.id, ...d });
      existentes.add(llave);
      console.log(`  ${aplicar ? "+" : "(ensayo) +"} ${d.valor} → ${d.etapaEntrada ?? "sin deal"}, ${d.prioridad}`);
    }
  }
  if (!aplicar) console.log("\nEnsayo: no se escribió nada. Corre con --aplicar para sembrar.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
