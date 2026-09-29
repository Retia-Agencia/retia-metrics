"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido, type Rol } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { calls, deals } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { instanteDeBogota } from "@/lib/format";
import { reclamarDeal } from "@/lib/deals/reclamar";
import { editarDeal } from "@/lib/deals/editar-deal";
import { completarAgendada } from "@/lib/deals/llamadas";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * Server actions del Inbox de un programa (ticket 070), MISMO patron que
 * `../deals/[id]/acciones.ts`:
 *
 * - `requireRole("gerente", "closer")` (el developer pasa por `esAccesoTotal`): es el
 *   acceso a la accion. QUIEN puede tocar ESTE deal lo decide cada funcion de `lib/deals/`
 *   (reclamar: `trabajaLeads` + `esDuenoPosible`; reasignar: `esAdministrador`). Esconder
 *   un boton no es seguridad.
 * - 🔒 **El actor SIEMPRE sale de la sesion** (`userId` y el rol de VISTA), nunca del input.
 *   Al reclamar, el nuevo dueño es el actor: un `ownerUserId` en el cuerpo no se lee. El
 *   objetivo (el deal) sale de un id que ademas se comprueba contra el ALCANCE de la
 *   sesion: un deal de un programa que no ve responde 404 (ADR 0048).
 * - `zod` en el borde y `normalizando`; el resultado es serializable.
 * - Tras escribir, `revalidatePath` por PATRON para el Inbox y el Kanban; la pantalla
 *   actual la refresca el cliente con `router.refresh()` (AGENTS.md).
 */

export type ResultadoInbox<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

interface Contexto {
  session: Session;
  actor: { userId: string; rol: Rol };
}

async function contextoDe(): Promise<Contexto> {
  const session = await requireRole("gerente", "closer");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { session, actor: { userId: session.user.id, rol } };
}

async function exigirProgramaVisible(ctx: Contexto, programId: string | undefined): Promise<void> {
  if (!programId || !(await programaEnAlcance(ctx.actor.userId, ctx.actor.rol, programId, db))) {
    throw new ErrorDeApp("No existe el deal.", 404);
  }
}

async function exigirDealVisible(ctx: Contexto, dealId: string): Promise<void> {
  const [d] = await db
    .select({ programId: deals.programId })
    .from(deals)
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  await exigirProgramaVisible(ctx, d?.programId);
}

async function exigirLlamadaVisible(ctx: Contexto, callId: string): Promise<void> {
  const [c] = await db
    .select({ programId: calls.programId })
    .from(calls)
    .where(and(eq(calls.id, callId), incluyendoAnulados(calls)));
  await exigirProgramaVisible(ctx, c?.programId);
}

function aError(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[inbox] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

async function correr<T extends object>(cuerpo: (ctx: Contexto) => Promise<T>): Promise<ResultadoInbox<T>> {
  const ctx = await contextoDe();
  try {
    const extra = await normalizando(() => cuerpo(ctx));
    // El Inbox es la pantalla actual, pero el Kanban es otra ruta cuyo cache queda viejo.
    revalidatePath("/p/[programa]/inbox", "page");
    revalidatePath("/p/[programa]/deals", "page");
    return { ok: true, ...extra };
  } catch (error) {
    return aError(error);
  }
}

const id = (mensaje: string) => z.string().uuid(mensaje);
const vacioAUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const textoOpcional = <T extends z.ZodTypeAny>(esquema: T) => z.preprocess(vacioAUndefined, esquema.optional());
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.");
const hora = z.string().regex(/^\d{2}:\d{2}$/, "La hora debe ser HH:MM.");

function instante(d: string, h: string): Date {
  const i = instanteDeBogota(d, h);
  if (!i) throw new ErrorDeApp("La fecha y la hora de la cita no son válidas.", 400);
  return i;
}

// ───────────────────────────────────────────── reclamar

const esquemaReclamar = z.object({ dealId: id("Deal inválido.") });
export type EntradaReclamar = z.input<typeof esquemaReclamar>;

/** Reclamar un deal sin dueño: el nuevo dueño es el ACTOR de la sesion, nunca el input. */
export async function reclamarDealAccion(entrada: EntradaReclamar): Promise<ResultadoInbox> {
  return correr(async (ctx) => {
    const { dealId } = esquemaReclamar.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    await reclamarDeal(db, ctx.actor, { dealId });
    return {};
  });
}

// ───────────────────────────────────────────── reasignar (admin)

const esquemaReasignar = z.object({
  dealId: id("Deal inválido."),
  ownerUserId: id("Dueño inválido."),
});
export type EntradaReasignar = z.input<typeof esquemaReasignar>;

/**
 * Reasignar el deal a otro dueño. Reusa `editarDeal` con `ownerUserId`, que ya exige
 * `esAdministrador` y que el dueño sea posible en el programa del deal (ADR 0043): no se
 * duplica la reja.
 */
export async function reasignarDealAccion(entrada: EntradaReasignar): Promise<ResultadoInbox> {
  return correr(async (ctx) => {
    const { dealId, ownerUserId } = esquemaReasignar.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    await editarDeal(db, ctx.actor, { dealId, ownerUserId });
    return {};
  });
}

// ───────────────────────────────────────────── completar la agendada al reclamar

const esquemaCompletar = z.object({
  callId: id("Llamada inválida."),
  dia,
  hora,
  linkCalendly: textoOpcional(z.string().url("El link de Calendly no es una URL válida.")),
});
export type EntradaCompletarAgendada = z.input<typeof esquemaCompletar>;

/**
 * Completar la llamada agendada que el sistema dejo sin fecha, al reclamar un Agendado
 * (ticket 057). Reusa `completarAgendada`, que exige que el actor sea el dueño del deal
 * abierto de la llamada: por eso se completa DESPUES de reclamar, no antes.
 */
export async function completarAgendadaAccion(entrada: EntradaCompletarAgendada): Promise<ResultadoInbox> {
  return correr(async (ctx) => {
    const { callId, dia: d, hora: h, linkCalendly } = esquemaCompletar.parse(entrada);
    await exigirLlamadaVisible(ctx, callId);
    await completarAgendada(db, ctx.actor, { callId, fechaAgenda: instante(d, h), linkCalendly });
    return {};
  });
}
