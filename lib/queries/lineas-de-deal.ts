import { and, asc, eq, ne } from "drizzle-orm";
import { cohorts, dealLineas, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { saldosDeLineas } from "./saldo";
import { incluyendoAnulados } from "./vigente";

export interface LineaDeDealVisible {
  id: string;
  skuId: string;
  skuNombre: string;
  skuCodigo: string;
  cohorte: string;
  precioListaUsd: number;
  valorVendidoUsd: number;
  recaudadoUsd: number;
  porCobrarUsd: number | null;
  abonosVigentes: number;
  estado: "propuesta" | "vendida" | "anulada";
}

/** Fuente compartida por la ficha web y ficha_de_deal del MCP. */
export async function lineasVisiblesDelDeal(db: Db, dealId: string): Promise<LineaDeDealVisible[]> {
  const filas = await db.select({ linea: dealLineas, sku: skus, cohorte: cohorts.codigo })
    .from(dealLineas)
    .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
    .innerJoin(cohorts, and(eq(cohorts.id, skus.cohortId), eq(cohorts.programId, skus.programId)))
    .where(and(eq(dealLineas.dealId, dealId), incluyendoAnulados(dealLineas)))
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));
  const saldos = await saldosDeLineas(db, [dealId]);
  return filas.map(({ linea, sku, cohorte }) => {
    const saldo = saldos.get(linea.id);
    return {
      id: linea.id,
      skuId: sku.id,
      skuNombre: sku.nombre,
      skuCodigo: sku.codigo,
      cohorte,
      precioListaUsd: Number(linea.precioListaUsd),
      valorVendidoUsd: Number(linea.valorVendidoUsd),
      recaudadoUsd: saldo?.abonado ?? 0,
      porCobrarUsd: saldo?.saldo ?? (linea.anuladaEn ? null : Number(linea.valorVendidoUsd)),
      abonosVigentes: saldo?.abonosVigentes ?? 0,
      estado: linea.anuladaEn ? "anulada" : saldo?.vendida ? "vendida" : "propuesta",
    };
  });
}

export async function skusActivosDelPrograma(db: Db, programId: string) {
  return db.select({ id: skus.id, nombre: skus.nombre, codigo: skus.codigo, precioListaUsd: skus.precioListaUsd })
    .from(skus)
    .where(and(eq(skus.programId, programId), eq(skus.activo, true), ne(skus.slug, "sin_clasificar")))
    .orderBy(asc(skus.nombre), asc(skus.codigo));
}
