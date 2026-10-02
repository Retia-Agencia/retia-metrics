import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { cohorts, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { ErrorDeApp } from "@/lib/errors";
import { usd } from "@/lib/format";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { saldosDeDeals } from "@/lib/queries/saldo";

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
    await editarConRastro(
      { db: tx, tabla: deals, nombreTabla: "deals", actorId: entrada.actorId, etiqueta: entrada.etiqueta },
      entrada.deal.id,
      { cohortId },
    );
  }

  const [cohorte] = await tx
    .select({ precioUsd: cohorts.precioUsd })
    .from(cohorts)
    .where(and(eq(cohorts.id, cohortId), eq(cohorts.programId, entrada.deal.programId)));
  if (cohorte?.precioUsd == null) {
    throw new ErrorDeApp("La cohorte del deal no tiene precio: asígnale una cohorte antes de vender.", 422);
  }

  const precioTicketUsd = Number(cohorte.precioUsd);
  if (descuentoUsd >= precioTicketUsd) {
    throw new ErrorDeApp(
      `El descuento no puede ser igual o mayor que el ticket de la cohorte (${usd(precioTicketUsd)}).`,
      422,
    );
  }

  const valorVendidoUsd = Math.round((precioTicketUsd - descuentoUsd) * 100) / 100;
  const saldo = (await saldosDeDeals(tx, [entrada.deal.id])).get(entrada.deal.id);
  const abonadoUsd = saldo?.abonado ?? 0;
  if (valorVendidoUsd < abonadoUsd) {
    throw new ErrorDeApp(
      `El valor vendido (${usd(valorVendidoUsd)}) queda por debajo de lo ya abonado (${usd(abonadoUsd)}): anula primero el abono que sobra.`,
      422,
    );
  }

  const valorAnteriorUsd = entrada.deal.valorVendidoUsd == null ? null : Number(entrada.deal.valorVendidoUsd);
  await editarConRastro(
    { db: tx, tabla: deals, nombreTabla: "deals", actorId: entrada.actorId, etiqueta: entrada.etiqueta },
    entrada.deal.id,
    { valorVendidoUsd: String(valorVendidoUsd) },
  );

  return { cohortId, precioTicketUsd, descuentoUsd, valorVendidoUsd, valorAnteriorUsd, abonadoUsd };
}
