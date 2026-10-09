import { redirect, notFound } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "./index";
import { puedeAcceder, type Rol } from "./roles";
import { rolDeVista, sesionEfectiva } from "./vista";
import { rutaInicial } from "@/lib/nav";
import { programasVisibles } from "@/lib/auth/alcance";
import { elegirPrograma } from "@/lib/programa-preferido";
import { programaPreferidoDeCookie } from "@/lib/programa-preferido-servidor";

/**
 * Guardas para paginas (no para APIs).
 * En vez de lanzar un 500, mandan al usuario a donde si puede estar.
 * Las APIs usan requireRole() de ./guards.ts, que responde 403.
 */

/**
 * A donde mandar a alguien segun su rol, resolviendo el programa preferido contra la
 * base solo cuando hace falta. El slug de respaldo vive en la base
 * (ADR 0012), asi que no puede salir de `rutaInicial`, que es pura; se resuelve
 * aqui y se le pasa como dato.
 *
 * El programa se resuelve por el ALCANCE del rol (`programasVisibles`, ADR 0048):
 * el gerente y el developer ven todos los activos; el closer, solo aquellos donde tiene
 * membresia activa. Asi el closer aterriza en el Inbox de un programa que SI ve (ticket
 * 071); si no ve ninguno, `rutaInicial` lo lleva a `/mi-dia` de respaldo. El developer
 * nunca es redirigido en la practica (pasa toda guarda), pero se resuelve igual.
 */
export async function destinoInicial(userId: string, rol: Rol | null): Promise<string> {
  const [visibles, preferido] = await Promise.all([
    programasVisibles(userId, rol),
    programaPreferidoDeCookie(),
  ]);
  return rutaInicial(rol, elegirPrograma(visibles, preferido)?.slug ?? null);
}

export async function paginaConSesion(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // La sesión EFECTIVA: si un developer suplanta a un closer ("ver como", ticket 172),
  // esta sesión ya trae el id, el rol y el closerId del suplantado, así que TODA lectura
  // de la página proyecta con ese usuario sin tocar una línea más. Las páginas son
  // lectura (GET): la reja de solo lectura vive en `requireSession`, no aquí.
  return sesionEfectiva(session);
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

/**
 * Una pagina que se CIERRA con 404 a quien no cumple una capacidad (ticket 224, ADR 0082).
 *
 * A diferencia de `paginaConRol`, que redirige a donde el usuario SI puede estar, esta
 * responde `notFound()`: la ruta no existe para quien no cumple el predicado. Es lo que
 * pidio Mani para el Dashboard, su lista, Metas y la ficha del Programa, cerradas al closer
 * en el servidor y no solo escondidas del menu.
 *
 * El predicado se evalua contra el ROL DE VISTA (`rolDeVista`), no el de la sesion: un
 * developer en vista `closer` ve lo del closer (404 en estas rutas), y en vista `todo` pasa
 * —`esAccesoTotal`, dentro de las preguntas por capacidad, siempre responde `true`—. Asi el
 * literal "developer" nunca se escribe en la guarda (ADR 0025). Recibe la pregunta por
 * CAPACIDAD (`veTableroDelPrograma`, `configuraPrograma`), nunca un `rol === "..."`.
 */
export async function paginaConCapacidad(
  puede: (rol: Rol | null) => boolean,
): Promise<Session> {
  const session = await paginaConSesion();
  const rol = await rolDeVista(session);
  if (!puede(rol)) notFound();
  return session;
}

/**
 * `/nerd-stats` y su bitacora. Es `paginaConRol` sin ningun rol permitido: gerente y
 * closer, disjuntos entre si, quedan los dos afuera, y el unico que entra lo decide
 * `puedeAcceder`. Asi el rol nunca se escribe a mano en la guarda (ticket 068).
 */
export async function paginaDeAccesoTotal(): Promise<Session> {
  return paginaConRol();
}
