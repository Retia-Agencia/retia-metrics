import "./load-env";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../lib/db";
import { abonos, cohorts, dealLineas, deals, leads, programs, skus } from "../lib/db/schema";
import { incluyendoAnulados } from "../lib/queries/vigente";

async function main(): Promise<void> {
  const filas = await db
    .select({
      programa: programs.slug,
      dealId: deals.id,
      nombre: leads.nombre,
      correo: leads.emailNormalizado,
      cohorte: cohorts.codigo,
      fecha: abonos.fecha,
      moneda: abonos.moneda,
      monto: abonos.monto,
      nota: abonos.nota,
    })
    .from(abonos)
    .innerJoin(dealLineas, eq(dealLineas.id, abonos.lineaId))
    .innerJoin(skus, eq(skus.id, dealLineas.skuId))
    .innerJoin(deals, eq(deals.id, abonos.dealId))
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .innerJoin(programs, eq(programs.id, abonos.programId))
    .innerJoin(cohorts, eq(cohorts.id, skus.cohortId))
    .where(and(inArray(skus.slug, ["sin_clasificar", "1_1_con_rosario"]), incluyendoAnulados(abonos), incluyendoAnulados(deals)))
    .orderBy(asc(programs.slug), asc(abonos.fecha), asc(deals.id), asc(abonos.id));

  console.log("programa\tdeal_id\tnombre\tcorreo\tcohorte\tfecha\tmoneda\tmonto\tnota");
  for (const fila of filas) {
    console.log(
      [
        fila.programa,
        fila.dealId,
        fila.nombre ?? "",
        fila.correo,
        fila.cohorte,
        fila.fecha,
        fila.moneda,
        fila.monto,
        fila.nota ?? "",
      ]
        .map((valor) => String(valor).replaceAll("\t", " ").replaceAll("\n", " "))
        .join("\t"),
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("No se pudo generar el reporte de adicionales:", error);
    process.exit(1);
  });
