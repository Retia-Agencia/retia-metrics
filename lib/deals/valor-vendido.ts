import { eq } from "drizzle-orm";
import { z } from "zod";
import { deals, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { OrigenOperativo } from "@/lib/crm/rastro";
import { ErrorDeApp } from "@/lib/errors";
import { usd } from "@/lib/format";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { saldosDeLineas } from "@/lib/queries/saldo";
import { asegurarLineaConCupo, editarValorDeLinea, lineaConCupoVigente, lineaVigente } from "./lineas";

/** Descuento en USD escrito por el closer. Cero es un descuento válido. */
export const esquemaDescuentoUsd = z
  .number({ error: "El descuento debe ser un número." })
  .min(0, "El descuento no puede ser negativo.")
  .multipleOf(0.01, "El descuento admite máximo dos decimales.")
  .lt(100_000_000, "El descuento debe ser menor que USD 100.000.000,00.");

export const esquemaDescuentoUsdOpcional = esquemaDescuentoUsd.optional();

type FilaDeal = typeof deals.$inferSelect;

export interface ValorVendidoCongelado {
  cohortId: string;
  precioTicketUsd: number;
  descuentoUsd: number;
  valorVendidoUsd: number;
  valorAnteriorUsd: number | null;
  abonadoUsd: number;
}

/**
 * Congela el total vendido desde el único precio de lista: el de la cohorte.
 * Todos los escritores pasan por aquí para compartir la asignación de cohorte y
 * las rejas contra el ticket y lo ya abonado.
 */
export async function congelarValorVendido(
  tx: Db,
  entrada: {
    deal: FilaDeal;
    descuentoUsd: number;
    actorId: string | null;
    etiqueta: string;
    lineaId?: string;
    origen?: OrigenOperativo;
  },
): Promise<ValorVendidoCongelado> {
  const descuentoUsd = esquemaDescuentoUsd.parse(entrada.descuentoUsd);
  let cohortId = entrada.deal.cohortId;

  if (cohortId == null) {
    const activa = await cohorteActiva(entrada.deal.programId, tx);
    if (!activa) {
      throw new ErrorDeApp("La cohorte del deal no tiene precio: asígnale una cohorte antes de vender.", 422);
    }
    cohortId = activa.id;
  }

  let linea = entrada.lineaId
    ? await lineaVigente(tx, entrada.deal.id, entrada.lineaId)
    : await lineaConCupoVigente(tx, entrada.deal.id);
  if (!linea) {
    linea = await asegurarLineaConCupo(tx, {
      deal: entrada.deal, cohortId, actorId: entrada.actorId,
      etiqueta: entrada.etiqueta, origen: entrada.origen,
    });
  }
  const [sku] = await tx.select({ cohortId: skus.cohortId }).from(skus).where(eq(skus.id, linea.skuId));
  if (!sku) throw new ErrorDeApp("La línea no tiene un SKU válido.", 409);
  cohortId = sku.cohortId;
  const precioTicketUsd = Number(linea.precioListaUsd);
  if (descuentoUsd >= precioTicketUsd) {
    throw new ErrorDeApp(
      `El descuento no puede ser igual o mayor que el ticket de la cohorte (${usd(precioTicketUsd)}).`,
      422,
    );
  }

  const valorVendidoUsd = Math.round((precioTicketUsd - descuentoUsd) * 100) / 100;
  const saldo = (await saldosDeLineas(tx, [entrada.deal.id])).get(linea.id);
  const abonadoUsd = saldo?.abonado ?? 0;
  if (valorVendidoUsd < abonadoUsd) {
    throw new ErrorDeApp(
      `El valor vendido (${usd(valorVendidoUsd)}) queda por debajo de lo ya abonado (${usd(abonadoUsd)}): anula primero el abono que sobra.`,
      422,
    );
  }

  const valorAnteriorUsd = Number(linea.valorVendidoUsd);
  await editarValorDeLinea(tx, {
    deal: entrada.deal, lineaId: linea.id, valorVendidoUsd,
    actorId: entrada.actorId, etiqueta: entrada.etiqueta, origen: entrada.origen,
  });

  return { cohortId, precioTicketUsd, descuentoUsd, valorVendidoUsd, valorAnteriorUsd, abonadoUsd };
}
