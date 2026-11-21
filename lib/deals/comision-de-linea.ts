import { and, asc, eq, sql } from "drizzle-orm";
import { abonos, dealLineas, deals, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro, type OrigenOperativo } from "@/lib/crm/rastro";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { esLineaVendida } from "./lineas";

export interface ActorDeComisionDeLinea {
  actorId: string | null;
  etiqueta: string;
  origen?: OrigenOperativo;
  reversionId?: string;
}

/** Congela en cada línea vendida el porcentaje vigente de su SKU. */
export async function congelarComisionDeLineas(
  tx: Db,
  dealId: string,
  actor: ActorDeComisionDeLinea,
): Promise<void> {
  const [deal] = await tx.select({ etapa: deals.etapa, cortesia: deals.cortesia })
    .from(deals)
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal.", 404);

  const filas = await tx.select({
    lineaId: dealLineas.id,
    cuentaComoCupo: skus.cuentaComoCupo,
    porcentajeDelSku: skus.comisionPorcentaje,
    congelado: dealLineas.comisionPorcentaje,
    abonosVigentes: sql<number>`count(${abonos.id})::int`,
  }).from(dealLineas)
    .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
    .leftJoin(abonos, and(eq(abonos.lineaId, dealLineas.id), vigente(abonos)))
    .where(and(eq(dealLineas.dealId, dealId), vigente(dealLineas)))
    .groupBy(dealLineas.id, dealLineas.comisionPorcentaje, skus.cuentaComoCupo, skus.comisionPorcentaje)
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));

  const abonosVigentesDelDeal = filas.reduce((total, fila) => total + Number(fila.abonosVigentes), 0);
  for (const fila of filas) {
    if (fila.congelado !== null || fila.porcentajeDelSku === null || !esLineaVendida({
      etapa: deal.etapa,
      cortesia: deal.cortesia,
      cuentaComoCupo: fila.cuentaComoCupo,
      abonosVigentes: Number(fila.abonosVigentes),
      abonosVigentesDelDeal,
    })) continue;
    await editarConRastro(
      {
        db: tx, tabla: dealLineas, nombreTabla: "deal_lineas", actorId: actor.actorId,
        etiqueta: actor.etiqueta, origen: actor.origen ?? "app", reversionId: actor.reversionId,
      },
      fila.lineaId,
      { comisionPorcentaje: fila.porcentajeDelSku },
    );
  }
}
