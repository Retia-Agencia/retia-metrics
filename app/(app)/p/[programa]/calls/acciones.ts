"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { alcanceDeDeals, llamadaVisiblePara } from "@/lib/auth/alcance-deals";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { detalleDeLlamada, type DetalleDeLlamada } from "@/lib/queries/detalle-llamada";
import { visibilidadDeLlamada } from "@/lib/queries/llamadas";
import { marcarConfirmacionMasiva } from "@/lib/deals/llamadas";

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

      const [alcance, visibilidad] = await Promise.all([
        alcanceDeDeals(session),
        visibilidadDeLlamada(db, programa.id, callId),
      ]);
      if (
        !visibilidad ||
        (visibilidad.dealId != null && !llamadaVisiblePara(alcance, visibilidad))
      ) {
        return { ok: false, error: "Esa llamada no existe." };
      }

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

const esquemaConfirmacionMasiva = z.object({
  programaSlug: z.string().min(1, "Programa inválido."),
  callIds: z.array(z.string().uuid("Llamada inválida.")).min(1).max(100),
});

export type ResultadoConfirmacionMasiva =
  | { ok: true; marcadas: number; omitidas: number }
  | { ok: false; error: string };

export async function marcarConfirmacionMasivaAccion(
  entrada: z.input<typeof esquemaConfirmacionMasiva>,
): Promise<ResultadoConfirmacionMasiva> {
  try {
    return await normalizando(async () => {
      const { programaSlug, callIds } = esquemaConfirmacionMasiva.parse(entrada);
      const session = await requireRole("gerente", "closer");
      const rol = await rolDeVista(session);
      if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
      const programa = await programaVisiblePorSlug(session.user.id, rol, programaSlug);
      if (!programa) throw new ErrorDeApp("El programa no existe.", 404);
      const actor = {
        userId: session.user.id,
        rol,
        operaComoCloser: session.user.operaComoCloser,
      };
      const resultado = await marcarConfirmacionMasiva(db, actor, programa.id, callIds);
      return { ok: true as const, ...resultado };
    });
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[confirmacion-masiva] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}
