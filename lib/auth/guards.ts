import type { Session } from "next-auth";
import { ZodError } from "zod";
import { ErrorDeApp } from "@/lib/errors";
import { auth } from "./index";
import {
  AuthenticationError,
  AuthorizationError,
  puedeAcceder,
  type Rol,
} from "./roles";
import { rolDeVista, sesionEfectiva } from "./vista";

/**
 * Guardas de servidor. TODO route handler y server action pasa por aca.
 * La verificacion es en el servidor, no escondiendo componentes en el cliente.
 */

/**
 * La sesion REAL, sin resolver la suplantacion ni aplicar la reja de solo lectura. Es
 * la ÚNICA excepción nombrada a `requireSession` (ticket 172): `cambiarVista` la usa
 * para decidir con el rol REAL quién puede cambiar de vista (`esAccesoTotal`) y para que
 * "Salir" funcione aunque la vista esté suplantando a un closer —si usara la sesión
 * efectiva, saldría como un closer sin acceso total y no podría salir de la vista—.
 * No es un bypass genérico: solo cambia la cookie, nunca toca datos del negocio.
 */
export async function requireSesionReal(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) throw new AuthenticationError();
  return session;
}

/**
 * ¿La invocación actual es una ESCRITURA? Hoy = una server action, que Next marca con la
 * cabecera `next-action`. Las server actions son el único camino de escritura de datos
 * de la app (los webhooks POST no pasan por aquí; `/api/me` y `/api/admin/ping` son GET).
 *
 * ⚠️ Esta reja NO cubre route handlers: desde dentro de la guarda no se puede saber el
 * método HTTP (no es una cabecera, y `requireSession` no recibe el `Request`). Mientras
 * todo write sea una server action esto basta; el día que se agregue un route handler de
 * escritura que pase por aquí, hay que pasarle el método a la guarda (opción B del
 * análisis de la decisión 7). Lo vigila `tests/reja-solo-lectura-handlers.test.ts`.
 */
async function esEscritura(): Promise<boolean> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return h.get("next-action") != null;
}

export async function requireSession(): Promise<Session> {
  const real = await requireSesionReal();
  const session = await sesionEfectiva(real);
  // Reja de solo lectura (ticket 172): una sesión suplantada ("ver como") puede LEER
  // todo lo del closer, pero no ESCRIBIR nada. La reja vive en UN solo lugar —aquí, por
  // donde pasa toda server action— y da el mismo mensaje que ve la barra fija.
  if (session.user.suplantadoPor && (await esEscritura())) {
    throw new AuthorizationError(
      `Estás viendo como ${session.user.name ?? session.user.email}: solo lectura.`,
    );
  }
  return session;
}

/**
 * Exige uno de los roles indicados. Lanza AuthorizationError (403) si no cuadra.
 * Un closer NUNCA pasa un requireRole("gerente"), sin importar la ruta.
 */
export async function requireRole(...permitidos: Rol[]): Promise<Session> {
  const session = await requireSession();
  // Se evalua contra el ROL DE VISTA (ticket 028): un developer en vista `closer` es
  // un closer para el servidor, y en vista `gerente` vuelve a tener prohibido lo del
  // closer (ADR 0003). Estrechar nunca otorga: un no-developer ignora la cookie y
  // `rolDeVista` le devuelve su rol real, asi que la disjuncion no cambia.
  const rol = await rolDeVista(session);
  if (!puedeAcceder(rol, permitidos)) {
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
  // Entrada invalida = 400. Se manda el mensaje del primer problema y no el arbol
  // completo de issues: alcanza para corregir la peticion y no describe la forma
  // interna del esquema.
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? "Peticion invalida." }, { status: 400 });
  }
  console.error("[error no controlado]", error);
  return Response.json({ error: "Error interno." }, { status: 500 });
}

export { AuthenticationError, AuthorizationError, puedeAcceder };
export type { Rol };
