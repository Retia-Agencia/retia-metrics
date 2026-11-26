import { and, eq } from "drizzle-orm";
import { motivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import type { TipoMotivo } from "./etapas";

/**
 * Exige la explicación solo cuando así lo configura el motivo de la lista esperada: la marca
 * `pide_texto` ("Otro"), nunca el nombre. Anotar conserva el mismo contrato de re-agenda.
 */
export async function exigirTextoDelMotivo(
  db: Db,
  motivoId: string,
  tipo: TipoMotivo,
  comentario: string | null | undefined,
): Promise<void> {
  const [motivo] = await db
    .select({ pideTexto: motivos.pideTexto })
    .from(motivos)
    .where(and(eq(motivos.id, motivoId), eq(motivos.tipo, tipo), eq(motivos.activo, true)));
  if (!motivo) throw new ErrorDeApp("El motivo no existe, está inactivo o pertenece a otra lista.", 422);
  if (motivo.pideTexto && !comentario?.trim()) {
    throw new ErrorDeApp("Este motivo pide que escribas el porqué.", 422);
  }
}
