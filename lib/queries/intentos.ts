import { and, eq, gte, inArray, isNull, ne, or } from "drizzle-orm";
import { dealActividades, dealEtapaHistorial } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { vigente } from "@/lib/queries/vigente";

/**
 * ponytail: un solo valor para todos los programas; el camino de mejora es una columna
 * en `programs` con su migracion.
 */
export const INTENTOS_PARA_ALERTA = 3;

/** La única definición de cuántos intentos lleva un deal desde que entró a su etapa actual. */
export async function intentosEnEtapaPorDeal(
  db: Db,
  deals_: { dealId: string; etapa: EtapaDeal; createdAt: Date }[],
): Promise<Map<string, number>> {
  const conteos = new Map<string, number>();
  if (deals_.length === 0) return conteos;

  const dealIds = deals_.map((deal) => deal.dealId);
  const etapas = [...new Set(deals_.map((deal) => deal.etapa))];
  const movimientos = await db
    .select({
      dealId: dealEtapaHistorial.dealId,
      de: dealEtapaHistorial.de,
      a: dealEtapaHistorial.a,
      fecha: dealEtapaHistorial.fecha,
    })
    .from(dealEtapaHistorial)
    .where(
      and(
        inArray(dealEtapaHistorial.dealId, dealIds),
        inArray(dealEtapaHistorial.a, etapas),
        or(isNull(dealEtapaHistorial.de), ne(dealEtapaHistorial.de, dealEtapaHistorial.a)),
      ),
    );

  const ultimaEntradaPorDeal = new Map<string, Date>();
  const etapaPorDeal = new Map(deals_.map((deal) => [deal.dealId, deal.etapa]));
  for (const movimiento of movimientos) {
    if (movimiento.a !== etapaPorDeal.get(movimiento.dealId)) continue;
    const entrada = ultimaEntradaPorDeal.get(movimiento.dealId);
    if (!entrada || movimiento.fecha.getTime() > entrada.getTime()) {
      ultimaEntradaPorDeal.set(movimiento.dealId, movimiento.fecha);
    }
  }
  const entradaPorDeal = new Map(deals_.map((deal) => [
    deal.dealId,
    ultimaEntradaPorDeal.get(deal.dealId) ?? deal.createdAt,
  ]));

  const entradaMasAntigua = [...entradaPorDeal.values()].reduce((menor, fecha) =>
    fecha.getTime() < menor.getTime() ? fecha : menor);
  const intentos = await db
    .select({ dealId: dealActividades.dealId, fecha: dealActividades.fecha })
    .from(dealActividades)
    .where(
      and(
        inArray(dealActividades.dealId, dealIds),
        eq(dealActividades.tipo, "intento"),
        gte(dealActividades.fecha, entradaMasAntigua),
        vigente(dealActividades),
      ),
    );

  for (const intento of intentos) {
    const entrada = entradaPorDeal.get(intento.dealId);
    if (!entrada || intento.fecha.getTime() < entrada.getTime()) continue;
    conteos.set(intento.dealId, (conteos.get(intento.dealId) ?? 0) + 1);
  }
  return conteos;
}
