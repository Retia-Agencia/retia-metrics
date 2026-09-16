import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "./index";
import { puedeAcceder, type Rol } from "./roles";
import { rutaInicial } from "@/lib/nav";
import { programasActivos } from "@/lib/queries/programas";

/**
 * Guardas para paginas (no para APIs).
 * En vez de lanzar un 500, mandan al usuario a donde si puede estar.
 * Las APIs usan requireRole() de ./guards.ts, que responde 403.
 */

/**
 * A donde mandar a alguien segun su rol, resolviendo el primer programa contra la
 * base solo cuando hace falta. El slug del primer programa vive en la base
 * (ADR 0012), asi que no puede salir de `rutaInicial`, que es pura; se resuelve
 * aqui y se le pasa como dato. Solo el gerente aterriza en un programa, asi que
 * solo por el gerente se consulta la base.
 */
export async function destinoInicial(rol: Rol | null): Promise<string> {
  if (rol !== "gerente") return rutaInicial(rol, null);
  const programas = await programasActivos();
  return rutaInicial(rol, programas[0]?.slug ?? null);
}

export async function paginaConSesion(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function paginaConRol(...permitidos: Rol[]): Promise<Session> {
  const session = await paginaConSesion();
  if (!puedeAcceder(session.user.rol, permitidos)) {
    redirect(await destinoInicial(session.user.rol));
  }
  return session;
}
