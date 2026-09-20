"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  borrarProductoSiNoSeUso,
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

/**
 * Arma el actor desde la sesion ya validada por `requireRole`.
 *
 * El rol sale de `rolDeVista(session)`, NO de `session.user.rol` crudo (ticket 028):
 * un developer en vista `closer` arma un actor con rol `closer`, asi que
 * `exigirAccesoAlPrograma` en `lib/catalogo/productos` lo acota a sus membresias como
 * a un closer real; en vista `todo`/`gerente` administra todo.
 *
 * NO se unifico con el `actorDe` de `mi-dia/acciones.ts`: contestan la misma pregunta
 * ("¿con que rol actua?") pero devuelven `Actor` DISTINTOS —el de personas lleva
 * `closerId` (ADR 0011), el de productos no lo necesita—, asi que una sola funcion
 * tendria que devolver dos formas. Lo que SI se comparte y era la fuente del bug es la
 * respuesta al rol: ambos la sacan ahora de `rolDeVista`, la definicion central del
 * ticket 028. Consolidar por parecido sintactico dos tipos distintos seria el error
 * opuesto (ADR 0024, enmienda).
 */
async function actorDe(session: Session): Promise<Actor> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

export async function crearProductoAccion(input: EntradaProducto): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await crearProducto(db, await actorDe(session), input);
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
    await editarProducto(db, await actorDe(session), id, input);
    revalidatePath("/productos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarProductoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await desactivarProducto(db, await actorDe(session), id);
    revalidatePath("/productos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarProductoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await reactivarProducto(db, await actorDe(session), id);
    revalidatePath("/productos");
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
 * Borra un producto SOLO si nadie lo uso. Es la unica operacion irreversible de la
 * app, asi que la pantalla pide confirmacion explicita antes de llamarla. Si tiene
 * referencias, no borra: devuelve el conteo para que la pantalla ofrezca desactivar.
 */
export async function borrarProductoAccion(id: string): Promise<ResultadoBorradoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    const res = await borrarProductoSiNoSeUso(db, await actorDe(session), id);
    revalidatePath("/productos");
    return res.borrado
      ? { ok: true, borrado: true }
      : { ok: true, borrado: false, referencias: res.referencias };
  } catch (error) {
    const r = aResultado(error);
    return r.ok ? { ok: true, borrado: true } : r;
  }
}
