"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  crearRecurso,
  desactivarRecurso,
  reemplazarRecurso,
  type Actor,
  type EntradaRecurso,
} from "@/lib/catalogo/recursos";
import {
  crearEnlacePago,
  desactivarEnlacePago,
  reemplazarEnlacePago,
  type EntradaEnlacePago,
} from "@/lib/catalogo/enlaces-pago";

/**
 * Server actions de la pantalla `/recursos` (ticket 023, ADR 0017; enmienda del
 * 19-sep).
 *
 * Igual que `/productos` (ADR 0016), administrar recursos y enlaces de pago lo pueden
 * hacer gerente Y closer: el closer se topa primero con "necesito el link que no
 * esta". La barrera de rol es de servidor, en cada accion (ADR 0003): pasa por
 * `requireRole("gerente","closer")`, y la regla mas fina —un closer solo toca sus
 * programas, y NUNCA un recurso global— la aplica `lib/catalogo/{recursos,enlaces-pago}`
 * contra la base. Un boton oculto no es seguridad.
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

// ─────────────────────────────────────────────────────────── enlaces de pago

export async function crearEnlacePagoAccion(input: EntradaEnlacePago): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await crearEnlacePago(db, await actorDe(session), input);
    revalidatePath("/recursos");
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
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarEnlacePagoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    await desactivarEnlacePago(db, await actorDe(session), id);
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
