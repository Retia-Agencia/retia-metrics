import { esAdministrador, marcaOnboarding, trabajaLeads, type Rol } from "@/lib/auth/roles";

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
 * "¿Este actor puede MARCAR o DESMARCAR el onboarding de este estudiante?" (ticket 145):
 * UNA sola respuesta, separada de `puedeTrabajarDeal` porque el customer success SOLO
 * puede esto, no trabajar el deal.
 *
 * Puede quien ya puede trabajar el deal (dueño o administrador, `puedeTrabajarDeal`), O
 * quien `marcaOnboarding` sin administrar ni trabajar leads (hoy el `customer_success`)
 * y tiene una membresía ACTIVA en el programa del deal. La membresía la resuelve el
 * llamador contra la base (`tieneMembresiaActiva`) y aquí se decide por CAPACIDAD, nunca
 * con `rol === "customer_success"` a mano (ADR 0025): el closer y el gerente ya pasan por
 * `puedeTrabajarDeal` con su propia reja (dueño/administrador), y el developer responde
 * `true` a `marcaOnboarding` por acceso total pero también a `esAdministrador`, así que
 * entra por la primera rama. La segunda rama queda, por construcción, solo para el rol que
 * `marcaOnboarding` y NO es ni administrador ni trabaja leads.
 *
 * Es solo el PREDICADO: la etapa, el anulado y los demás mensajes los conserva cada
 * operación de onboarding. Se usa ÚNICAMENTE en las dos funciones de onboarding; el cambio
 * de cohorte sigue con `puedeTrabajarDeal`.
 */
export function puedeMarcarOnboarding(
  actor: ActorDeDeal,
  deal: { ownerUserId: string | null },
  tieneMembresiaActiva: boolean,
): boolean {
  if (puedeTrabajarDeal(actor, deal)) return true;
  if (esAdministrador(actor.rol) || trabajaLeads(actor.rol)) return false;
  return marcaOnboarding(actor.rol) && tieneMembresiaActiva;
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
