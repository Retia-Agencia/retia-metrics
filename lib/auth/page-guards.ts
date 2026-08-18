import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "./index";
import { puedeAcceder, type Rol } from "./roles";
import { rutaInicial } from "@/lib/nav";

/**
 * Guardas para paginas (no para APIs).
 * En vez de lanzar un 500, mandan al usuario a donde si puede estar.
 * Las APIs usan requireRole() de ./guards.ts, que responde 403.
 */

export async function paginaConSesion(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function paginaConRol(...permitidos: Rol[]): Promise<Session> {
  const session = await paginaConSesion();
  if (!puedeAcceder(session.user.rol, permitidos)) {
    redirect(rutaInicial(session.user.rol));
  }
  return session;
}
