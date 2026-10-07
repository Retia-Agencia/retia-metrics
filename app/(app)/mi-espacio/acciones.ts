"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { AuthorizationError, trabajaLeads } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  asignarCalendlyDeMembresia,
  type EntradaCalendlyDeMembresia,
} from "@/lib/catalogo/usuarios";
import {
  abrirNovedadCalendly,
  marcarNovedadCalendlyVista,
} from "@/lib/notificaciones-calendly/notificaciones";

/**
 * Server actions de Mi espacio (ticket 172). Lo único que se edita del propio usuario es
 * la cuenta de Calendly por membresía (nombre, foto, rol y `closer_id` no se tocan aquí).
 *
 * La reja real está en el servidor: `requireSession` ya rechaza TODA escritura cuando la
 * vista está suplantando a un closer (solo lectura, ticket 172), y `trabajaLeads` sobre
 * el ROL DE VISTA decide quién tiene cuenta de Calendly. El objetivo es siempre la propia
 * membresía (el id sale de la sesión), así que no se puede tocar la de otro.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[mi-espacio] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

export async function asignarMiCalendlyAccion(
  input: EntradaCalendlyDeMembresia,
): Promise<ResultadoAccion> {
  try {
    const session = await requireSession();
    const rol = await rolDeVista(session);
    if (!trabajaLeads(rol)) {
      throw new AuthorizationError("Solo quien trabaja leads tiene cuenta de Calendly.");
    }
    await asignarCalendlyDeMembresia(db, session.user.id, input);
    revalidatePath("/mi-espacio");
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

const idNotificacion = z.string().uuid("La notificación no es válida.");
const idPrograma = z.string().uuid("El programa no es válido.");

/** El id objetivo se cruza contra el usuario de la sesión: no se marca la fila de otro. */
export async function marcarNovedadCalendlyVistaAccion(formData: FormData): Promise<void> {
  const session = await requireSession();
  const notificationId = idNotificacion.parse(formData.get("notificationId"));
  const programId = idPrograma.parse(formData.get("programId"));
  await marcarNovedadCalendlyVista(db, { notificationId, programId, userId: session.user.id });
  revalidatePath("/mi-espacio");
}

/** Abre el Deal resuelto desde la fila propia; ninguna ruta llega confiada desde el cliente. */
export async function abrirNovedadCalendlyAccion(formData: FormData): Promise<void> {
  const session = await requireSession();
  const notificationId = idNotificacion.parse(formData.get("notificationId"));
  const destino = await abrirNovedadCalendly(db, { notificationId, userId: session.user.id });
  if (!destino) throw new ErrorDeApp("La notificación no existe o no es tuya.", 404);
  revalidatePath("/mi-espacio");
  redirect(destino);
}
