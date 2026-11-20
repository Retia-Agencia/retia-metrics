import "./load-env";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../lib/db";
import { abonos, dealLineas, deals } from "../lib/db/schema";
import type { Db } from "../lib/db/tipos";
import { estadoDePagoPorLineas, recalcularEtapaTrasAnularAbono } from "../lib/deals/lineas";
import { vigente } from "../lib/queries/vigente";

async function main(): Promise<void> {
  const aplicar = process.argv.includes("--aplicar");
  const filas = await db.selectDistinct({ deal: deals })
    .from(deals)
    .innerJoin(dealLineas, and(eq(dealLineas.dealId, deals.id), vigente(dealLineas)))
    .innerJoin(abonos, and(eq(abonos.lineaId, dealLineas.id), vigente(abonos)))
    .where(and(vigente(deals), eq(deals.cortesia, false), ne(deals.etapa, "cierre_perdido")));

  let cambios = 0;
  for (const { deal } of filas) {
    const estado = await estadoDePagoPorLineas(db, deal.id);
    if (!estado.destino || estado.destino === deal.etapa) continue;
    cambios += 1;
    console.log(`${deal.id}\t${deal.etapa}\t${estado.destino}`);
    if (aplicar) {
      await db.transaction(async (tx) => {
        const [actual] = await (tx as Db).select().from(deals)
          .where(and(eq(deals.id, deal.id), vigente(deals))).for("update");
        if (actual) await recalcularEtapaTrasAnularAbono(tx as Db, actual);
      });
    }
  }
  console.log(`${aplicar ? "Aplicados" : "Por aplicar"}: ${cambios}`);
  if (!aplicar) console.log("Ensayo: no se escribió nada. Usa --aplicar únicamente contra una base autorizada.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("No se pudieron recalcular las etapas:", error);
    process.exit(1);
  });
