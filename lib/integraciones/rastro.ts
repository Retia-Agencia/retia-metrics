import { changeLog } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/** Confirma que un secreto cambió sin copiarlo a la bitácora. */
export const TOKEN_OCULTO = "(oculto)";

export async function registrarCambioDeSecreto(
  db: Db,
  input: {
    tabla: string;
    registroId: string;
    etiqueta: string;
    campo: string;
    teniaValor: boolean;
    actorId: string;
  },
): Promise<void> {
  await db.insert(changeLog).values({
    tabla: input.tabla,
    registroId: input.registroId,
    etiqueta: input.etiqueta,
    campo: input.campo,
    valorAnterior: input.teniaValor ? TOKEN_OCULTO : null,
    valorNuevo: TOKEN_OCULTO,
    origen: "app",
    userId: input.actorId,
  });
}
