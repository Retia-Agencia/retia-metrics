"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esRolValido } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { guardarUmbral, type EntradaUmbral } from "@/lib/catalogo/umbrales";

/**
 * La acción de la sección "Alertas por persistencia" de Programa › Ventas (ticket 147). La reja es
 * del servidor: `requireRole` y, adentro de `guardarUmbral`, que el rol de VISTA administre
 * (ADR 0028). El actor sale de la sesión, nunca del input. La pantalla se refresca con
 * `router.refresh()`; aquí solo se invalida el dashboard, que pinta las alertas.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

export async function guardarUmbralAccion(input: EntradaUmbral & { activo: boolean }): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente", "closer");
    const rol = await rolDeVista(session);
    if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
    await guardarUmbral(db, { id: session.user.id, rol }, input);
    revalidatePath("/p/[programa]/dashboard", "page");
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[programa/umbrales] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}
