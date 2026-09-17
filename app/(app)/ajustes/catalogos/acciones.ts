"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
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

function aResultado(error: unknown): ResultadoAccion {
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
