import type { Session } from "next-auth";
import { esAccesoTotal, esRolValido, type Rol } from "./roles";
import { db as dbDeLaApp } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";

/**
 * "Ver como": con que rol se proyecta y se guarda una pantalla (ticket 028, enmienda
 * al ADR 0025).
 *
 * El problema de fondo que resuelve: la pregunta "¿con que rol pinto esta pantalla?"
 * vivía contestada a mano en `/mi-dia`, `/recursos` y otros catálogos, con tres
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
 * Las vistas de SELECTOR (el radio del menú): `todo` es la proyeccion mas ancha (el
 * developer ve la union de la interfaz y pasa toda guarda); `gerente` y `closer`
 * estrechan a lo que ve ese rol. Es el valor de la COOKIE, no un rol: `todo` no es un
 * rol de la base.
 *
 * La cookie admite ADEMAS un cuarto valor que NO es del selector: `closer:<users.id>`,
 * la **suplantación** de un closer de verdad (ticket 172, enmienda al ADR 0028). No
 * entra en `VISTAS` porque no es una opción fija del radio —se arma con el id del closer
 * elegido— y porque proyectar `closer` a secas y suplantar a un closer concreto son dos
 * cosas distintas: la primera solo estrecha el rol, la segunda cambia TAMBIÉN la
 * identidad (id, closerId, membresías) con la que se leen los datos.
 */
export const VISTAS = ["todo", "gerente", "closer"] as const;
export type Vista = (typeof VISTAS)[number];

/**
 * El prefijo de la cookie cuando el developer suplanta a un closer de verdad: el valor
 * es `closer:<users.id>` (ticket 172). Un solo literal, aca.
 */
export const PREFIJO_SUPLANTACION = "closer:";

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
  // Un no-developer ignora la cookie entero: no hace falta ni leerla. Una sesion ya
  // SUPLANTADA llega aqui con rol `closer` (no es acceso total), asi que cae por este
  // camino y devuelve `closer`, que es exactamente lo que se quiere.
  if (!esAccesoTotal(rol)) return rol;
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const cruda = store.get(COOKIE_VISTA)?.value;
  // Suplantando a un closer de verdad, el rol de vista es `closer`. Se pregunta a
  // `sesionEfectiva`, que valida el id contra `users`: una cookie vieja (id inexistente,
  // inactivo o que no es closer) vuelve a `todo` y no proyecta como closer.
  if (cruda?.startsWith(PREFIJO_SUPLANTACION)) {
    const efectiva = await sesionEfectiva(session);
    if (efectiva.user.suplantadoPor) return "closer";
    return proyectarRol(rol, VISTA_POR_DEFECTO);
  }
  const vista = esVistaValida(cruda) ? cruda : VISTA_POR_DEFECTO;
  return proyectarRol(rol, vista);
}

/** El id del closer suplantado en el valor de la cookie, o `null` si no suplanta. */
export function idSuplantadoDeCookie(cruda: string | undefined): string | null {
  if (!cruda || !cruda.startsWith(PREFIJO_SUPLANTACION)) return null;
  const id = cruda.slice(PREFIJO_SUPLANTACION.length).trim();
  return id.length > 0 ? id : null;
}

/**
 * La SESIÓN EFECTIVA: la que las guardas devuelven y con la que TODA lectura proyecta
 * (ticket 172, enmienda al ADR 0028).
 *
 * Si el rol REAL es acceso total (el developer) y la cookie dice `closer:<id>`, se
 * valida ese id contra `users` EN CADA LECTURA —tiene que existir, estar activo y ser
 * rol `closer`— y se devuelve una sesion cuyo `user.id`, `user.rol` y `user.closerId`
 * son los del closer suplantado, con `user.suplantadoPor` apuntando al developer real.
 * Así toda consulta existente (alcance, deals, llamadas, students) proyecta con ese
 * usuario sin tocar una línea más.
 *
 * Si la cookie es inválida (id inexistente, inactivo o que no es closer) se vuelve a la
 * sesión real: la vista solo ESTRECHA y nunca otorga, y un dato viejo en la cookie no
 * puede dejar al developer atrapado. Un rol que NO es acceso total ignora la cookie
 * entero (un closer real con `closer:<id>` puesto a mano sigue siendo él mismo).
 */
export async function sesionEfectiva(
  session: Session,
  db: Db = dbDeLaApp,
): Promise<Session> {
  const rol = esRolValido(session.user.rol) ? session.user.rol : null;
  if (!esAccesoTotal(rol)) return session;

  const { cookies } = await import("next/headers");
  const store = await cookies();
  const id = idSuplantadoDeCookie(store.get(COOKIE_VISTA)?.value);
  if (!id) return session;

  const [suplantado] = await db
    .select({
      id: users.id,
      rol: users.rol,
      closerId: users.closerId,
      nombre: users.nombre,
      email: users.email,
      activo: users.activo,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  // Inexistente, inactivo o no-closer: la suplantacion no aplica (vuelve a `todo`). El
  // rol se saca a una variable local para preguntar por el valor sin escribir
  // `.rol === "closer"` (lo prohibe el guardian de `rol-de-vista-centralizado`): aqui NO
  // es proyeccion de pantalla, es validar que el suplantado sea de verdad un closer.
  if (!suplantado) return session;
  const rolSuplantado = suplantado.rol;
  if (!suplantado.activo || rolSuplantado !== "closer") return session;

  return {
    ...session,
    user: {
      ...session.user,
      id: suplantado.id,
      rol: "closer",
      closerId: suplantado.closerId,
      suplantadoPor: {
        id: session.user.id,
        nombre: session.user.name ?? session.user.email ?? "Desarrollo",
      },
    },
  };
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
