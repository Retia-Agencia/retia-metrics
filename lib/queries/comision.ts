import { and, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import type { Rango } from "@/lib/queries/dashboard";
import { filtroCierres } from "@/lib/queries/metricas-filtros";
import { saldosDeLineas } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

/** Comisión de una línea: valor vendido por el porcentaje congelado, redondeada a centavos. */
export function comisionDeDeal(
  valorVendidoUsd: string | number | null,
  comisionPorcentaje: string | number | null,
): number | null {
  if (valorVendidoUsd === null || comisionPorcentaje === null) return null;
  return Math.round((Number(valorVendidoUsd) * Number(comisionPorcentaje) / 100 + Number.EPSILON) * 100) / 100;
}

/** Suma por deal la comisión de sus líneas vendidas; una línea sin % vuelve nulo el deal. */
export async function comisionesDeDeals(db: Db, dealIds: readonly string[]): Promise<Map<string, number | null>> {
  if (dealIds.length === 0) return new Map();
  const lineas = [...(await saldosDeLineas(db, dealIds)).values()].filter((linea) => linea.vendida);
  return new Map([...new Set(dealIds)].map((dealId) => {
    const vendidas = lineas.filter((linea) => linea.dealId === dealId);
    if (vendidas.some((linea) => linea.comisionPorcentaje === null)) return [dealId, null];
    const total = vendidas.reduce((suma, linea) =>
      suma + (comisionDeDeal(linea.precio, linea.comisionPorcentaje) ?? 0), 0);
    return [dealId, Math.round((total + Number.EPSILON) * 100) / 100];
  }));
}

export interface ComisionDeCloser {
  userId: string | null;
  closerId: string | null;
  comisionUsd: number;
  ventasSinComision: number;
}

/** Suma exactamente los deals que forman la columna `cierres` del comparativo. */
export async function comisionesPorCloser(
  { programId, rango, cohorteId }: { programId: string; rango: Rango; cohorteId?: string | null },
  db: Db = dbDeLaApp,
): Promise<ComisionDeCloser[]> {
  return unaVezPorSolicitud(db, claveDe("comisionesPorCloser", programId, rango.desde, rango.hasta, cohorteId ?? null), async () => {
    const filas = await db.select({
      dealId: deals.id, userId: users.id, closerId: users.closerId,
      nombre: users.nombre, email: users.email,
    }).from(deals)
      .leftJoin(users, eq(users.id, deals.ownerUserId))
      .where(and(filtroCierres({ programId, rango, cohorteId }, db), vigente(deals)));
    const comisiones = await comisionesDeDeals(db, filas.map((fila) => fila.dealId));
    const porCloser = new Map<string, ComisionDeCloser>();
    for (const fila of filas) {
      const clave = fila.userId ?? "\u0000sin-dueno";
      const acumulado = porCloser.get(clave) ?? {
        userId: fila.userId ?? null,
        closerId: fila.closerId ?? fila.nombre ?? fila.email ?? null,
        comisionUsd: 0,
        ventasSinComision: 0,
      };
      const comision = comisiones.get(fila.dealId) ?? null;
      if (comision === null) acumulado.ventasSinComision += 1;
      else acumulado.comisionUsd = Math.round((acumulado.comisionUsd + comision + Number.EPSILON) * 100) / 100;
      porCloser.set(clave, acumulado);
    }
    return [...porCloser.values()];
  });
}
