"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { areas, esquemaArea, type EntradaArea } from "@/lib/catalogo/areas";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";

/**
 * Las áreas de origen (ADR 0043): filas editables que agrupan canales. Las administra
 * quien ADMINISTRA (gerente y developer), no quien maneja pauta: un área toca el
 * rendimiento por área y la ficha de origen, no solo la pauta. Por eso tienen su propia
 * pantalla (`/ajustes/areas`) y su propia guarda, separadas de Canales (ticket 173).
 *
 * `requireRole("gerente")` admite al developer por `puedeAcceder` (ADR 0025), y
 * `esAdministrador` sobre el ROL DE VISTA cierra la vista `closer` —nunca se compara
 * `rol === "..."` a mano—. Vale aunque el botón no aparezca: la acción se puede forjar.
 */
export type ResultadoAreaAccion = { ok: true } | { ok: false; error: string };
const esquemaIdArea = z.string().uuid("Área inválida.");

function errorSeguro(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[areas] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

async function actorAdministrador(): Promise<string> {
  const session = await requireRole("gerente");
  if (!esAdministrador(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
  return session.user.id;
}

async function ejecutar(operacion: (actorId: string) => Promise<unknown>): Promise<ResultadoAreaAccion> {
  try {
    await operacion(await actorAdministrador());
    revalidatePath("/ajustes/areas");
    return { ok: true };
  } catch (error) {
    return errorSeguro(error);
  }
}

export async function crearAreaAccion(input: EntradaArea): Promise<ResultadoAreaAccion> {
  return ejecutar(async (actorId) => {
    const datos = await normalizando(async () => esquemaArea.parse(input));
    await areas(db).crear(actorId, datos);
  });
}

export async function renombrarAreaAccion(id: string, input: EntradaArea): Promise<ResultadoAreaAccion> {
  return ejecutar(async (actorId) => {
    const [areaId, datos] = await normalizando(async () => [esquemaIdArea.parse(id), esquemaArea.parse(input)] as const);
    await areas(db).editar(actorId, areaId, datos);
  });
}

export async function desactivarAreaAccion(id: string): Promise<ResultadoAreaAccion> {
  return ejecutar(async (actorId) => {
    const areaId = await normalizando(async () => esquemaIdArea.parse(id));
    await areas(db).desactivar(actorId, areaId);
  });
}

export async function reactivarAreaAccion(id: string): Promise<ResultadoAreaAccion> {
  return ejecutar(async (actorId) => {
    const areaId = await normalizando(async () => esquemaIdArea.parse(id));
    await areas(db).reactivar(actorId, areaId);
  });
}
