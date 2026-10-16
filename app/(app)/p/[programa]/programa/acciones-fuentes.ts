"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/guards";
import { exigirAccesoAlPrograma } from "@/lib/catalogo/acceso-programa";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { programs, sources } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import {
  activarFuente,
  crearFuente,
  desactivarFuente,
  editarFuente,
  guardarSecretoDeFuente,
  guardarTokenTypeform,
  marcarFuentePrincipal,
  probarFuente,
  rotarSecretoDeFuente,
  type Actor,
  type EntradaFuente,
} from "@/lib/catalogo/fuentes";
import { editarPlantillaLead, type EntradaPlantillaLead } from "@/lib/catalogo/programas";
import type { ColumnaResuelta } from "@/lib/sheets/probar-fuente";

/**
 * Server actions de la administracion de fuentes (ticket 016, ADR 0019). Viven en la
 * tab Programa (`/p/[programa]/programa`, ADR 0077: cada dato vive en la pantalla de su
 * objeto); antes vivian en la seccion Fuentes de Ajustes.
 *
 * Son la unica cara publica: enforzan el rol en el SERVIDOR con
 * `requireRole("gerente")`. El developer entra igual porque `puedeAcceder` lo deja
 * pasar (ADR 0025) — nunca se escribe `"developer"` a mano. El actor que se le pasa
 * a la logica lleva el ROL DE VISTA (ticket 028, no `session.user.rol` crudo), y
 * `esAdministrador` (gerente o developer) decide si administra; el id sale SIEMPRE
 * de la sesion, nunca del cuerpo.
 *
 * El resultado es serializable — nunca se lanza al cliente — porque las server
 * actions se invocan por red y una excepcion no viaja con su tipo. Un
 * `MapeoInvalidoError` (422) al activar sale como `{ ok: false, error }` con el
 * mensaje que dice que columna falto, mismo contrato que las demas pantallas.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
export type ResultadoSecreto = { ok: true; secreto: string } | { ok: false; error: string };
export type ResultadoPrueba =
  | { ok: true; columnas: ColumnaResuelta[] }
  | { ok: false; error: string };

function aResultado(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[fuentes] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/**
 * Arma el actor desde la sesion ya validada por `requireRole`. El rol sale de
 * `rolDeVista(session)`, NO de `session.user.rol` crudo (ticket 028): estrechar
 * nunca otorga. Aqui `requireRole("gerente")` ya dejo pasar solo a administradores.
 */
async function actorDe(session: Session): Promise<Actor> {
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol };
}

async function exigirProgramaVisible(session: Session, actor: Actor, programId: string | undefined): Promise<void> {
  // Igual que en acciones-programa.ts: la fuente de un programa inactivo tambien se configura.
  if (!programId) throw new ErrorDeApp("No existe la fuente.", 404);
  await exigirAccesoAlPrograma(db, { id: session.user.id, rol: actor.rol }, programId, "No puedes administrar este programa.");
}

async function exigirProgramaPorId(session: Session, actor: Actor, id: string): Promise<void> {
  const [programa] = await db.select({ programId: programs.id }).from(programs).where(eq(programs.id, id));
  await exigirProgramaVisible(session, actor, programa?.programId);
}

async function exigirProgramaDeFuente(session: Session, actor: Actor, id: string): Promise<void> {
  const [fuente] = await db.select({ programId: sources.programId }).from(sources).where(eq(sources.id, id));
  await exigirProgramaVisible(session, actor, fuente?.programId);
}

/** Revalida la pantalla de fuentes tras una escritura. */
function revalidar() {
  revalidatePath("/p/[programa]/programa", "page");
}

export async function crearFuenteAccion(input: EntradaFuente): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaPorId(session, actor, input.programId);
    await crearFuente(db, actor, input);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarFuenteAccion(
  id: string,
  input: EntradaFuente,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    await editarFuente(db, actor, id, input);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Prueba el mapeo contra la hoja real. No cambia nada en la base; solo lee los
 * encabezados con la cuenta de servicio y devuelve que columna tomo cada campo, o el
 * mensaje del `MapeoInvalidoError`.
 */
export async function probarFuenteAccion(id: string): Promise<ResultadoPrueba> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    const { columnas } = await probarFuente(db, actor, id);
    return { ok: true, columnas };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Activa una fuente CORRIENDO la prueba en ese momento (ticket 016 punto 5). Si el
 * mapeo no cuadra, devuelve el error y la fuente queda inactiva.
 */
export async function activarFuenteAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    await activarFuente(db, actor, id);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Genera o rota el secreto del webhook (ticket 105). Es la UNICA respuesta que lleva
 * el secreto, y solo esta vez: la pantalla lo muestra para pegarlo en el proveedor.
 */
export async function rotarSecretoFuenteAccion(id: string): Promise<ResultadoSecreto> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    const secreto = await rotarSecretoDeFuente(db, actor, id);
    revalidar();
    return { ok: true, secreto };
  } catch (error) {
    return aResultado(error);
  }
}

/** Guarda el secreto que genero el proveedor. El valor entra y no vuelve a salir. */
export async function guardarSecretoFuenteAccion(id: string, secreto: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    await guardarSecretoDeFuente(db, actor, id, secreto);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Guarda o reemplaza el token de Typeform de una fuente (126 parte B), con el que el
 * dashboard lee el embudo por pregunta. El valor entra y no vuelve a salir.
 */
export async function guardarTokenTypeformAccion(id: string, token: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    await guardarTokenTypeform(db, actor, id, token);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarFuenteAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    await desactivarFuente(db, actor, id);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Marca la fuente principal del programa (ADR 0068): la que el generador de links usa por
 * defecto. La ficha del programa lee lo mismo, asi que tambien se invalida.
 */
export async function marcarFuentePrincipalAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaDeFuente(session, actor, id);
    await marcarFuentePrincipal(db, actor, id);
    revalidar();
    revalidatePath("/p/[programa]/programa", "page");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Edita la plantilla de lead del programa (ADR 0019). Vive en esta pantalla porque
 * la plantilla y las fuentes del programa se razonan juntas: una fuente solo ajusta
 * lo que la plantilla ya define.
 */
export async function editarPlantillaLeadAccion(
  programId: string,
  plantilla: EntradaPlantillaLead,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const actor = await actorDe(session);
    await exigirProgramaPorId(session, actor, programId);
    await editarPlantillaLead(db, session.user.id, programId, plantilla);
    revalidar();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
