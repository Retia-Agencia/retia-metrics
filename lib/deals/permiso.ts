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

/**
 * "¿Este actor puede DECIDIR un posible duplicado (confirmar o separar)?" (ticket 186, ADR 0075):
 * el dueño del deal abierto del lead, o quien administra (`esAdministrador`: gerente y developer,
 * ADR 0025). Si el lead no tiene deal abierto o su deal no tiene dueño, decide solo quien
 * administra: el closer primero reclama el deal en el Inbox.
 *
 * `duenoDelDealAbierto` es el `ownerUserId` del único deal abierto del lead, o `null` si no hay
 * deal abierto o no tiene dueño. Nunca `rol === "..."` a mano, o el developer queda afuera.
 */
export function puedeDecidirDuplicado(
  actor: { id: string; rol: Rol },
  duenoDelDealAbierto: string | null,
): boolean {
  if (esAdministrador(actor.rol)) return true;
  return duenoDelDealAbierto != null && duenoDelDealAbierto === actor.id;
}
