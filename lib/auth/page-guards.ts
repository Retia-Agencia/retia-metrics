import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "./index";
import { puedeAcceder, type Rol } from "./roles";
import { rolDeVista } from "./vista";
import { rutaInicial } from "@/lib/nav";
import { programasVisibles } from "@/lib/auth/alcance";

/**
 * Guardas para paginas (no para APIs).
 * En vez de lanzar un 500, mandan al usuario a donde si puede estar.
 * Las APIs usan requireRole() de ./guards.ts, que responde 403.
 */

/**
 * A donde mandar a alguien segun su rol, resolviendo el primer programa contra la
 * base solo cuando hace falta. El slug del primer programa vive en la base
 * (ADR 0012), asi que no puede salir de `rutaInicial`, que es pura; se resuelve
 * aqui y se le pasa como dato.
 *
 * El primer programa se resuelve por el ALCANCE del rol (`programasVisibles`, ADR 0048):
 * el gerente y el developer ven todos los activos; el closer, solo aquellos donde tiene
 * membresia activa. Asi el closer aterriza en el Inbox de un programa que SI ve (ticket
 * 071); si no ve ninguno, `rutaInicial` lo lleva a `/mi-dia` de respaldo. El developer
 * nunca es redirigido en la practica (pasa toda guarda), pero se resuelve igual.
 */
export async function destinoInicial(userId: string, rol: Rol | null): Promise<string> {
  const visibles = await programasVisibles(userId, rol);
  return rutaInicial(rol, visibles[0]?.slug ?? null);
}

export async function paginaConSesion(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function paginaConRol(...permitidos: Rol[]): Promise<Session> {
  const session = await paginaConSesion();
  // La guarda se evalua contra el ROL DE VISTA, no contra el rol de la sesion: un
  // developer en vista `closer` no entra a `/ajustes` (la vista estrecha tambien la
  // guarda, ticket 028). Estrechar nunca otorga: un no-developer ignora la cookie y
  // `rolDeVista` le devuelve su rol real, asi que la disjuncion del ADR 0003 no se
  // toca. La salida cuando la vista esconde una ruta es el selector del menu de
  // usuario, que no depende de la vista.
  const rol = await rolDeVista(session);
  if (!puedeAcceder(rol, permitidos)) {
    redirect(await destinoInicial(session.user.id, rol));
  }
  return session;
}
