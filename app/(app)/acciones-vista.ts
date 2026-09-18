"use server";

import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/guards";
import { esAccesoTotal, esRolValido } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/auth/roles";
import { COOKIE_VISTA, esVistaValida, type Vista } from "@/lib/auth/vista";

/**
 * Server action que cambia la VISTA del "ver como" (ticket 028). Es el UNICO punto de
 * escritura de la cookie; `rolDeVista` es el unico de lectura.
 *
 * Solo un developer puede cambiar de vista. Se enforza en el servidor (no escondiendo
 * el selector): quien no pasa `esAccesoTotal` recibe un 403 aunque mande la peticion a
 * mano. Esto es coherente con que la vista solo ESTRECHA: para cualquier otro rol la
 * cookie se ignora en `rolDeVista`, asi que escribirla no tendria efecto —pero
 * rechazarla deja claro que no es una funcion suya.
 *
 * La cookie no es `httpOnly` a proposito: no guarda ningun secreto (solo `todo`,
 * `gerente` o `closer`) y no otorga privilegio por si sola —estrechar nunca ensancha—.
 * El cliente llama `router.refresh()` despues, porque la vista cambia lo que TODA
 * pantalla proyecta y `revalidatePath` no refresca la pantalla actual (AGENTS.md).
 */
export async function cambiarVista(vista: Vista): Promise<void> {
  const session = await requireSession();
  if (!esRolValido(session.user.rol) || !esAccesoTotal(session.user.rol)) {
    throw new AuthorizationError("Solo el rol de desarrollo puede cambiar de vista.");
  }
  if (!esVistaValida(vista)) {
    throw new AuthorizationError("Vista inválida.");
  }
  const store = await cookies();
  store.set(COOKIE_VISTA, vista, {
    path: "/",
    sameSite: "lax",
    // Un ano: es una preferencia de trabajo, no una sesion. Se limpia sola al elegir
    // otra vista o borrando la cookie.
    maxAge: 60 * 60 * 24 * 365,
  });
}
