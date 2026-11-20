import "./load-env";
import { eq, sql } from "drizzle-orm";
import { estadoDeCohorteSql } from "../lib/cohortes/estado";
import { db } from "../lib/db";
import { cohorts, programs } from "../lib/db/schema";
import { hoyEnBogota } from "../lib/format";

async function main(): Promise<void> {
  const hoy = hoyEnBogota();
  const filas = await db
    .select({
      programa: programs.slug,
      marcada: sql<string | null>`max(${cohorts.codigo}) filter (where ${sql.raw('"cohorts"."estado"')} = 'activo')`,
      deducida: sql<string | null>`max(${cohorts.codigo}) filter (where ${estadoDeCohorteSql(hoy)} = 'activo')`,
    })
    .from(programs)
    .leftJoin(cohorts, eq(cohorts.programId, programs.id))
    .groupBy(programs.id, programs.slug)
    .orderBy(programs.slug);

  console.log(`hoy_bogota\tprograma\tmarcada_activo\tdeducida_activo\tdifieren`);
  for (const fila of filas) {
    console.log([
      hoy,
      fila.programa,
      fila.marcada ?? "",
      fila.deducida ?? "",
      fila.marcada === fila.deducida ? "no" : "si",
    ].join("\t"));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("No se pudo comparar el estado de las cohortes:", error);
    process.exit(1);
  });
