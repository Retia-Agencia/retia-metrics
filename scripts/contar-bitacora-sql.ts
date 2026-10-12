import "./load-env";
import { count, ilike, or } from "drizzle-orm";
import { db } from "../lib/db";
import { changeLog } from "../lib/db/schema";

/** Diagnóstico de solo lectura para dimensionar las filas históricas afectadas por el bug. */
async function main() {
  const [fila] = await db
    .select({ total: count() })
    .from(changeLog)
    .where(or(ilike(changeLog.valorNuevo, "%queryChunks%"), ilike(changeLog.valorAnterior, "%queryChunks%")));
  console.log(`Filas de change_log con queryChunks: ${fila.total}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
