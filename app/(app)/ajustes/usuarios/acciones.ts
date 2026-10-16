"use server";

import { revalidatePath } from "next/cache";
import { requireAdministracionGlobal } from "@/lib/auth/guards";
import { esAccesoTotal } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  asignarCalendlyDeMembresia,
  crearUsuario,
  desactivarUsuario,
  editarUsuario,
  reactivarUsuario,
  guardarAlcanceDeUsuario,
  type EntradaCalendlyDeMembresia,
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

function revalidar() {
  revalidatePath("/ajustes/usuarios");
  revalidatePath("/p/[programa]/programa", "page");
}

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[usuarios] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

export async function crearUsuarioAccion(input: EntradaUsuario): Promise<ResultadoAccion> {
  try {
    const session = await requireAdministracionGlobal();
    await crearUsuario(db, session.user.id, input);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarUsuarioAccion(
  id: string,
  input: EntradaUsuario,
  programasQueVe?: readonly string[] | null,
): Promise<ResultadoAccion> {
  try {
    const session = await requireAdministracionGlobal();
    const rol = programasQueVe !== undefined ? await rolDeVista(session) : null;
    if (programasQueVe !== undefined && !esAccesoTotal(rol)) {
      throw new ErrorDeApp("No autorizado.", 403);
    }
    await editarUsuario(db, session.user.id, id, input);
    if (programasQueVe !== undefined) {
      await guardarAlcanceDeUsuario(db, { id: session.user.id, rol }, id, programasQueVe);
    }
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarUsuarioAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireAdministracionGlobal();
    await desactivarUsuario(db, session.user.id, id);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarUsuarioAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireAdministracionGlobal();
    await reactivarUsuario(db, session.user.id, id);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Vincula la cuenta de Calendly de una membresia (ticket 096). Solo administrador: esa
 * cuenta decide de quien es un deal. La lista de cuentas validas la vuelve a pedir el
 * servidor a Calendly; lo que mande el cliente no se cree.
 */
export async function asignarCalendlyDeMembresiaAccion(
  input: EntradaCalendlyDeMembresia,
): Promise<ResultadoAccion> {
  try {
    const session = await requireAdministracionGlobal();
    await asignarCalendlyDeMembresia(db, session.user.id, input);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
