import { and, eq, isNull } from "drizzle-orm";
import { calls } from "@/lib/db/schema";
import { esAdministrador, trabajaLeads, type Rol } from "@/lib/auth/roles";

/**
 * ¿Esta llamada sin deal se asigna a mano? Solo si la trajo Calendly (ADR 0049; Mani, 30-sep).
 *
 * La suelta es la cita que el emparejador no pudo colgar SIN DUDA, y un closer la cuelga desde
 * el Inbox o desde Calls. Las llamadas de la hoja que la migracion no pudo colgar (078) tambien
 * quedan sin deal, pero son historia, no trabajo del dia: ya son rareza `llamada_sin_deal` en
 * `/ajustes/migracion`, y en el Inbox taparian las citas de verdad (~390 al 30-sep). Colgar una
 * de ellas a mano ademas la pegaria a un deal vivo, que el ADR 0059 punto 3 prohibe.
 *
 * Tres lugares hacen esta pregunta (el Inbox, Calls y la accion de asignar), asi que la
 * respuesta vive aqui y los tres la importan.
 */
export const ORIGEN_DE_SUELTA_ASIGNABLE = "calendly";

/** El predicado SQL: sin deal y de Calendly. No incluye la vigencia: esa la decide quien lee. */
export function sueltaPorAsignar() {
  return and(isNull(calls.dealId), eq(calls.origen, ORIGEN_DE_SUELTA_ASIGNABLE));
}

/** El mismo predicado sobre una fila ya leida. */
export function esSueltaPorAsignar(llamada: { dealId: string | null; origen: string }): boolean {
  return llamada.dealId == null && llamada.origen === ORIGEN_DE_SUELTA_ASIGNABLE;
}

/** Solo la host de Calendly, o quien administra, puede colgar una llamada suelta. */
export function puedeColgarSuelta(args: {
  actorUserId: string;
  rol: Rol | null;
  hostUserId: string | null;
}): boolean {
  return esAdministrador(args.rol) || (trabajaLeads(args.rol) && args.hostUserId === args.actorUserId);
}
