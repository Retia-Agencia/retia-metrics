import "./load-env";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { programs } from "../lib/db/schema";
import { sincronizarPersonas } from "../lib/sheets/sync";

/** Uso: tsx scripts/sincronizar.ts [slug-del-programa] */
async function main() {
  const slug = process.argv[2];
  const lista = slug
    ? await db.select().from(programs).where(eq(programs.slug, slug))
    : await db.select().from(programs);

  for (const p of lista) {
    console.log(`\n${"═".repeat(66)}\n  ${p.nombre}\n${"═".repeat(66)}`);
    const t0 = Date.now();
    const r = await sincronizarPersonas(p.id);
    console.log(`  fuentes leidas    : ${r.fuentesLeidas.join(" + ")}`);
    console.log(`  filas leidas      : ${r.filasLeidas}`);
    console.log(`  filas sin correo  : ${r.sinCorreo}`);
    console.log(`  personas unicas   : ${r.personasEnHoja}`);
    const dup = r.filasLeidas ? (1 - r.personasEnHoja / r.filasLeidas) * 100 : 0;
    console.log(`  tasa duplicados   : ${dup.toFixed(1)}%`);
    console.log(`  ─`);
    console.log(`  nuevas en la base : ${r.nuevas}`);
    console.log(`  actualizadas      : ${r.actualizadas}`);
    console.log(`  cambios en log    : ${r.cambiosRegistrados}`);
    console.log(`  tiempo            : ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (r.errores.length) console.log(`  ERRORES: ${r.errores.join(" | ")}`);
  }
  console.log("");
}

main().then(() => process.exit(0)).catch((e) => { console.error("\nFallo:", e?.message ?? e); process.exit(1); });
