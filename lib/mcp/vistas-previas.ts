import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { mcpVistasPrevias } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";

const DIEZ_MINUTOS_MS = 10 * 60 * 1000;

export async function guardarVistaPrevia(db: Db, entrada: {
  tokenId: string;
  userId: string;
  programId: string;
  accion: string;
  argumentos: unknown;
  huellas: unknown;
  vistaPrevia: unknown;
}): Promise<{ id: string; venceEn: Date }> {
  const venceEn = new Date(Date.now() + DIEZ_MINUTOS_MS);
  const [insertada] = await db.insert(mcpVistasPrevias).values({ ...entrada, venceEn }).returning();
  const fila = insertada ? { id: insertada.id, venceEn: insertada.venceEn } : undefined;
  if (!fila) throw new Error("No se pudo guardar la vista previa del MCP.");
  return fila;
}

export async function tomarVistaPrevia(db: Db, entrada: { id: string; tokenId: string }) {
  const [fila] = await db.update(mcpVistasPrevias).set({ confirmadaEn: sql`now()` }).where(and(
    eq(mcpVistasPrevias.id, entrada.id),
    eq(mcpVistasPrevias.tokenId, entrada.tokenId),
    isNull(mcpVistasPrevias.confirmadaEn),
    gt(mcpVistasPrevias.venceEn, sql`now()`),
  )).returning();
  if (!fila) {
    throw new ErrorDeApp("Esa vista previa ya se usó, venció o no es de esta conexión. Prepárala de nuevo.", 409);
  }
  return fila;
}

export async function leerVistaPreviaConfirmada(db: Db, entrada: { id: string; tokenId: string }) {
  const [fila] = await db.select().from(mcpVistasPrevias).where(and(
    eq(mcpVistasPrevias.id, entrada.id),
    eq(mcpVistasPrevias.tokenId, entrada.tokenId),
    isNotNull(mcpVistasPrevias.confirmadaEn),
  ));
  return fila ?? null;
}

export async function anotarFila(db: Db, id: string, fila: unknown): Promise<void> {
  const lote = JSON.stringify([fila]);
  await db.update(mcpVistasPrevias).set({
    resultado: sql`coalesce(${mcpVistasPrevias.resultado}, '[]'::jsonb) || ${lote}::jsonb`,
  }).where(eq(mcpVistasPrevias.id, id));
}
