"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  borrarRecursoSiNoSeUso,
  crearRecurso,
  desactivarRecurso,
  reemplazarRecurso,
  type Actor,
  type EntradaRecurso,
} from "@/lib/catalogo/recursos";

/**
 * Server actions de la pantalla `/recursos` (ticket 023, ADR 0017; enmiendas del
 * 19-sep y del ticket 171).
 *
 * Administrar recursos lo pueden hacer gerente Y closer. La barrera de rol es de
 * servidor, en cada accion (ADR 0003): pasa por `requireRole("gerente","closer")`, y la
 * regla mas fina —un closer solo toca sus programas, y NUNCA un recurso global— la
 * aplica `lib/catalogo/recursos` contra la base. Un boton oculto no es seguridad.
 *
 * Los enlaces de pago y las plataformas YA NO se administran aqui (ticket 171, ADR 0077):
 * viven en la seccion "Plataformas de pago" de la tab Programa, y sus acciones estan en
 * `app/(app)/p/[programa]/programa/acciones.ts`. `/recursos` solo los LISTA en lectura.
 *
 * El actor se arma con `rolDeVista(session)`, NO con `session.user.rol` crudo
 * (ADR 0028): un developer en vista `closer` se acota a sus membresias como un closer
 * real; en vista `gerente`/`todo` administra todo. El `id` sale de la sesion, nunca
 * del input.
 *
 * Son la unica cara publica de las mutaciones. La logica pura vive en `lib/catalogo/`
 * (ticket 022): estas acciones no escriben nada nuevo, solo envuelven. El resultado
 * es serializable y nunca se lanza al cliente.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[recursos] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/** Arma el actor desde la sesion ya validada, con el rol de VISTA (ADR 0028). */
async function actorDe(session: Session): Promise<Actor> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

// ─────────────────────────────────────────────────────────────── recursos

export async function crearRecursoAccion(input: EntradaRecurso): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await crearRecurso(db, await actorDe(session), input);
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reemplazarRecursoAccion(
  id: string,
  nuevaUrl: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await reemplazarRecurso(db, await actorDe(session), id, nuevaUrl);
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarRecursoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await desactivarRecurso(db, await actorDe(session), id);
    revalidatePath("/recursos");
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
 * Borra un recurso SOLO si nadie lo uso. Es irreversible, asi que la pantalla pide
 * confirmacion explicita antes de llamarla. Un recurso con historial (otro recurso lo
 * reemplazo) no se borra: devuelve el conteo para que la pantalla ofrezca desactivar.
 * El acceso al programa lo sigue enforzando `lib/catalogo/recursos`, no la pantalla.
 */
export async function borrarRecursoAccion(id: string): Promise<ResultadoBorradoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    const res = await borrarRecursoSiNoSeUso(db, await actorDe(session), id);
    revalidatePath("/recursos");
    return res.borrado
      ? { ok: true, borrado: true }
      : { ok: true, borrado: false, referencias: res.referencias };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[recursos] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}
