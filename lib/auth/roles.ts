import { ErrorDeApp } from "@/lib/errors";

/**
 * Logica de roles pura — sin base de datos, sin next-auth.
 * Se testea aislada y la usan tanto el servidor como el proxy.
 */

export const ROLES = ["gerente", "closer"] as const;
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
 * Unica fuente de verdad de "puede o no puede".
 * No hay herencia de roles: gerente no es "closer + extras", son conjuntos distintos.
 * Si un endpoint es de gerente, un closer NO entra, punto.
 */
export function puedeAcceder(rol: Rol | undefined | null, permitidos: readonly Rol[]): boolean {
  if (!rol) return false;
  return permitidos.includes(rol);
}

export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}
