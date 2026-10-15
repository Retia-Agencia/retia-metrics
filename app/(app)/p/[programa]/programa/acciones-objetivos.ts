"use server";

import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  borrarObjetivo,
  copiarObjetivos,
  crearObjetivo,
  editarObjetivo,
  type EntradaObjetivo,
} from "@/lib/catalogo/objetivos";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";

export type ResultadoAccionObjetivo = { ok: true } | { ok: false; error: string };

async function actorDeLaSesion() {
  const session = await requireRole("gerente", "closer", "paid_trafficker");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

async function responder(fn: () => Promise<unknown>): Promise<ResultadoAccionObjetivo> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    console.error("[programa/objetivos] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}

export async function guardarObjetivoAccion(
  input: EntradaObjetivo & { id?: string },
): Promise<ResultadoAccionObjetivo> {
  return responder(async () => {
    const actor = await actorDeLaSesion();
    if (input.id) await editarObjetivo(db, actor, input.id, input);
    else await crearObjetivo(db, actor, input);
  });
}

export async function quitarObjetivoAccion(id: string): Promise<ResultadoAccionObjetivo> {
  return responder(async () => borrarObjetivo(db, await actorDeLaSesion(), id));
}

export async function copiarObjetivosAccion(input: {
  desdeCohorteId: string;
  haciaCohorteId: string;
}): Promise<ResultadoAccionObjetivo> {
  return responder(async () => copiarObjetivos(db, await actorDeLaSesion(), input));
}
