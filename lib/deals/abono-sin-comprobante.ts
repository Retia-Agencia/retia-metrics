import { and, inArray, isNull } from "drizzle-orm";
import { abonos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

/** Sin soporte = sin enlace ni archivo. `vigente(abonos)` va en cada consulta: el guardián de vigencia lo exige ahí (ADR 0026). */
function condicionAbonoSinComprobante(dealIds: readonly string[]) {
  return and(
    inArray(abonos.dealId, [...dealIds]),
    isNull(abonos.comprobanteUrl),
    isNull(abonos.comprobanteArchivoId),
  );
}

/** Una sola respuesta para ficha, Kanban e Inbox: deals con un abono vigente sin soporte. */
export async function dealsConAbonoSinComprobante(db: Db, dealIds: readonly string[]): Promise<Set<string>> {
  if (dealIds.length === 0) return new Set();
  const filas = await db
    .select({ dealId: abonos.dealId })
    .from(abonos)
    .where(and(condicionAbonoSinComprobante(dealIds), vigente(abonos)));
  return new Set(filas.map((fila) => fila.dealId));
}

/** Fecha del abono vigente sin comprobante más antiguo de cada deal (ticket 428). */
export async function fechaDeAbonoSinComprobantePorDeal(
  db: Db,
  dealIds: readonly string[],
): Promise<Map<string, string>> {
  if (dealIds.length === 0) return new Map();
  const filas = await db
    .select({ dealId: abonos.dealId, fecha: abonos.fecha })
    .from(abonos)
    .where(and(condicionAbonoSinComprobante(dealIds), vigente(abonos)));
  const fechas = new Map<string, string>();
  for (const fila of filas) {
    const previa = fechas.get(fila.dealId);
    if (!previa || fila.fecha < previa) fechas.set(fila.dealId, fila.fecha);
  }
  return fechas;
}
