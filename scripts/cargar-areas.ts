import "./load-env";
import { db } from "../lib/db";
import { areas, type EntradaArea } from "../lib/catalogo/areas";
import { actorDelScript } from "./actor";

/**
 * Carga las areas decididas por Mani el 29-sep (PQ7). Gerencial no es un area de
 * origen y no se siembra. Todo pasa por el molde de catalogo (ADR 0029) y es
 * idempotente por `lower(nombre)`.
 */
const AREAS: readonly EntradaArea[] = [
  { nombre: "Paid" },
  { nombre: "Orgánico" },
  { nombre: "Referidos" },
];

async function main() {
  const actor = await actorDelScript(db);
  const cat = areas(db);
  const existentes = await cat.listar();
  const hay = new Set(existentes.map((f) => String(f.nombre).toLowerCase()));

  for (const area of AREAS) {
    if (hay.has(area.nombre.toLowerCase())) {
      console.log(`  = ${area.nombre}`);
      continue;
    }
    await cat.crear(actor, area);
    console.log(`  + ${area.nombre}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
