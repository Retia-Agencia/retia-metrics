import type { Session } from "next-auth";
import { ErrorDeApp } from "@/lib/errors";
import { auth } from "./index";
import {
  AuthenticationError,
  AuthorizationError,
  puedeAcceder,
  type Rol,
} from "./roles";

/**
 * Guardas de servidor. TODO route handler y server action pasa por aca.
 * La verificacion es en el servidor, no escondiendo componentes en el cliente.
 */

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthenticationError();
  return session;
}

/**
 * Exige uno de los roles indicados. Lanza AuthorizationError (403) si no cuadra.
 * Un closer NUNCA pasa un requireRole("gerente"), sin importar la ruta.
 */
export async function requireRole(...permitidos: Rol[]): Promise<Session> {
  const session = await requireSession();
  if (!puedeAcceder(session.user.rol, permitidos)) {
    throw new AuthorizationError(
      `Esta vista es solo para: ${permitidos.join(", ")}.`,
    );
  }
  return session;
}

/** Azucar para el caso mas comun. */
export const requireGerente = () => requireRole("gerente");

/**
 * Traduce los errores de las guardas a una respuesta HTTP.
 * Uso: `try { await requireRole("gerente") } catch (e) { return respuestaDeError(e) }`
 */
export function respuestaDeError(error: unknown): Response {
  if (error instanceof ErrorDeApp) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[error no controlado]", error);
  return Response.json({ error: "Error interno." }, { status: 500 });
}

export { AuthenticationError, AuthorizationError, puedeAcceder };
export type { Rol };
