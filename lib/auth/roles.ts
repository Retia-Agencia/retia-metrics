import { ErrorDeApp } from "@/lib/errors";

/**
 * Logica de roles pura — sin base de datos, sin next-auth.
 * Se testea aislada y la usan tanto el servidor como el proxy.
 */

export const ROLES = ["gerente", "closer", "developer", "paid_trafficker"] as const;
export type Rol = (typeof ROLES)[number];

/**
 * Cómo se nombra cada rol en la interfaz y en los mensajes (ticket 177). UNA sola copia:
 * antes estaba duplicada en `user-menu.tsx` y `perfil-de-mi-espacio.tsx`, y el 403 de
 * `requireRole` mostraba el rol crudo ("gerente, paid_trafficker"). Es un `Record<Rol,
 * string>` a propósito: sumar un rol a `ROLES` obliga a nombrarlo aquí (el typecheck lo
 * exige) en vez de dejar que caiga en silencio. Módulo puro, sin base: lo pueden importar
 * los componentes cliente.
 */
export const ETIQUETA_ROL: Record<Rol, string> = {
  gerente: "Gerencia comercial",
  closer: "Closer",
  developer: "Desarrollo",
  paid_trafficker: "Paid Trafficker",
};

/** La etiqueta de un rol para la interfaz y los mensajes de permiso. */
export function etiquetaDeRol(rol: Rol): string {
  return ETIQUETA_ROL[rol];
}

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

/** El dueño de la membresía o quien administra puede cambiarla (ADR 0074). */
export function puedeTocarMembresia(
  rol: Rol | null | undefined,
  actorId: string,
  duenoId: string,
): boolean {
  return esAdministrador(rol) || actorId === duenoId;
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

/**
 * Quien maneja la pauta: ve y configura los Canales y lo de tráfico pagado de sus
 * programas (ADR 0052). Es la CUARTA pregunta de esta familia, distinta de las otras
 * tres: no administra la app (`esAdministrador` responde `false`) y no trabaja leads
 * (`trabajaLeads` responde `false`), porque un paid trafficker no registra llamadas ni
 * abonos ni es dueño de un deal. La cumplen el paid trafficker, el gerente y el
 * developer; el developer responde `true` por ser la excepción de acceso total (ADR
 * 0025), y por eso su excepción sigue viviendo en UN solo lugar por pregunta y nunca
 * escrita a mano. Nunca se compara `rol === "paid_trafficker"` fuera de aquí: la ruta
 * que alguien agregue el mes que viene se olvidaría del gerente y del developer.
 */
export function manejaPauta(rol: Rol | undefined | null): boolean {
  return rol === "paid_trafficker" || rol === "gerente" || rol === "developer";
}

/**
 * Quien ve el trabajo del equipo comercial en el Dashboard: el comparativo entre closers, la
 * comisión, los abiertos por owner, el filtro de closer y las listas de deals, llamadas y abonos
 * detrás de cada cifra. Es la QUINTA pregunta: la cumplen quien administra y quien trabaja leads
 * (gerente, closer y developer). El paid trafficker entra al Dashboard (ADR 0052 enmendado el
 * 29-sep, ticket 102) y ve las cifras, pero no el trabajo de cada closer ni un deal suelto.
 */
export function veEquipoComercial(rol: Rol | undefined | null): boolean {
  return esAdministrador(rol) || trabajaLeads(rol);
}

export function esRolValido(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}
