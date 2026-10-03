"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programaEnAlcance, programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { leadContactos } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { confirmarCorreo, esquemaContacto, separarCorreo } from "@/lib/ingesta/separar";
import { buscarLeads, type LeadEncontrado } from "@/lib/queries/leads";

/**
 * Server actions de la tab Leads (ticket 072): confirmar o separar un correo que entró por
 * teléfono. Mismo patrón que las acciones de la ficha del deal:
 *
 * - `requireRole("gerente", "closer")` es el acceso a la acción (el developer pasa por
 *   `esAccesoTotal`). QUIÉN puede tocar ESTE contacto lo decide `lib/ingesta/separar.ts`
 *   (`exigirAccesoAlPrograma`): esconder un botón no es seguridad.
 * - 🔒 El actor sale de la sesión (id y rol de VISTA), nunca del input.
 * - Un contacto de un programa fuera del alcance de la sesión responde 404, como si no existiera
 *   (ADR 0048). La pantalla se refresca en el cliente con `router.refresh()`.
 */

export type ResultadoLeads = { ok: true } | { ok: false; error: string };
export type ResultadoBusquedaLeads =
  | { ok: true; leads: LeadEncontrado[] }
  | { ok: false; error: string };

const esquemaBusqueda = z.object({
  programaSlug: z.string().min(1, "Programa inválido."),
  texto: z.string(),
});

export async function buscarLeadsAccion(entrada: {
  programaSlug: string;
  texto: string;
}): Promise<ResultadoBusquedaLeads> {
  try {
    return await normalizando(async () => {
      const datos = esquemaBusqueda.parse(entrada);
      const session = await requireRole("gerente", "closer");
      const rol = await rolDeVista(session);
      const programa = await programaVisiblePorSlug(session.user.id, rol, datos.programaSlug);
      if (!programa) return { ok: false, error: "Ese programa no existe." };
      return { ok: true, leads: await buscarLeads(db, programa.id, datos.texto) };
    });
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[buscarLeads] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}

async function correr(entrada: unknown, accion: "confirmar" | "separar"): Promise<ResultadoLeads> {
  const session = await requireRole("gerente", "closer");
  try {
    await normalizando(async () => {
      const rol = await rolDeVista(session);
      if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
      const datos = esquemaContacto.parse(entrada);
      const [c] = await db
        .select({ programId: leadContactos.programId })
        .from(leadContactos)
        .where(eq(leadContactos.id, datos.contactoId));
      if (!c || !(await programaEnAlcance(session.user.id, rol, c.programId, db))) {
        throw new ErrorDeApp("No existe ese contacto.", 404);
      }
      const actor = { id: session.user.id, rol };
      if (accion === "confirmar") await confirmarCorreo(db, actor, datos);
      else await separarCorreo(db, actor, datos);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[leads] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}

export async function confirmarCorreoAccion(entrada: { contactoId: string }): Promise<ResultadoLeads> {
  return correr(entrada, "confirmar");
}

export async function separarCorreoAccion(entrada: { contactoId: string }): Promise<ResultadoLeads> {
  return correr(entrada, "separar");
}
