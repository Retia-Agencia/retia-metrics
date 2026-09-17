"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearUsuario,
  desactivarUsuario,
  editarUsuario,
  reactivarUsuario,
  type EntradaUsuario,
} from "@/lib/catalogo/usuarios";

/**
 * Server actions de la pantalla `/ajustes/usuarios` (ticket 015).
 *
 * Son la unica cara publica: enforzan `requireRole("gerente")` en el servidor
 * (ADR 0003: un closer nunca entra, esconder un boton no es seguridad), envuelven
 * la logica pura de `lib/catalogo/usuarios` con la base real de la app, y traducen
 * cualquier error al contrato de lib/errors. El resultado es serializable — nunca
 * se lanza al cliente — porque las server actions se invocan por red y una
 * excepcion no viaja con su tipo (mismo patron que las acciones de catalogos).
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[usuarios] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

export async function crearUsuarioAccion(input: EntradaUsuario): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await crearUsuario(db, session.user.id, input);
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarUsuarioAccion(
  id: string,
  input: EntradaUsuario,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await editarUsuario(db, session.user.id, id, input);
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarUsuarioAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarUsuario(db, session.user.id, id);
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarUsuarioAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await reactivarUsuario(db, session.user.id, id);
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
