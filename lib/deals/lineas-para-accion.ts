import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { dealLineas, deals, leads, skus } from "@/lib/db/schema";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { exigirDealVisible } from "./alcance";
import { huellaDeAccionAbonos } from "./estado-para-accion";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";

/**
 * Lo que las acciones de líneas del MCP (ticket 386) necesitan leer: la reja de la ficha, el estado de las líneas
 * antes y después, y la huella. Vive aquí y no en `lib/mcp/` porque el guardián del MCP prohíbe el SQL fuera de
 * token, sesión, bitácora y vistas previas.
 */

export const MENSAJE_SIN_PERMISO_DE_LINEAS = "Solo el dueño o quien administra puede editar los SKUs del deal.";

/**
 * Quién puede tocar las líneas de ESTE deal, con el mismo orden de rejas que `dealEditable` de la ficha
 * (`app/(app)/p/[programa]/deals/[id]/acciones.ts`): alcance, deal vigente, dueño o administrador.
 * La ficha y el MCP importan esta misma función.
 */
export async function dealEditableParaLineas(db: Db, actor: ActorDeDeal, dealId: string) {
  await exigirDealVisible(db, actor, dealId);
  const [deal] = await db.select().from(deals).where(and(eq(deals.id, dealId), vigente(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal vigente.", 404);
  if (!puedeTrabajarDeal(actor, deal)) throw new ErrorDeApp(MENSAJE_SIN_PERMISO_DE_LINEAS, 403);
  const [lead] = await db.select({ nombre: leads.nombre, email: leads.emailNormalizado }).from(leads).where(eq(leads.id, deal.leadId));
  return { deal, etiqueta: lead?.nombre ?? lead?.email ?? deal.id };
}

async function lineasDelDeal(db: Db, dealId: string, bloquear = false) {
  const consulta = db.select({
    id: dealLineas.id,
    sku: skus.codigo,
    skuId: dealLineas.skuId,
    valorVendidoUsd: dealLineas.valorVendidoUsd,
    anuladaEn: dealLineas.anuladaEn,
  }).from(dealLineas)
    .innerJoin(skus, eq(skus.id, dealLineas.skuId))
    .where(and(eq(dealLineas.dealId, dealId), incluyendoAnulados(dealLineas)))
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));
  return bloquear ? await consulta.for("update", { of: dealLineas }) : await consulta;
}

export async function estadoDeLineasParaAccion(db: Db, dealId: string) {
  const [deal] = await db.select({ etapa: deals.etapa, valorVendidoUsd: deals.valorVendidoUsd })
    .from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!deal) return null;
  const lineas = (await lineasDelDeal(db, dealId)).filter((linea) => linea.anuladaEn == null);
  return {
    etapa: deal.etapa,
    valor_vendido_usd: deal.valorVendidoUsd,
    lineas: lineas.map((linea) => ({ id: linea.id, sku: linea.sku, valor_vendido_usd: linea.valorVendidoUsd })),
  };
}

export async function huellaDeAccionLineas(db: Db, dealId: string, opciones?: { bloquear?: true }): Promise<string | null> {
  const base = await huellaDeAccionAbonos(db, dealId, opciones);
  if (!base) return null;
  const lineas = await lineasDelDeal(db, dealId, opciones?.bloquear === true);
  return createHash("sha256").update(textoDeBitacora({ base, lineas }) ?? "null").digest("hex");
}
