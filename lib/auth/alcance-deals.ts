import type { Session } from "next-auth";
import { esAdministrador } from "./roles";
import { rolDeVista } from "./vista";

/** El alcance operativo de las listas de deals (ADR 0075), imposible de omitir. */
export type AlcanceDeals = { tipo: "todos" } | { tipo: "dueno"; userId: string };

export async function alcanceDeDeals(session: Session): Promise<AlcanceDeals> {
  const rol = await rolDeVista(session);
  return esAdministrador(rol)
    ? { tipo: "todos" }
    : { tipo: "dueno", userId: session.user.id };
}

/** La ficha sin dueño se puede abrir para reclamarla; la de otra persona, no. */
export function dealVisiblePara(alcance: AlcanceDeals, ownerUserId: string | null): boolean {
  return alcance.tipo === "todos" || ownerUserId == null || ownerUserId === alcance.userId;
}

export function llamadaVisiblePara(
  alcance: AlcanceDeals,
  llamada: { ownerUserId: string | null; closerUserId: string | null },
): boolean {
  return (
    alcance.tipo === "todos" ||
    llamada.ownerUserId === alcance.userId ||
    llamada.closerUserId === alcance.userId
  );
}
