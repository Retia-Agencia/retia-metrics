"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { detalleDeLlamada, type DetalleDeLlamada } from "@/lib/queries/detalle-llamada";

export type ResultadoDetalleDeLlamada =
  | { ok: true; detalle: DetalleDeLlamada }
  | { ok: false; error: string };

const esquema = z.object({
  programaSlug: z.string().min(1, "Programa inválido."),
  callId: z.string().uuid("Llamada inválida."),
});

export async function detalleDeLlamadaAccion(
  entrada: z.input<typeof esquema>,
): Promise<ResultadoDetalleDeLlamada> {
  try {
    return await normalizando(async () => {
      const { programaSlug, callId } = esquema.parse(entrada);
      const session = await requireRole("gerente", "closer");
      const rol = await rolDeVista(session);
      const programa = await programaVisiblePorSlug(session.user.id, rol, programaSlug);
      if (!programa) return { ok: false, error: "Esa llamada no existe." };

      const detalle = await detalleDeLlamada(db, programa.id, callId);
      return detalle
        ? { ok: true, detalle }
        : { ok: false, error: "Esa llamada no existe." };
    });
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[detalle-llamada] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}
