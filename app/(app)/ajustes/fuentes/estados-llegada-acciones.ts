"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  esquemaEstadoLlegada,
  estadosDeLlegada,
  type EntradaEstadoLlegada,
} from "@/lib/catalogo/estados-llegada";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";

/**
 * Las acciones de los Estados de llegada (ticket 117). Son de quien administra, igual que
 * las fuentes: el rol se enforza aqui, en el servidor, no escondiendo el formulario.
 */

export type ResultadoEstadoLlegadaAccion = { ok: true } | { ok: false; error: string };
const esquemaId = z.string().uuid("Estado de llegada inválido.");

function errorSeguro(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[estados-llegada] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

async function actorAdministrador(): Promise<string> {
  const session = await requireRole("gerente");
  if (!esAdministrador(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
  return session.user.id;
}

async function ejecutar(operacion: (actorId: string) => Promise<unknown>): Promise<ResultadoEstadoLlegadaAccion> {
  try {
    await operacion(await actorAdministrador());
    revalidatePath("/ajustes/salud");
    return { ok: true };
  } catch (error) {
    return errorSeguro(error);
  }
}

export async function crearEstadoLlegadaAccion(input: EntradaEstadoLlegada): Promise<ResultadoEstadoLlegadaAccion> {
  return ejecutar(async (actorId) => {
    const datos = await normalizando(async () => esquemaEstadoLlegada.parse(input));
    await estadosDeLlegada(db).crear(actorId, datos);
  });
}

export async function editarEstadoLlegadaAccion(
  id: string,
  input: EntradaEstadoLlegada,
): Promise<ResultadoEstadoLlegadaAccion> {
  return ejecutar(async (actorId) => {
    const [estadoId, datos] = await normalizando(
      async () => [esquemaId.parse(id), esquemaEstadoLlegada.parse(input)] as const,
    );
    await estadosDeLlegada(db).editar(actorId, estadoId, datos);
  });
}

export async function desactivarEstadoLlegadaAccion(id: string): Promise<ResultadoEstadoLlegadaAccion> {
  return ejecutar(async (actorId) => {
    const estadoId = await normalizando(async () => esquemaId.parse(id));
    await estadosDeLlegada(db).desactivar(actorId, estadoId);
  });
}

export async function reactivarEstadoLlegadaAccion(id: string): Promise<ResultadoEstadoLlegadaAccion> {
  return ejecutar(async (actorId) => {
    const estadoId = await normalizando(async () => esquemaId.parse(id));
    await estadosDeLlegada(db).reactivar(actorId, estadoId);
  });
}
