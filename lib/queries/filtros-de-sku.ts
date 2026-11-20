import { and, asc, eq, inArray, isNull, min } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { dealLineas, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

export const FILTROS_DE_SKU = ["nombre_del_sku", "sku"] as const;
export type FiltroDeSku = (typeof FILTROS_DE_SKU)[number];

export const PARAMETROS_DE_FILTROS_DE_SKU = {
  nombre_del_sku: "sku_nombre",
  sku: "sku",
} as const satisfies Record<FiltroDeSku, "sku_nombre" | "sku">;

export const camposMcpDeFiltrosDeSku = {
  nombre_del_sku: z.string().trim().min(1).max(300).optional(),
  sku: z.string().uuid().optional(),
} as const satisfies Record<FiltroDeSku, z.ZodType>;

export interface FiltrosDeSku {
  nombreDeSku?: string | null;
  skuId?: string | null;
}

export interface FiltrosDeSkuMultiples {
  nombresDeSku?: readonly string[];
  skuIds?: readonly string[];
}

export const CAMPO_MULTIPLE_DE_FILTRO_DE_SKU = {
  nombre_del_sku: "nombresDeSku",
  sku: "skuIds",
} as const satisfies Record<FiltroDeSku, keyof FiltrosDeSkuMultiples>;

export interface OpcionesDeFiltrosDeSku {
  nombres: Array<{ slug: string; nombre: string }>;
  skus: Array<{ id: string; codigo: string; slug: string }>;
}

const nombreDeSku = z.string().trim().min(1).max(300);
const skuId = z.string().uuid();

/** Valida los dos parámetros de URL en el borde; repetidos o mal formados no filtran. */
export function filtrosDeSkuDeLaUrl(busqueda: Record<string, unknown>): FiltrosDeSku {
  const nombre = nombreDeSku.safeParse(busqueda.sku_nombre);
  const id = skuId.safeParse(busqueda.sku);
  return {
    nombreDeSku: nombre.success ? nombre.data : undefined,
    skuId: id.success ? id.data : undefined,
  };
}

/** Opciones reales del programa: un nombre representativo por slug y cada SKU por código. */
export async function opcionesDeFiltrosDeSku(db: Db, programId: string): Promise<OpcionesDeFiltrosDeSku> {
  const [nombres, filasDeSku] = await Promise.all([
    db.select({ slug: skus.slug, nombre: min(skus.nombre) }).from(skus)
      .where(eq(skus.programId, programId)).groupBy(skus.slug).orderBy(asc(skus.slug)),
    db.select({ id: skus.id, codigo: skus.codigo, slug: skus.slug }).from(skus)
      .where(eq(skus.programId, programId)).orderBy(asc(skus.codigo), asc(skus.id)),
  ]);
  return {
    nombres: nombres.map((fila) => ({ slug: fila.slug, nombre: fila.nombre ?? fila.slug })),
    skus: filasDeSku,
  };
}

/** Traduce el nombre público del MCP al campo de Alcance, exhaustivamente. */
export function campoDeAlcanceParaFiltroDeSku(filtro: FiltroDeSku): keyof FiltrosDeSku {
  switch (filtro) {
    case "nombre_del_sku": return "nombreDeSku";
    case "sku": return "skuId";
  }
}

/** Predicado SQL de hechos por deal; los dos filtros casan sobre la misma línea vigente. */
export function condicionDeSkuParaDeal(
  db: Db,
  programId: string,
  dealId: PgColumn,
  filtros: FiltrosDeSkuMultiples | undefined,
) {
  const nombres = filtros?.nombresDeSku?.filter(Boolean) ?? [];
  const ids = filtros?.skuIds?.filter(Boolean) ?? [];
  if (nombres.length === 0 && ids.length === 0) return undefined;
  const coincidentes = db.select({ dealId: dealLineas.dealId }).from(dealLineas)
    .innerJoin(skus, and(eq(skus.id, dealLineas.skuId), eq(skus.programId, dealLineas.programId)))
    .where(and(
      eq(dealLineas.programId, programId),
      isNull(dealLineas.anuladaEn),
      nombres.length ? inArray(skus.slug, nombres) : undefined,
      ids.length ? inArray(skus.id, ids) : undefined,
    ));
  return inArray(dealId, coincidentes);
}
