"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  asociarPrograma,
  crearOVincularPlataforma,
  desasociarPrograma,
} from "@/lib/catalogo/plataformas";
import type { ActorConAcceso } from "@/lib/catalogo/acceso-programa";
import {
  crearEnlacePago,
  desactivarEnlacePago,
  reemplazarEnlacePago,
  type EntradaEnlacePago,
} from "@/lib/catalogo/enlaces-pago";

/**
 * Server actions de la seccion "Plataformas de pago" de la tab Programa (ticket 171).
 *
 * Las plataformas de pago y sus links de cobro se administran AQUI, en la pantalla del
 * objeto Programa (ADR 0077: cada dato vive en la pantalla de su objeto). `/recursos`
 * pasa a mostrarlos en solo lectura, asi que estas acciones son las unicas que escriben
 * una plataforma, su vinculo y sus enlaces de pago.
 *
 * La barrera de rol es de servidor, en cada accion (ADR 0003): `requireRole("gerente",
 * "closer")`. La regla mas fina —un closer solo toca los programas donde tiene membresia
 * activa— la aplica `lib/catalogo/{plataformas,enlaces-pago}` contra la base; que la
 * seccion aparezca para todo el que ve la tab no es la reja (un boton oculto no es
 * seguridad), lo es el 403 de `exigirAccesoAlPrograma`.
 *
 * El actor se arma con `rolDeVista(session)`, NO con `session.user.rol` crudo (ADR 0028):
 * un developer en vista `closer` se acota a sus membresias como un closer real. El `id`
 * sale de la sesion, nunca del input. El resultado es serializable y nunca se lanza al
 * cliente. La pantalla actual se refresca con `router.refresh()`; `revalidatePath` es
 * para las OTRAS rutas cuyo cache quedaria viejo (notablemente `/recursos`, que lista
 * los mismos enlaces).
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[programa/plataformas] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/** Arma el actor desde la sesion ya validada, con el rol de VISTA (ADR 0028). */
async function actorDe(session: Session): Promise<ActorConAcceso> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

/** Las rutas cuyo cache depende de los vinculos y enlaces de este programa. */
function revalidarTodo() {
  revalidatePath("/p/[programa]/programa", "page");
  revalidatePath("/recursos");
}

// ───────────────────────────────────────────────────────────── plataformas

/**
 * Crea una plataforma por nombre libre y la deja servida en el programa, o la vincula si
 * ya existia (ticket 171). Es la via para dar de alta un medio de cobro sin pasar por
 * Ajustes.
 */
export async function crearOVincularPlataformaAccion(
  nombre: string,
  programId: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await crearOVincularPlataforma(db, await actorDe(session), nombre, programId);
    revalidarTodo();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/** Vincula una plataforma ya existente a este programa. Un closer, solo donde vende. */
export async function asociarPlataformaAccion(
  plataformaId: string,
  programId: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await asociarPrograma(db, await actorDe(session), plataformaId, programId);
    revalidarTodo();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/** Quita el vinculo. La plataforma no se toca: deja de salir en ESTE programa. */
export async function desasociarPlataformaAccion(
  plataformaId: string,
  programId: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await desasociarPrograma(db, await actorDe(session), plataformaId, programId);
    revalidarTodo();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

// ─────────────────────────────────────────────────────────── enlaces de pago

export async function crearEnlacePagoAccion(input: EntradaEnlacePago): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await crearEnlacePago(db, await actorDe(session), input);
    revalidarTodo();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reemplazarEnlacePagoAccion(
  id: string,
  nuevaUrl: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await reemplazarEnlacePago(db, await actorDe(session), id, nuevaUrl);
    revalidarTodo();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarEnlacePagoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await desactivarEnlacePago(db, await actorDe(session), id);
    revalidarTodo();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
