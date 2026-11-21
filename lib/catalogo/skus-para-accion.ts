import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { cohorts, programs, skus } from "@/lib/db/schema";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import type { Db } from "@/lib/db/tipos";

/**
 * Lecturas de SKU para las acciones del MCP (ticket 386): el estado que se muestra antes de confirmar y la huella
 * que detecta un cambio entre la vista previa y la confirmación. Vive aquí y no en `lib/mcp/` porque el guardián
 * del MCP prohíbe el SQL fuera de token, sesión, bitácora y vistas previas.
 */

export async function leerSkuParaAccion(db: Db, id: string, bloquear = false) {
  const consulta = db.select({ sku: skus, codigoCohorte: cohorts.codigo }).from(skus)
    .innerJoin(cohorts, eq(cohorts.id, skus.cohortId))
    .where(eq(skus.id, id));
  const [fila] = bloquear ? await consulta.for("update", { of: skus }) : await consulta;
  return fila ?? null;
}

export async function leerProgramaParaAccion(db: Db, id: string) {
  const [programa] = await db.select({ id: programs.id, nombre: programs.nombre }).from(programs).where(eq(programs.id, id));
  return programa ?? null;
}

export function resumenDeSku(sku: typeof skus.$inferSelect) {
  return {
    codigo: sku.codigo,
    nombre: sku.nombre,
    precio_lista_usd: sku.precioListaUsd,
    comision_porcentaje: sku.comisionPorcentaje,
    cuenta_como_cupo: sku.cuentaComoCupo,
    predeterminado: sku.predeterminado,
    activo: sku.activo,
  };
}

export async function huellaDeSku(db: Db, id: string, bloquear?: true): Promise<string | null> {
  const fila = await leerSkuParaAccion(db, id, bloquear === true);
  if (!fila) return null;
  return createHash("sha256").update(textoDeBitacora({ sku: fila.sku, cohorte: fila.codigoCohorte }) ?? "null").digest("hex");
}

/** Crear no tiene SKU previo: la huella es el programa y los códigos que ya tiene, para ver un alta concurrente. */
export async function huellaDeProgramaParaCrearSku(db: Db, programId: string, bloquear?: true): Promise<string | null> {
  const consulta = db.select({ id: programs.id }).from(programs).where(eq(programs.id, programId));
  const [programa] = bloquear ? await consulta.for("update") : await consulta;
  if (!programa) return null;
  const existentes = await db.select({ codigo: skus.codigo }).from(skus).where(eq(skus.programId, programId));
  return createHash("sha256")
    .update(textoDeBitacora(existentes.map((fila) => fila.codigo).sort()) ?? "null")
    .digest("hex");
}
