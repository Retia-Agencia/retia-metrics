"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { AuthorizationError } from "@/lib/auth/roles";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { editarCloserIdPropio, type EntradaCloserIdPropio } from "@/lib/catalogo/usuarios";

/**
 * Server action del perfil propio (ticket 031): un usuario se carga su propio
 * `closerId` sin pasar por `/ajustes/usuarios` (que administra a OTROS).
 *
 * Tres barreras, todas en el SERVIDOR (esconder el input no es seguridad):
 *
 *  1. **Quien puede escribir:** solo quien `esAdministrador` (gerente o developer,
 *     ADR 0025). Se decide con el ROL DE VISTA (`rolDeVista`, ticket 028), nunca con
 *     `session.user.rol` crudo ni comparando contra un literal. Un closer —o un
 *     developer proyectado a vista `closer`— recibe 403 aunque el formulario nunca se
 *     le haya mostrado. Esto es lo que impide que alguien se atribuya la historia de
 *     otro escribiendo su `closerId` en un campo de texto.
 *  2. **A quien:** SIEMPRE a la propia fila. El id sale de la sesion
 *     (`session.user.id`), nunca del formulario ni de la URL, asi que no hay forma de
 *     escribir el `closerId` de otro usuario desde esta pantalla.
 *  3. **El cambio queda en `change_log`** porque la mutacion reusa el molde de
 *     catalogo (ADR 0012).
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[perfil] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

export async function guardarCloserIdPropioAccion(
  input: EntradaCloserIdPropio,
): Promise<ResultadoAccion> {
  try {
    const session = await requireSession();
    const rol = await rolDeVista(session);
    if (!esAdministrador(rol)) {
      throw new AuthorizationError(
        "Solo un administrador puede editar el closer_id. Pídeselo a tu gerente.",
      );
    }
    // El objetivo es SIEMPRE la propia fila: el id sale de la sesion, no del input.
    await editarCloserIdPropio(db, session.user.id, session.user.id, input);
    revalidatePath("/perfil");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
