"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { manejaPauta } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { canales, esquemaCanal, type EntradaCanal } from "@/lib/catalogo/canales";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";

export type ResultadoCanalAccion = { ok: true } | { ok: false; error: string };
const esquemaId = z.string().uuid("Canal inválido.");

function errorSeguro(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[canales] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/**
 * Los canales los administra quien `manejaPauta` (ADR 0052, ADR 0077 punto 4): el paid
 * trafficker, el gerente y el developer. `requireRole` admite los tres roles base
 * —`paid_trafficker` entre ellos— y despues `manejaPauta` sobre el ROL DE VISTA cierra:
 * un developer en vista `closer` queda fuera. Nunca se compara `rol === "..."` a mano,
 * y la regla vale aunque el boton no aparezca: esta accion se puede forjar.
 */
async function actorDePauta(): Promise<string> {
  const session = await requireRole("gerente", "paid_trafficker");
  if (!manejaPauta(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
  return session.user.id;
}

async function ejecutar(operacion: (actorId: string) => Promise<unknown>): Promise<ResultadoCanalAccion> {
  try {
    await operacion(await actorDePauta());
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
