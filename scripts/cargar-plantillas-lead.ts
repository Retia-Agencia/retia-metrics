import "./load-env";
import { db } from "../lib/db";
import { editarPlantillaLead, listarProgramas } from "../lib/catalogo/programas";
import { actorDelScript } from "./actor";
import { PLANTILLA_LEAD_BASE } from "./estados-llegada-base";

/**
 * Carga la plantilla de lead de cada programa que NO tiene una (ticket 117, B4 del 114),
 * por `editarPlantillaLead` (con su `change_log`, ADR 0029). Es lo que el adaptador de
 * Typeform tenía escrito como defecto en el código: qué pregunta trae el nombre, el correo
 * y el WhatsApp. Desde el 117 el webhook no tiene defecto, así que esto va a producción
 * ANTES de desplegar el código que lo quita, o cada envío falla con `MapeoInvalidoError`
 * (queda guardado en `sobres_crudos` y se reprocesa, pero no entra).
 *
 * Un programa con plantilla no se toca: la plantilla es de quien administra. Sin
 * `--aplicar` solo muestra.
 *
 *   npm run cargar-plantillas-lead            # ensayo
 *   npm run cargar-plantillas-lead -- --aplicar
 *
 * La plantilla vive en `estados-llegada-base.ts` (la comparte `seed-local`).
 */

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const actor = await actorDelScript(db);
  for (const programa of await listarProgramas(db)) {
    if (programa.plantillaLead) {
      console.log(`  = ${programa.nombre}: ya tiene plantilla, no se toca`);
      continue;
    }
    if (aplicar) await editarPlantillaLead(db, actor, programa.id, PLANTILLA_LEAD_BASE);
    console.log(`  ${aplicar ? "+" : "(ensayo) +"} ${programa.nombre}: ${JSON.stringify(PLANTILLA_LEAD_BASE)}`);
  }
  if (!aplicar) console.log("\nEnsayo: no se escribió nada. Corre con --aplicar para cargar.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
