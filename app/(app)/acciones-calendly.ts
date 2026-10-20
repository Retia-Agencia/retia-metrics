"use server";

import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guards";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { miembrosPrograma } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { asignarEventoDeMembresia } from "@/lib/catalogo/usuarios";
import { eventosDelUsuario, tokenDeCalendlyDelPrograma, type TipoDeEventoCalendly } from "@/lib/calendly/escritura";

async function contexto(membresiaId: string) {
  const session = await requireRole("gerente", "closer");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  const [m] = await db
    .select({ programId: miembrosPrograma.programId, email: miembrosPrograma.calendlyEmail })
    .from(miembrosPrograma)
    .where(and(eq(miembrosPrograma.id, membresiaId), eq(miembrosPrograma.activo, true)));
  if (!m || !(await programaEnAlcance(session.user.id, rol, m.programId, db))) throw new ErrorDeApp("No existe esa membresía activa.", 404);
  return { session, m };
}

export async function eventosDeMembresiaAccion(membresiaId: string): Promise<{ ok: true; eventos: TipoDeEventoCalendly[] } | { ok: false; error: string }> {
  try {
    const { m } = await contexto(membresiaId);
    if (!m.email) throw new ErrorDeApp("Vincula primero la cuenta de Calendly.", 422);
    const token = await tokenDeCalendlyDelPrograma(db, m.programId);
    return { ok: true, eventos: await eventosDelUsuario(token, m.email) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudieron leer los eventos." };
  }
}

export async function asignarEventoDeMembresiaAccion(input: { membresiaId: string; calendlyEventType: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { session } = await contexto(input.membresiaId);
    await asignarEventoDeMembresia(db, session.user.id, input);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar el evento." };
  }
}
