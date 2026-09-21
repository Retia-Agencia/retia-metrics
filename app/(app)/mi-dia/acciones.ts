"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearPersonaManual,
  type Actor,
  type EntradaPersonaManual,
} from "@/lib/mutations/personas";

/**
 * Server actions de la pantalla `/mi-dia` (ticket 003, ADR 0003, 0011, 0015, 0021).
 *
 * Toda accion enforza `requireRole("closer")` en el servidor: `/mi-dia` es del
 * closer y el gerente NO registra (ADR 0003). La barrera es de servidor, no de UI
 * (esconder un boton no es seguridad).
 *
 * ⚠️ De este archivo solo queda el alta manual. El registro de llamada, la venta y
 * el abono se fueron con `sales` (ticket 038): en el modelo nuevo registrar una
 * venta es crear o mover un DEAL, y mover una etapa solo puede hacerse por
 * `moverEtapa()`, que nace en la etapa 2. Renacen en la etapa 4 sobre el motor.
 *
 * Se traduce cualquier error al contrato de `lib/errors`: el resultado es
 * serializable y nunca se lanza al cliente, porque una server action se invoca por
 * red y una excepcion no viaja con su tipo (mismo patron que `productos/acciones.ts`).
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
/**
 * El alta manual dice ademas si CREO la persona o si el correo ya existia. El error
 * es la misma forma que `ResultadoAccion`, asi que `aResultado` sirve sin cambios.
 */
export type ResultadoAlta = { ok: true; creada: boolean } | { ok: false; error: string };
function aResultado(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  if (error instanceof ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Petición inválida." };
  }
  console.error("[mi-dia] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/**
 * Arma el actor de las mutaciones de personas desde la sesion ya validada.
 *
 * El rol del actor sale de `rolDeVista`, NO de `session.user.rol` (ticket 028): un
 * developer en vista `closer` ES un closer para la capa de mutaciones —crea persona,
 * la toma, registra— y en vista `gerente` vuelve a tener prohibido registrar
 * (ADR 0003), porque `requireRole("closer")` ya lo habria rechazado antes de llegar
 * aca. El `closerId` sigue saliendo de la sesion (ADR 0011): la vista no lo inventa.
 */
async function actorDe(session: Session): Promise<Actor> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol, closerId: session.user.closerId };
}

/**
 * Crea a mano una persona que no paso por el formulario (WhatsApp, masivos).
 *
 * Devuelve `creada` para que la pantalla NO confirme un alta que no ocurrio: si el
 * correo ya existia en ese programa, el dedup devuelve la fila de siempre sin tocar
 * nada, y decir "Persona creada" ahi haria creer al closer que su nombre se guardo.
 */
export async function crearPersonaAccion(
  input: EntradaPersonaManual,
): Promise<ResultadoAlta> {
  try {
    const session = await requireRole("closer");
    const { creada } = await crearPersonaManual(db, await actorDe(session), input);
    revalidatePath("/mi-dia");
    return { ok: true, creada };
  } catch (error) {
    return aResultado(error);
  }
}
