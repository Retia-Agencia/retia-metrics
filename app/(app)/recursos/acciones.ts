"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearRecurso,
  desactivarRecurso,
  reemplazarRecurso,
  type EntradaRecurso,
} from "@/lib/catalogo/recursos";
import {
  crearEnlacePago,
  desactivarEnlacePago,
  reemplazarEnlacePago,
  type EntradaEnlacePago,
} from "@/lib/catalogo/enlaces-pago";

/**
 * Server actions de la pantalla `/recursos` (ticket 023, ADR 0017).
 *
 * A diferencia de `/productos` (ADR 0016, ambos roles), administrar recursos y
 * enlaces de pago es SOLO gerente: el ticket lo pide y no hay ningun ADR que lo
 * abra al closer. La barrera es de servidor, en cada accion (ADR 0003): un closer
 * que invoque estas acciones recibe un `ok:false` (403 traducido), no solo un boton
 * escondido. Un boton oculto no es seguridad.
 *
 * Son la unica cara publica de las mutaciones. La logica pura vive en
 * `lib/catalogo/{recursos,enlaces-pago}.ts` (ticket 022): estas acciones no escriben
 * nada nuevo, solo envuelven. El resultado es serializable y nunca se lanza al
 * cliente, porque una server action se invoca por red y una excepcion no viaja con
 * su tipo (mismo patron que las acciones de productos, programas y catalogos).
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[recursos] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

// ─────────────────────────────────────────────────────────────── recursos

export async function crearRecursoAccion(input: EntradaRecurso): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await crearRecurso(db, session.user.id, input);
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
    const session = await requireRole("gerente");
    await reemplazarRecurso(db, session.user.id, id, nuevaUrl);
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarRecursoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarRecurso(db, session.user.id, id);
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

// ─────────────────────────────────────────────────────────── enlaces de pago

export async function crearEnlacePagoAccion(input: EntradaEnlacePago): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await crearEnlacePago(db, session.user.id, input);
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
    const session = await requireRole("gerente");
    await reemplazarEnlacePago(db, session.user.id, id, nuevaUrl);
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarEnlacePagoAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarEnlacePago(db, session.user.id, id);
    revalidatePath("/recursos");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
