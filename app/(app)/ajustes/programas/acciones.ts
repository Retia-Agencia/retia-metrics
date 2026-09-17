"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearPrograma,
  desactivarPrograma,
  editarPrograma,
  reactivarPrograma,
  type EntradaPrograma,
} from "@/lib/catalogo/programas";
import {
  activarCohorte,
  crearCohorte,
  desactivarCohorte,
  editarCohorte,
  type EntradaCohorte,
} from "@/lib/catalogo/cohortes";

/**
 * Server actions de la administracion de programas y cohortes (ticket 014).
 *
 * Son la unica cara publica: enforzan `requireRole("gerente")` en el servidor
 * (ADR 0003: un closer nunca entra, esconder un boton no es seguridad), envuelven la
 * logica pura de `lib/catalogo/{programas,cohortes}` con la base real, y traducen
 * cualquier error al contrato de lib/errors. El resultado es serializable — nunca se
 * lanza al cliente — porque las server actions se invocan por red y una excepcion no
 * viaja con su tipo (mismo patron que las acciones de catalogos y usuarios).
 *
 * Se revalida `/ajustes/programas` (la lista), la pagina del programa tocado y la
 * raiz `/` para que el sidebar (010), que lee los programas activos de la base,
 * refleje un alta o una baja sin desplegar.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[programas] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/** Revalida las rutas que dependen de la lista de programas (incluido el sidebar). */
function revalidarNav(slug?: string) {
  revalidatePath("/ajustes/programas");
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/ajustes/programas/${slug}`);
}

export async function crearProgramaAccion(input: EntradaPrograma): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await crearPrograma(db, session.user.id, input);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarProgramaAccion(
  id: string,
  input: EntradaPrograma,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await editarPrograma(db, session.user.id, id, input);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarProgramaAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarPrograma(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarProgramaAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await reactivarPrograma(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

// ─────────────────────────────────────────────────────────── cohortes

export async function crearCohorteAccion(
  slug: string,
  input: EntradaCohorte,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await crearCohorte(db, session.user.id, input);
    revalidarNav(slug);
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarCohorteAccion(
  slug: string,
  id: string,
  input: EntradaCohorte,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await editarCohorte(db, session.user.id, id, input);
    revalidarNav(slug);
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function activarCohorteAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await activarCohorte(db, session.user.id, id);
    revalidarNav(slug);
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarCohorteAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarCohorte(db, session.user.id, id);
    revalidarNav(slug);
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
