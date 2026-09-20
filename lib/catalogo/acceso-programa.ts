import { and, eq } from "drizzle-orm";
import { miembrosPrograma } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { esAdministrador, type Rol } from "@/lib/auth/roles";

/**
 * "¿Este actor puede tocar una fila de ESTE programa?" — LA respuesta, en un solo
 * modulo (ADR 0016, ADR 0025, y la regla de AGENTS.md: si dos lugares responden la
 * misma pregunta, la respuesta vive en un modulo y los dos la importan).
 *
 * Nacio privada dentro de `lib/catalogo/productos.ts`. Cuando los recursos y los
 * enlaces de pago tambien pasaron a poder crearlos un closer (decision de Mani,
 * 19-sep, con el molde del ADR 0016), copiarla habria dejado dos lugares
 * respondiendo lo mismo —justo lo que se desincroniza—. Por eso vive aca y la
 * importan productos y recursos.
 *
 * La regla: quien ADMINISTRA (`esAdministrador`: gerente o developer, ADR 0025)
 * entra a cualquier programa; un closer solo a los programas donde tiene una
 * membresia ACTIVA. Es una regla de DATOS, verificada en el servidor contra la base,
 * aparte de la barrera de rol que ya enforza `requireRole("gerente","closer")` en la
 * ruta. No es seguridad de UI.
 *
 * `esAdministrador`, NO `rol === "gerente"` (ADR 0025 punto 5): el developer tambien
 * administra y no es miembro de ningun programa, asi que el chequeo a mano lo
 * mandaba al camino de la membresia y le negaba con un 403 que ademas mentia. Ese
 * literal escrito a mano es el bug que este repo ya arreglo dos veces.
 */
export interface ActorConAcceso {
  /** El uuid del usuario (para `change_log`). */
  id: string;
  /** Su rol de vista, no `session.user.rol` crudo (ADR 0028). */
  rol: Rol;
}

/**
 * Enforza el acceso por programa. Lanza `ErrorDeApp` 403 si el actor no puede.
 *
 * El mensaje se PARAMETRIZA porque "un programa donde no vendes" no aplica a un
 * brochure: cada llamador dice de que habla. Si no se pasa, cae a uno generico.
 */
export async function exigirAccesoAlPrograma(
  db: Db,
  actor: ActorConAcceso,
  programId: string,
  mensajeNegado = "No puedes gestionar contenido de un programa donde no vendes.",
): Promise<void> {
  if (esAdministrador(actor.rol)) return;
  const [membresia] = await db
    .select({ id: miembrosPrograma.id })
    .from(miembrosPrograma)
    .where(
      and(
        eq(miembrosPrograma.userId, actor.id),
        eq(miembrosPrograma.programId, programId),
        eq(miembrosPrograma.activo, true),
      ),
    )
    .limit(1);
  if (!membresia) {
    throw new ErrorDeApp(mensajeNegado, 403);
  }
}
