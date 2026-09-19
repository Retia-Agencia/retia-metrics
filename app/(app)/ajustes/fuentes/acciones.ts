"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  activarFuente,
  crearFuente,
  desactivarFuente,
  editarFuente,
  probarFuente,
  type Actor,
  type EntradaFuente,
} from "@/lib/catalogo/fuentes";
import { editarPlantillaLead, type EntradaPlantillaLead } from "@/lib/catalogo/programas";
import type { ColumnaResuelta } from "@/lib/sheets/probar-fuente";

/**
 * Server actions de la administracion de fuentes (ticket 016, ADR 0019).
 *
 * Son la unica cara publica: enforzan el rol en el SERVIDOR con
 * `requireRole("gerente")`. El developer entra igual porque `puedeAcceder` lo deja
 * pasar (ADR 0025) — nunca se escribe `"developer"` a mano. El actor que se le pasa
 * a la logica lleva el ROL DE VISTA (ticket 028, no `session.user.rol` crudo), y
 * `esAdministrador` (gerente o developer) decide si administra; el id sale SIEMPRE
 * de la sesion, nunca del cuerpo.
 *
 * El resultado es serializable — nunca se lanza al cliente — porque las server
 * actions se invocan por red y una excepcion no viaja con su tipo. Un
 * `MapeoInvalidoError` (422) al activar sale como `{ ok: false, error }` con el
 * mensaje que dice que columna falto, mismo contrato que las demas pantallas.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
export type ResultadoPrueba =
  | { ok: true; columnas: ColumnaResuelta[] }
  | { ok: false; error: string };

function aResultado(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[fuentes] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/**
 * Arma el actor desde la sesion ya validada por `requireRole`. El rol sale de
 * `rolDeVista(session)`, NO de `session.user.rol` crudo (ticket 028): estrechar
 * nunca otorga. Aqui `requireRole("gerente")` ya dejo pasar solo a administradores.
 */
async function actorDe(session: Session): Promise<Actor> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

/** Revalida la pantalla de fuentes tras una escritura. */
function revalidar() {
  revalidatePath("/ajustes/fuentes");
}

export async function crearFuenteAccion(input: EntradaFuente): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await crearFuente(db, await actorDe(session), input);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarFuenteAccion(
  id: string,
  input: EntradaFuente,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await editarFuente(db, await actorDe(session), id, input);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Prueba el mapeo contra la hoja real. No cambia nada en la base; solo lee los
 * encabezados con la cuenta de servicio y devuelve que columna tomo cada campo, o el
 * mensaje del `MapeoInvalidoError`.
 */
export async function probarFuenteAccion(id: string): Promise<ResultadoPrueba> {
  try {
    const session = await requireRole("gerente");
    const { columnas } = await probarFuente(db, await actorDe(session), id);
    return { ok: true, columnas };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Activa una fuente CORRIENDO la prueba en ese momento (ticket 016 punto 5). Si el
 * mapeo no cuadra, devuelve el error y la fuente queda inactiva.
 */
export async function activarFuenteAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await activarFuente(db, await actorDe(session), id);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarFuenteAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarFuente(db, await actorDe(session), id);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Edita la plantilla de lead del programa (ADR 0019). Vive en esta pantalla porque
 * la plantilla y las fuentes del programa se razonan juntas: una fuente solo ajusta
 * lo que la plantilla ya define.
 */
export async function editarPlantillaLeadAccion(
  programId: string,
  plantilla: EntradaPlantillaLead,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await editarPlantillaLead(db, session.user.id, programId, plantilla);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
