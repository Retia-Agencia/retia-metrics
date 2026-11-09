import { avisosEstudianteNuevo } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/** Se ejecuta dentro de la transaccion de moverEtapa; el indice por deal da la idempotencia. */
export async function encolarAvisoDeEstudiante(
  tx: Db,
  input: { programId: string; dealId: string },
): Promise<void> {
  await tx
    .insert(avisosEstudianteNuevo)
    .values(input)
    .onConflictDoNothing({ target: [avisosEstudianteNuevo.dealId] });
}
