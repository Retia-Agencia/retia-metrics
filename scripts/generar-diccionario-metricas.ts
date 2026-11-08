import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { insertarBloque, renderizarFichas } from "../lib/metricas/ficha";

/**
 * Escribe el bloque generado de `docs/metricas.md` §3.0 desde `lib/metricas/registro.ts` (ADR 0120).
 * `--verificar` no escribe: sale con 1 si el documento está desactualizado.
 */
const ruta = join(process.cwd(), "docs", "metricas.md");
const actual = readFileSync(ruta, "utf8");
const nuevo = insertarBloque(actual, renderizarFichas());

if (process.argv.includes("--verificar")) {
  if (nuevo !== actual) {
    console.error("docs/metricas.md §3.0 está desactualizado. Corre `npm run docs:metricas`.");
    process.exit(1);
  }
  console.log("docs/metricas.md §3.0 está al día.");
  process.exit(0);
}
writeFileSync(ruta, nuevo);
console.log(nuevo === actual ? "Sin cambios." : "docs/metricas.md §3.0 actualizado.");
process.exit(0);
