import { and, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Rango } from "@/lib/queries/dashboard";
import { filtroCierres } from "@/lib/queries/metricas-filtros";
import { vigente } from "@/lib/queries/vigente";

/**
 * La comision se calcula, nunca se guarda: valor vendido por el porcentaje congelado
 * en el deal cuando entro a venta (ticket 133). Siempre es USD y siempre queda
 * acotada a un programa: dos programas no se suman.
 */
export function comisionDeDeal(
  valorVendidoUsd: string | number | null,
  comisionPorcentaje: string | number | null,
): number | null {
  if (valorVendidoUsd === null || comisionPorcentaje === null) return null;
  return Math.round((Number(valorVendidoUsd) * Number(comisionPorcentaje) / 100 + Number.EPSILON) * 100) / 100;
}

export interface ComisionDeCloser {
  closerId: string | null;
  comisionUsd: number;
  ventasSinComision: number;
}

/** Suma exactamente los deals que forman la columna `cierres` del comparativo. */
export async function comisionesPorCloser(
  { programId, rango }: { programId: string; rango: Rango },
  db: Db = dbDeLaApp,
): Promise<ComisionDeCloser[]> {
  const filas = await db
    .select({
      userId: users.id,
      closerId: users.closerId,
      nombre: users.nombre,
      email: users.email,
      valorVendidoUsd: deals.valorVendidoUsd,
      comisionPorcentaje: deals.comisionPorcentaje,
    })
    .from(deals)
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(filtroCierres({ programId, rango }, db), vigente(deals)));

  const porCloser = new Map<string, ComisionDeCloser>();
  for (const fila of filas) {
    const clave = fila.userId ?? "\u0000sin-dueno";
    const etiqueta = fila.closerId ?? fila.nombre ?? fila.email ?? null;
    const acumulado = porCloser.get(clave) ?? {
      closerId: etiqueta,
      comisionUsd: 0,
      ventasSinComision: 0,
    };
    const comision = comisionDeDeal(fila.valorVendidoUsd, fila.comisionPorcentaje);
    if (comision === null) acumulado.ventasSinComision += 1;
    else acumulado.comisionUsd = Math.round((acumulado.comisionUsd + comision + Number.EPSILON) * 100) / 100;
    porCloser.set(clave, acumulado);
  }
  return [...porCloser.values()];
}
