"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { crearCreador, crearTipoDePieza, editarCreador, type EntradaNuevoCreador } from "@/lib/media/creadores";
import {
  crearPieza,
  crearLinkFijoDeCreador,
  descartarPieza,
  editarPieza,
  linkDeLaPieza,
  marcarPublicada,
  type ActorDeMedia,
  type EdicionPieza,
  type EntradaLinkFijo,
  type EntradaPieza,
} from "@/lib/media/piezas";
import { desglosarLink } from "@/lib/atribucion/parametros-de-contenido";
import { REDES_DE_CONTENIDO } from "@/lib/media/redes";
import type { EntradaCreador } from "@/lib/catalogo/creadores";

/**
 * Server actions de la pagina de media (tickets 316 y 317, ADR 0107). La barrera de rol es de
 * servidor, en cada accion: `requireRole("media", "gerente")` (el developer pasa por
 * `esAccesoTotal`), y la regla fina —programa en alcance, creador sin programa solo sin alcance
 * limitado— la aplica `lib/media/` contra la base. El actor sale de la sesion y del rol de VISTA
 * (ADR 0028), nunca del input; el programa de una pieza sale de su creador, nunca del input.
 */

/**
 * `link` y `sinLink` solo los llena crear una pieza: el link con su UTM, armado por el servidor
 * (`linkDeLaPieza`, nunca a mano), o el porque no hay (creador sin programa, sin fuente principal).
 */
export type ResultadoAccion = { ok: true; link?: string; desglose?: { nombre: string; valor: string }[]; sinLink?: string } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[media] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

async function actorDe(session: Session): Promise<ActorDeMedia> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

async function ejecutar(fn: (actor: ActorDeMedia) => Promise<unknown>): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("media", "gerente");
    await fn(await actorDe(session));
    revalidatePath("/media");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function crearCreadorAccion(entrada: EntradaNuevoCreador): Promise<ResultadoAccion> {
  return ejecutar((a) => crearCreador(a, entrada, db));
}
export async function editarCreadorAccion(id: string, entrada: EntradaCreador): Promise<ResultadoAccion> {
  return ejecutar((a) => editarCreador(a, id, entrada, db));
}
export async function crearTipoDePiezaAccion(nombre: string): Promise<ResultadoAccion> {
  return ejecutar((a) => crearTipoDePieza(a, nombre, db));
}
export async function crearPiezaAccion(entrada: EntradaPieza): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("media", "gerente");
    const actor = await actorDe(session);
    const id = await crearPieza(actor, entrada, db);
    revalidatePath("/media");
    // La pieza ya existe: si el link no se puede armar (422), se dice por que y no se deshace nada.
    try {
      const link = await linkDeLaPieza(actor, id, db);
      return { ok: true, link, desglose: desglosarLink(link, REDES_DE_CONTENIDO) };
    } catch (error) {
      if (error instanceof ErrorDeApp) return { ok: true, sinLink: error.message };
      throw error;
    }
  } catch (error) {
    return aResultado(error);
  }
}
export async function crearLinkFijoAccion(entrada: EntradaLinkFijo): Promise<ResultadoAccion> {
  return ejecutar((a) => crearLinkFijoDeCreador(a, entrada, db));
}
export async function editarPiezaAccion(id: string, entrada: EdicionPieza): Promise<ResultadoAccion> {
  return ejecutar((a) => editarPieza(a, id, entrada, db));
}
export async function marcarPublicadaAccion(id: string): Promise<ResultadoAccion> {
  return ejecutar((a) => marcarPublicada(a, id, db));
}
export async function descartarPiezaAccion(id: string, motivo: string): Promise<ResultadoAccion> {
  return ejecutar((a) => descartarPieza(a, id, motivo, db));
}
