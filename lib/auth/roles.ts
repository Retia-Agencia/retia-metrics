import { ErrorDeApp } from "@/lib/errors";

/**
 * Logica de roles pura — sin base de datos, sin next-auth.
 * Se testea aislada y la usan tanto el servidor como el proxy.
 */

export const ROLES = ["gerente", "closer", "developer"] as const;
export type Rol = (typeof ROLES)[number];

/** Error de autorizacion. Los route handlers lo traducen a 403. */
export class AuthorizationError extends ErrorDeApp {
  constructor(mensaje = "No tienes permiso para ver esto.") {
    super(mensaje, 403);
  }
}

/** Error de autenticacion. Los route handlers lo traducen a 401. */
export class AuthenticationError extends ErrorDeApp {
  constructor(mensaje = "Necesitas iniciar sesion.") {
    super(mensaje, 401);
  }
}

/**
 * `developer` es la unica excepcion a la disjuncion de roles (ADR 0025): tiene
 * acceso total y entra a toda ruta —exclusiva de gerente, exclusiva de closer o
 * compartida—. Vive aca, en el chequeo central, para no repetir "developer" en cada
 * `requireRole`/`paginaConRol`: quien decide por rol pasa por `puedeAcceder`.
 * `gerente` y `closer` siguen disjuntos entre si (ADR 0003).
 */
export function esAccesoTotal(rol: Rol | undefined | null): boolean {
  return rol === "developer";
}

/**
 * Quien administra la app. Es OTRA pregunta que `esAccesoTotal`, aunque hoy el
 * developer responda que si a las dos: "pasa toda guarda" lo cumple solo el
 * developer, mientras que "administra" lo cumplen el gerente y el developer. Por eso
 * son dos funciones y no una (AGENTS.md, enmienda al ADR 0024). La usa la
 * salvaguarda del 015 para no dejar que el ultimo administrador se borre a si mismo.
 */
export function esAdministrador(rol: Rol | undefined | null): boolean {
  return rol === "gerente" || rol === "developer";
}

/**
 * Quien trabaja leads: tiene `closerId` propio, membresias de programa, puede ser
 * responsable de una persona y registrar llamadas y abonos.
 *
 * Es la TERCERA pregunta de esta familia, distinta de las otras dos: un gerente
 * administra pero no registra (ADR 0003), asi que responde `false` aunque responda
 * `true` a `esAdministrador`. El developer responde `true` a las tres, y por eso su
 * excepcion sigue viviendo en UN solo lugar por pregunta y nunca escrita a mano
 * (ADR 0025).
 *
 * Nacio de un hallazgo del recorrido del 18-sep: `/ajustes/usuarios` preguntaba
 * `rol === "closer"` a mano para mostrar el campo `closer_id` y las membresias, asi
 * que **a un developer no se le podian cargar desde la app** y `/mi-dia` lo rechazaba
 * sin salida dentro del producto. Es el criterio del ticket 028, que da por hecho que
 * esta pantalla ya lo permite.
 */
export function trabajaLeads(rol: Rol | undefined | null): boolean {
  return rol === "closer" || rol === "developer";
}

/**
 * Unica fuente de verdad de "puede o no puede".
 * No hay herencia entre gerente y closer: gerente no es "closer + extras", son
 * conjuntos distintos. Si un endpoint es de gerente, un closer NO entra, punto.
 * La sola excepcion es `developer`, que pasa siempre (ADR 0025, `esAccesoTotal`).
 */
export function puedeAcceder(rol: Rol | undefined | null, permitidos: readonly Rol[]): boolean {
  if (!rol) return false;
  if (esAccesoTotal(rol)) return true;
  return permitidos.includes(rol);
}

export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}
