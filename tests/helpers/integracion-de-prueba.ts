import { integraciones, type TipoIntegracion } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

export async function sembrarIntegracion(
  db: Db,
  programId: string,
  tipo: TipoIntegracion,
  secretos: Record<string, string>,
  config: Record<string, string> = {},
) {
  const [fila] = await db.insert(integraciones).values({
    programId, tipo, secretos, config,
  }).returning();
  return fila;
}
