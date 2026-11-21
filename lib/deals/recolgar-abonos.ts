import { and, asc, eq, inArray } from "drizzle-orm";
import { abonos, dealLineas, deals, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { asignarLinea, recalcularDealPorLineas } from "./lineas";

export interface MovimientoDeRecolgado {
  deal: string;
  abono: string;
  de: string;
  a: string | null;
  motivo: "sin_clasificar" | "linea_anulada" | "sin_destino" | "ambiguo";
  mover: boolean;
}

export interface OpcionesDeRecolgado {
  aplicar?: boolean;
  skuCodigo?: string;
  lineaVigenteMasAntigua?: boolean;
  actorId?: string;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/** Planea por defecto; solo escribe con `aplicar` y actor explícitos. */
export async function recolgarAbonos(db: Db, opciones: OpcionesDeRecolgado = {}): Promise<MovimientoDeRecolgado[]> {
  const origenes = await db.select({
    abonoId: abonos.id, dealId: abonos.dealId, lineaId: dealLineas.id,
    skuId: dealLineas.skuId, programId: dealLineas.programId,
    lineaAnulada: dealLineas.anuladaEn, productoSlug: skus.slug,
  }).from(abonos)
    .innerJoin(dealLineas, eq(dealLineas.id, abonos.lineaId))
    .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
    .where(and(vigente(abonos), incluyendoAnulados(dealLineas)))
    .orderBy(asc(dealLineas.dealId), asc(abonos.id));

  const candidatos = origenes.filter((fila) => fila.productoSlug === "sin_clasificar" || fila.lineaAnulada != null);
  if (candidatos.length === 0) return [];
  const dealIds = [...new Set(candidatos.map((fila) => fila.dealId))];
  const vigentes = await db.select({ linea: dealLineas })
    .from(dealLineas)
    .where(and(inArray(dealLineas.dealId, dealIds), vigente(dealLineas)))
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));
  const skuDestino = opciones.skuCodigo
    ? await db.select().from(skus).where(and(eq(skus.codigo, opciones.skuCodigo), eq(skus.activo, true)))
    : [];

  const plan: MovimientoDeRecolgado[] = candidatos.map((fila) => {
    if (fila.productoSlug === "sin_clasificar") {
      const sku = skuDestino.find((x) => x.programId === fila.programId);
      if (!sku) return { deal: fila.dealId, abono: fila.abonoId, de: fila.lineaId, a: null, motivo: "sin_destino", mover: false };
      const destino = vigentes.find((x) => x.linea.dealId === fila.dealId && x.linea.skuId === sku.id)?.linea;
      return { deal: fila.dealId, abono: fila.abonoId, de: fila.lineaId, a: destino?.id ?? null, motivo: "sin_clasificar", mover: true };
    }
    const destinos = vigentes.filter((x) => x.linea.dealId === fila.dealId && x.linea.skuId === fila.skuId).map((x) => x.linea);
    if (destinos.length === 0) return { deal: fila.dealId, abono: fila.abonoId, de: fila.lineaId, a: null, motivo: "sin_destino", mover: false };
    if (destinos.length > 1 && !opciones.lineaVigenteMasAntigua) {
      return { deal: fila.dealId, abono: fila.abonoId, de: fila.lineaId, a: null, motivo: "ambiguo", mover: false };
    }
    return { deal: fila.dealId, abono: fila.abonoId, de: fila.lineaId, a: destinos[0].id, motivo: "linea_anulada", mover: true };
  });

  if (!opciones.aplicar) return plan;
  if (!opciones.actorId) throw new Error("Aplicar el re-colgado exige actorId.");
  const actorId = opciones.actorId;
  await (db as unknown as Transaccion).transaction(async (tx) => {
    const tocados = new Set<string>();
    for (const movimiento of plan.filter((fila) => fila.mover)) {
      let destinoId = movimiento.a;
      if (!destinoId) {
        const origen = candidatos.find((fila) => fila.abonoId === movimiento.abono)!;
        const sku = skuDestino.find((fila) => fila.programId === origen.programId);
        const [deal] = await tx.select().from(deals).where(and(eq(deals.id, origen.dealId), incluyendoAnulados(deals)));
        if (!sku || !deal) continue;
        destinoId = (await asignarLinea(tx, {
          deal, skuId: sku.id, actorId, etiqueta: sku.codigo,
        })).id;
        movimiento.a = destinoId;
      }
      await editarConRastro(
        { db: tx, tabla: abonos, nombreTabla: "abonos", actorId, etiqueta: movimiento.abono, origen: "app" },
        movimiento.abono,
        { lineaId: destinoId },
      );
      tocados.add(movimiento.deal);
    }
    for (const dealId of tocados) {
      await recalcularDealPorLineas(tx, dealId, { actorId, etiqueta: dealId, origen: "app" });
    }
  });
  return plan;
}
