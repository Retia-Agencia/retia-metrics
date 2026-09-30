"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { areas, esquemaArea, type EntradaArea } from "@/lib/catalogo/areas";
import { canales, esquemaCanal, type EntradaCanal } from "@/lib/catalogo/canales";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";

export type ResultadoCanalAccion = { ok: true } | { ok: false; error: string };
const esquemaId = z.string().uuid("Canal inválido.");
const esquemaIdArea = z.string().uuid("Área inválida.");

function errorSeguro(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[canales] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

async function actorAdministrador(): Promise<string> {
  const session = await requireRole("gerente");
  if (!esAdministrador(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
  return session.user.id;
}

async function ejecutar(operacion: (actorId: string) => Promise<unknown>): Promise<ResultadoCanalAccion> {
  try {
    await operacion(await actorAdministrador());
    revalidatePath("/ajustes/canales");
    return { ok: true };
  } catch (error) {
    return errorSeguro(error);
  }
}

export async function crearCanalAccion(input: EntradaCanal): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const datos = await normalizando(async () => esquemaCanal.parse(input));
    await canales(db).crear(actorId, datos);
  });
}

export async function editarCanalAccion(id: string, input: EntradaCanal): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const [canalId, datos] = await normalizando(async () => [esquemaId.parse(id), esquemaCanal.parse(input)] as const);
    await canales(db).editar(actorId, canalId, datos);
  });
}

export async function desactivarCanalAccion(id: string): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const canalId = await normalizando(async () => esquemaId.parse(id));
    await canales(db).desactivar(actorId, canalId);
  });
}

export async function reactivarCanalAccion(id: string): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const canalId = await normalizando(async () => esquemaId.parse(id));
    await canales(db).reactivar(actorId, canalId);
  });
}

// Las areas se administran aqui porque solo existen para agrupar canales (ADR 0043). Mismo
// molde y misma guarda que los canales; un area no se borra, se desactiva.
export async function crearAreaAccion(input: EntradaArea): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const datos = await normalizando(async () => esquemaArea.parse(input));
    await areas(db).crear(actorId, datos);
  });
}

export async function renombrarAreaAccion(id: string, input: EntradaArea): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const [areaId, datos] = await normalizando(async () => [esquemaIdArea.parse(id), esquemaArea.parse(input)] as const);
    await areas(db).editar(actorId, areaId, datos);
  });
}

export async function desactivarAreaAccion(id: string): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const areaId = await normalizando(async () => esquemaIdArea.parse(id));
    await areas(db).desactivar(actorId, areaId);
  });
}

export async function reactivarAreaAccion(id: string): Promise<ResultadoCanalAccion> {
  return ejecutar(async (actorId) => {
    const areaId = await normalizando(async () => esquemaIdArea.parse(id));
    await areas(db).reactivar(actorId, areaId);
  });
}
