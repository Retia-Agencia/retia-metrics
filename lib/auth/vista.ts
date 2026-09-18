import type { Session } from "next-auth";
import { esAccesoTotal, esRolValido, type Rol } from "./roles";

/**
 * "Ver como": con que rol se proyecta y se guarda una pantalla (ticket 028, enmienda
 * al ADR 0025).
 *
 * El problema de fondo que resuelve: la pregunta "¿con que rol pinto esta pantalla?"
 * vivia contestada a mano en `/mi-dia`, `/recursos` y `/productos`, con tres
 * expresiones distintas (`rol === "closer" ? ... : ...`, `esAdministrador`, y su
 * propia inversion). Tres copias que se desincronizan: fue la causa de que el hueco
 * de `/recursos` sobreviviera al 024. `rolDeVista` es LA definicion, una sola: ninguna
 * pagina vuelve a comparar `session.user.rol` a mano (ADR 0024, una respuesta por
 * pregunta).
 *
 * Un developer ve toda la app y ademas puede CAMBIAR DE VISTA para usarla como la ve
 * un gerente o un closer, sin cambiarse el rol en la base (ADR 0025 lo dejaba fuera;
 * este ticket lo enmienda). La vista vive en una cookie, la escribe una server action
 * y la lee `rolDeVista`. Un punto de lectura, uno de escritura.
 */

/** El nombre de la cookie que guarda la vista elegida. Un solo literal, aca. */
export const COOKIE_VISTA = "vista";

/**
 * Las tres vistas posibles. `todo` es la proyeccion mas ancha (el developer ve la
 * union de la interfaz y pasa toda guarda); `gerente` y `closer` estrechan a lo que
 * ve ese rol. Es el valor de la COOKIE, no un rol: `todo` no es un rol de la base.
 */
export const VISTAS = ["todo", "gerente", "closer"] as const;
export type Vista = (typeof VISTAS)[number];

/** La vista por defecto: la mas ancha. Sin cookie, un developer ve todo. */
export const VISTA_POR_DEFECTO: Vista = "todo";

/** `true` si el texto (de la cookie) es una vista valida. */
export function esVistaValida(valor: unknown): valor is Vista {
  return typeof valor === "string" && (VISTAS as readonly string[]).includes(valor);
}

/**
 * Con que rol se proyecta y se guarda la pantalla, dado el rol real de la sesion y la
 * vista elegida (el valor de la cookie, ya leido por quien llama).
 *
 * **La vista solo puede ESTRECHAR, nunca ensanchar.** Si el rol de la sesion no es
 * `developer`, el valor de vista se IGNORA ENTERO y se devuelve el rol real. Por
 * construccion no nace un segundo camino al privilegio: un closer con una cookie de
 * vista `gerente` puesta a mano sigue siendo closer. El unico efecto posible de la
 * vista es que un developer PIERDA acceso, nunca que alguien gane.
 *
 * Para un developer:
 *   - `todo` (por defecto) → `developer`: pasa toda guarda, proyeccion mas ancha.
 *   - `gerente` → `gerente`: guarda y proyeccion de gerente.
 *   - `closer` → `closer`: guarda y proyeccion de closer.
 *
 * El literal `"developer"` NO se escribe en ningun `requireRole` ni `paginaConRol`
 * (ADR 0025): la excepcion sigue viviendo en `esAccesoTotal`. Aca se decide con
 * `esAccesoTotal(rol)`, no comparando el string.
 */
export function proyectarRol(rol: Rol | null, vista: Vista): Rol | null {
  // La vista solo tiene efecto para quien pasa toda guarda (el developer). Cualquier
  // otro rol devuelve su rol real, sin mirar la cookie.
  if (!esAccesoTotal(rol)) return rol;
  if (vista === "gerente") return "gerente";
  if (vista === "closer") return "closer";
  return rol; // vista `todo`: el developer se proyecta como si mismo.
}

/**
 * El rol de vista de una sesion, leyendo la cookie. Es la unica funcion que las
 * paginas y las guardas llaman para saber con que rol proyectar/guardar.
 *
 * Se lee la cookie aca dentro (un solo punto de lectura). La escribe la server action
 * `cambiarVista` en `acciones.ts`.
 */
export async function rolDeVista(session: Session): Promise<Rol | null> {
  const rol = esRolValido(session.user.rol) ? session.user.rol : null;
  // Un no-developer ignora la cookie entero: no hace falta ni leerla.
  if (!esAccesoTotal(rol)) return rol;
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const cruda = store.get(COOKIE_VISTA)?.value;
  const vista = esVistaValida(cruda) ? cruda : VISTA_POR_DEFECTO;
  return proyectarRol(rol, vista);
}

/**
 * La vista actual tal cual esta en la cookie (para pintar el selector). No proyecta
 * nada: solo dice cual esta marcada. Para un no-developer no tiene sentido, pero se
 * devuelve el valor de la cookie igual —el selector solo se le muestra al developer—.
 */
export async function vistaActual(): Promise<Vista> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const cruda = store.get(COOKIE_VISTA)?.value;
  return esVistaValida(cruda) ? cruda : VISTA_POR_DEFECTO;
}
