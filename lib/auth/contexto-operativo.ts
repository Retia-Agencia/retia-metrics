import type { Session } from "next-auth";
import type { Rol } from "./roles";
import { esAdministrador, esRolValido } from "./roles";
import type { AlcanceInbox } from "@/lib/queries/inbox";

export interface ActorOperativo {
  userId: string;
  rol: Rol;
  operaComoCloser: boolean;
}

/** La identidad efectiva con la que páginas y MCP proyectan la operación. */
export function actorOperativo(session: Session, rol: Rol | null): ActorOperativo | null {
  if (!esRolValido(rol)) return null;
  return { userId: session.user.id, rol, operaComoCloser: session.user.operaComoCloser };
}

/** Un administrador ve el equipo; los demás ven sus propios deals. */
export function alcanceDeInbox(session: Session, rol: Rol | null): AlcanceInbox {
  return esAdministrador(rol) ? "equipo" : { ownerUserId: session.user.id };
}
