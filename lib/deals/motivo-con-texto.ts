import { and, eq } from "drizzle-orm";
import { motivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";

/**
 * Exige la explicación de una re-agenda solo cuando así lo configura su motivo (ticket 218):
 * la marca `pide_texto` ("Otro"), nunca el nombre. Es la única regla; la usan Anotar y la
 * re-agenda con nota de `llamadas.ts`.
 */
export async function exigirTextoDelMotivo(
  db: Db,
  motivoId: string,
  comentario: string | null | undefined,
): Promise<void> {
  const [motivo] = await db
    .select({ pideTexto: motivos.pideTexto })
    .from(motivos)
    .where(and(eq(motivos.id, motivoId), eq(motivos.tipo, "reagenda"), eq(motivos.activo, true)));
  if (!motivo) throw new ErrorDeApp("El motivo de re-agenda no existe o está inactivo.", 422);
  if (motivo.pideTexto && !comentario?.trim()) {
    throw new ErrorDeApp("Este motivo pide que escribas el porqué.", 422);
  }
}
