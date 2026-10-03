"use server";

import { cookies } from "next/headers";
import { requireSesionReal } from "@/lib/auth/guards";
import { esAccesoTotal, esRolValido } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/auth/roles";
import {
  COOKIE_VISTA,
  PREFIJO_SUPLANTACION,
  esVistaValida,
  type Vista,
} from "@/lib/auth/vista";

/**
 * Server actions que cambian la VISTA del "ver como" (tickets 028 y 172). Son el ÚNICO
 * punto de escritura de la cookie; `rolDeVista`/`sesionEfectiva` son los de lectura.
 *
 * Solo un developer puede cambiar de vista. Se enforza en el servidor (no escondiendo
 * el selector): quien no pasa `esAccesoTotal` recibe un 403 aunque mande la peticion a
 * mano. La decisión usa `requireSesionReal` —la sesión REAL, sin suplantar— a propósito
 * (ticket 172): si usara la sesión efectiva, un developer que ya está "viendo como"
 * closer saldría como closer sin acceso total y no podría salir de la vista. Esto es
 * coherente con que la vista solo ESTRECHA: para cualquier otro rol la cookie se ignora
 * al leerla, así que escribirla no tendría efecto.
 *
 * La cookie no es `httpOnly` a proposito: no guarda ningun secreto (solo `todo`,
 * `gerente`, `closer` o `closer:<id>`) y no otorga privilegio por si sola —estrechar
 * nunca ensancha, y suplantar se re-valida contra `users` en CADA lectura—. El cliente
 * llama `router.refresh()` despues, porque la vista cambia lo que TODA pantalla proyecta
 * y `revalidatePath` no refresca la pantalla actual (AGENTS.md).
 */

/** El tiempo de vida de la cookie: una preferencia de trabajo, no una sesion. */
const MAX_AGE = 60 * 60 * 24 * 365;

async function exigirDeveloper() {
  const session = await requireSesionReal();
  if (!esRolValido(session.user.rol) || !esAccesoTotal(session.user.rol)) {
    throw new AuthorizationError("Solo el rol de desarrollo puede cambiar de vista.");
  }
}

export async function cambiarVista(vista: Vista): Promise<void> {
  await exigirDeveloper();
  if (!esVistaValida(vista)) {
    throw new AuthorizationError("Vista inválida.");
  }
  const store = await cookies();
  store.set(COOKIE_VISTA, vista, { path: "/", sameSite: "lax", maxAge: MAX_AGE });
}

/**
 * Suplanta a un closer de verdad ("ver como Nicolás", ticket 172): escribe la cookie
 * `closer:<users.id>`. No se valida el closer aquí —se re-valida contra `users` en CADA
 * lectura, en `sesionEfectiva`—: un id inválido simplemente no suplanta y la vista
 * vuelve a `todo`. El id es opaco y no es un secreto; la reja de datos vive en la
 * lectura, no en la escritura de la cookie.
 */
export async function verComoCloser(userId: string): Promise<void> {
  await exigirDeveloper();
  const id = userId.trim();
  if (id.length === 0) throw new AuthorizationError("Falta el closer a suplantar.");
  const store = await cookies();
  store.set(COOKIE_VISTA, `${PREFIJO_SUPLANTACION}${id}`, {
    path: "/",
    sameSite: "lax",
    maxAge: MAX_AGE,
  });
}
