import { and, eq, sql } from "drizzle-orm";
import { enlacesPago, plataformasPago, productos, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cohortesVendiendo } from "@/lib/cohortes/vendiendo";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import { MONEDAS } from "@/lib/monedas";
import { montoPagado, type EventoHotmart } from "./hotmart";

export const codigoOff = (url: string): string | null => { try { return new URL(url).searchParams.get("off"); } catch { return null; } };
export function resolverCohorte(cohortes: { id: string }[]) {
  if (cohortes.length === 0) return { cohortId: null, motivoRevision: "sin_cohorte" as const };
  if (cohortes.length > 1) return { cohortId: null, motivoRevision: "cohorte_ambigua" as const };
  return { cohortId: cohortes[0].id, motivoRevision: null };
}
export async function traducirCompra(db: Db, programId: string, compra: EventoHotmart["data"]["purchase"]) {
  const codigoOferta = compra.offer?.code ?? null;
  const base = { codigoOferta, enlacePagoId: null as string | null, cohortId: null as string | null, ...montoPagado(compra) };
  if (!codigoOferta) return { ...base, estado: "en_revision" as const, motivoRevision: "sin_oferta" };
  const links = await db.select({ id: enlacesPago.id, url: enlacesPago.url }).from(enlacesPago)
    .innerJoin(plataformasPago, eq(plataformasPago.id, enlacesPago.plataformaId))
    .where(and(eq(enlacesPago.programId, programId), eq(enlacesPago.activo, true), eq(enlacesPago.vigente, true), sql`lower(${plataformasPago.nombre}) = 'hotmart'`));
  const link = links.find((fila) => codigoOff(fila.url) === codigoOferta);
  if (!link) return { ...base, estado: "en_revision" as const, motivoRevision: "oferta_desconocida" };
  const conLink = { ...base, enlacePagoId: link.id };
  if (!(MONEDAS as readonly string[]).includes(base.moneda)) return { ...conLink, estado: "en_revision" as const, motivoRevision: "moneda_no_soportada" };
  const cohortes = await cohortesVendiendo(db, programId, fechaDeInstanteEnBogota(new Date(compra.approved_date)));
  const cohorte = resolverCohorte(cohortes);
  if (cohorte.motivoRevision) return { ...conLink, estado: "en_revision" as const, ...cohorte };
  const skusConCupo = await db.select({ id: skus.id }).from(skus)
    .innerJoin(productos, and(eq(productos.id, skus.productoId), eq(productos.programId, skus.programId)))
    .where(and(
      eq(skus.programId, programId), eq(skus.cohortId, cohorte.cohortId!), eq(skus.activo, true),
      eq(productos.activo, true), eq(productos.cuentaComoCupo, true),
    ));
  const skuResuelto = resolverCohorte(skusConCupo);
  if (skuResuelto.motivoRevision) {
    return { ...conLink, cohortId: null, estado: "en_revision" as const, motivoRevision: skuResuelto.motivoRevision };
  }
  return { ...conLink, estado: "sin_emparejar" as const, ...cohorte };
}
