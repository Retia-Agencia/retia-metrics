import { esAdministrador, trabajaLeads, type Rol } from "@/lib/auth/roles";

/**
 * "¿Este actor puede TRABAJAR este deal?": UNA sola respuesta (ADR 0024, AGENTS.md: si dos
 * lugares responden la misma pregunta, la respuesta vive en un modulo).
 *
 * Puede quien administra (`esAdministrador`: gerente y developer, ADR 0025) o el closer
 * que es el DUEÑO del deal. Un deal sin dueño no lo trabaja un closer: primero lo reclama
 * (ticket 070). Nunca `rol === "..."` a mano, o el developer queda afuera.
 *
 * Es solo el PREDICADO. Cada operacion conserva su mensaje ("sin dueño" y "ajeno" dicen
 * cosas distintas a quien las lee) y sus otras rejas (etapa, anulado).
 */
export interface ActorDeDeal {
  userId: string;
  rol: Rol;
}

export function puedeTrabajarDeal(actor: ActorDeDeal, deal: { ownerUserId: string | null }): boolean {
  if (esAdministrador(actor.rol)) return true;
  return trabajaLeads(actor.rol) && deal.ownerUserId != null && deal.ownerUserId === actor.userId;
}
