"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { esRolValido } from "@/lib/auth/roles";
import {
  crearProducto,
  desactivarProducto,
  editarProducto,
  reactivarProducto,
  type Actor,
  type EntradaProducto,
} from "@/lib/catalogo/productos";

/**
 * Server actions de la pantalla `/productos` (ticket 017, ADR 0016).
 *
 * Son la unica cara publica: enforzan `requireRole("gerente","closer")` en el
 * servidor (ADR 0003: la barrera de rol es de servidor, no de UI; aqui la ruta
 * declara los dos roles porque ambos administran productos). La regla mas fina —un
 * closer solo toca productos de sus programas— la aplica `lib/catalogo/productos`
 * contra la base, no esta capa. Se traduce cualquier error al contrato de
 * lib/errors: el resultado es serializable, nunca se lanza al cliente, porque una
 * server action se invoca por red y una excepcion no viaja con su tipo (mismo
 * patron que las acciones de programas, catalogos y usuarios).
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[productos] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/** Arma el actor desde la sesion ya validada por `requireRole`. */
function actorDe(session: { user: { id: string; rol: string | null } }): Actor {
  const rol = session.user.rol;
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

export async function crearProductoAccion(input: EntradaProducto): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await crearProducto(db, actorDe(session), input);
    revalidatePath("/productos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarProductoAccion(
  id: string,
  input: EntradaProducto,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await editarProducto(db, actorDe(session), id, input);
    revalidatePath("/productos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarProductoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await desactivarProducto(db, actorDe(session), id);
    revalidatePath("/productos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarProductoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await reactivarProducto(db, actorDe(session), id);
    revalidatePath("/productos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
