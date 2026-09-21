"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import type { ActorConAcceso } from "@/lib/catalogo/acceso-programa";
import {
  asociarPrograma,
  crearPlataformaConProgramas,
  desasociarPrograma,
} from "@/lib/catalogo/plataformas";
import {
  borrarItemSiNoSeUso,
  crearItem,
  desactivarItem,
  reactivarItem,
  renombrarItem,
} from "@/lib/catalogo/operaciones";

/**
 * Server actions de la pantalla de catalogos (ticket 013).
 *
 * Son la unica cara publica: envuelven la logica pura de `lib/catalogo/operaciones`
 * con la base real de la app y traducen cualquier error al contrato de lib/errors.
 * Un `ErrorDeApp` (rol, validacion, duplicado) sale con su mensaje; cualquier otra
 * cosa sale como "Error interno." y se registra en el servidor, sin filtrar nada
 * del driver de Neon (misma politica que `respuestaDeError`). El resultado es un
 * objeto serializable — nunca se lanza al cliente — porque las server actions se
 * invocan por red y una excepcion no viaja con su tipo.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[catalogos] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

export async function agregarAccion(
  slug: string,
  nombre: string,
): Promise<ResultadoAccion> {
  try {
    await crearItem(db, slug, { nombre });
    revalidatePath("/ajustes/catalogos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function renombrarAccion(
  slug: string,
  id: string,
  nombre: string,
): Promise<ResultadoAccion> {
  try {
    await renombrarItem(db, slug, id, { nombre });
    revalidatePath("/ajustes/catalogos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    await desactivarItem(db, slug, id);
    revalidatePath("/ajustes/catalogos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    await reactivarItem(db, slug, id);
    revalidatePath("/ajustes/catalogos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Resultado del borrado: la pantalla lo usa para elegir el VERBO (ADR 0026 punto 5).
 * `borrado: true` → se borro de verdad; `borrado: false` con `referencias` → NO se
 * borro (hay que desactivar) y se dice cuantas lo referencian. Nunca se dice "borrado"
 * habiendo desactivado.
 */
export type ResultadoBorradoAccion =
  | { ok: true; borrado: true }
  | { ok: true; borrado: false; referencias: number }
  | { ok: false; error: string };

/**
 * Borra un item del catalogo SOLO si nadie lo uso. Es la unica operacion irreversible
 * de la pantalla, asi que pide confirmacion explicita antes de llamarla. Si tiene
 * referencias no borra: devuelve el conteo para que la pantalla ofrezca desactivar.
 */
export async function borrarAccion(slug: string, id: string): Promise<ResultadoBorradoAccion> {
  try {
    const res = await borrarItemSiNoSeUso(db, slug, id);
    revalidatePath("/ajustes/catalogos");
    return res.borrado
      ? { ok: true, borrado: true }
      : { ok: true, borrado: false, referencias: res.referencias };
  } catch (error) {
    return aResultado(error);
  }
}


// ─────────────────────── plataformas de pago y sus programas (ADR 0034)

/**
 * Arma el actor desde la sesion ya validada, con el rol de VISTA (ADR 0028): un
 * developer en vista `closer` se acota a sus membresias como un closer real. El id
 * sale de la sesion, nunca del input.
 */
async function actorDe(session: Session): Promise<ActorConAcceso> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

/**
 * Crea una plataforma de pago y la asocia a sus programas en una sola operacion.
 *
 * Es la UNICA accion de esta pantalla que un closer puede disparar sobre el catalogo
 * (decision de Mani, 20-sep): crear y vincular a SUS programas. Renombrar, desactivar
 * y borrar siguen pasando por `requireRole("gerente")`, que ya incluye al developer.
 */
export async function crearPlataformaAccion(
  nombre: string,
  programIds: readonly string[],
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await crearPlataformaConProgramas(db, await actorDe(session), { nombre }, programIds);
    revalidatePath("/ajustes/catalogos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/** Asocia una plataforma a un programa. Un closer, solo donde vende. */
export async function asociarProgramaAccion(
  plataformaId: string,
  programId: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await asociarPrograma(db, await actorDe(session), plataformaId, programId);
    revalidatePath("/ajustes/catalogos");
    // El selector de plataformas de estas dos pantallas cambia con el vinculo, asi que
    // su cache de ruta queda vieja. La pantalla actual la refresca `router.refresh()`;
    // `revalidatePath` es para LAS OTRAS.
    revalidatePath("/recursos");
    revalidatePath("/mi-dia");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/** Quita el vinculo. La plataforma no se toca: deja de salir en ESE programa. */
export async function desasociarProgramaAccion(
  plataformaId: string,
  programId: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await desasociarPrograma(db, await actorDe(session), plataformaId, programId);
    revalidatePath("/ajustes/catalogos");
    revalidatePath("/recursos");
    revalidatePath("/mi-dia");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
