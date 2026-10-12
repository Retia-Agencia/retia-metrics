import "./load-env";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { db } from "../lib/db";
import { cohorts, deals, programs } from "../lib/db/schema";
import type { Db } from "../lib/db/tipos";
import { cambiarCohorteDelDeal } from "../lib/deals/cambiar-cohorte";
import { incluyendoAnulados } from "../lib/queries/vigente";
import { actorDelScript } from "./actor";

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/**
 * Sanea los pendientes creados antes del ticket 231.
 *
 *   npx tsx scripts/mudar-proxima-cohorte.ts [--aplicar]
 *
 * El ensayo es el comportamiento por defecto y solo imprime conteos por programa.
 * Aplicar exige SCRIPT_ACTOR_EMAIL y deja cada cambio y limpieza en change_log.
 */
async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const conteos = await db
    .select({ programa: programs.slug, cantidad: count() })
    .from(deals)
    .innerJoin(programs, eq(programs.id, deals.programId))
    .where(and(
      eq(deals.pendiente, "proxima_cohorte"),
      isNotNull(deals.cohorteDestinoId),
      incluyendoAnulados(deals),
    ))
    .groupBy(programs.slug)
    .orderBy(programs.slug);

  console.log(aplicar ? "APLICANDO" : "ENSAYO (no escribe)");
  for (const fila of conteos) console.log(`${fila.programa}: ${fila.cantidad}`);
  const total = conteos.reduce((suma, fila) => suma + fila.cantidad, 0);
  console.log(`Total: ${total}`);
  if (!aplicar || total === 0) return;

  const actorId = await actorDelScript(db);
  const filas = await db
    .select({ deal: deals })
    .from(deals)
    .where(and(
      eq(deals.pendiente, "proxima_cohorte"),
      isNotNull(deals.cohorteDestinoId),
      incluyendoAnulados(deals),
    ));

  for (const { deal } of filas) {
    await (db as unknown as Transaccion).transaction(async (tx) => {
      const [actual] = await tx
        .select()
        .from(deals)
        .where(and(eq(deals.id, deal.id), incluyendoAnulados(deals)))
        .for("update", { of: deals });
      if (!actual || actual.pendiente !== "proxima_cohorte" || !actual.cohorteDestinoId) return;
      const [destino] = await tx.select().from(cohorts).where(eq(cohorts.id, actual.cohorteDestinoId));
      if (!destino || destino.programId !== actual.programId) {
        throw new Error(`El deal ${actual.id} tiene una cohorte destino inexistente o de otro programa.`);
      }
      await cambiarCohorteDelDeal(tx, {
        deal: actual,
        destino,
        actorId,
        etiqueta: actual.id,
        limpiarProximaCohorte: true,
        userIdDeNota: null,
        nota: (origen, codigoDestino) =>
          `Cohorte cambiada por Próxima cohorte: ${origen} → ${codigoDestino}. El deal ya cuenta en ${codigoDestino}.`,
      });
    });
  }
  console.log(`Mudados: ${filas.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
