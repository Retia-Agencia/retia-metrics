"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { esquemaDescuentoUsdOpcional } from "@/lib/deals/valor-vendido";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido, type Rol } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { abonos, calls, deals } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { instanteDeBogota } from "@/lib/format";
import { registrarAbono, anularAbono, pegarComprobante } from "@/lib/deals/abonos";
import { registrarActividad } from "@/lib/deals/actividades";
import { anularDeal } from "@/lib/deals/anular-deal";
import { editarDeal } from "@/lib/deals/editar-deal";
import { marcarLinkEnviado } from "@/lib/deals/handoff";
import { agregarLlamada, completarAgendada, marcarFallida, pegarGrain, RESULTADOS_FALLIDOS } from "@/lib/deals/llamadas";
import { editarAcuerdoDePago } from "@/lib/deals/pago";
import { cambiarCohorte, desmarcarOnboarded, marcarOnboarded } from "@/lib/deals/estudiante";
import { marcarCortesia } from "@/lib/deals/cortesia";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * Server actions de la ficha del deal (ticket 074). Mismo patron que `../acciones.ts`:
 *
 * - `requireRole("gerente", "closer")` (el developer pasa por `esAccesoTotal`): es el acceso
 *   a la accion. QUIEN puede tocar ESTE deal lo decide cada funcion de `lib/deals/`
 *   (`puedeTrabajarDeal`: dueño o administrador). Esconder un boton no es seguridad.
 * - 🔒 **El actor SIEMPRE sale de la sesion** (`userId` y el rol de VISTA), nunca del input:
 *   un `userId` o un `ownerUserId` ajeno metido en el cuerpo de la peticion se ignora porque ni
 *   siquiera se lee. El objetivo de una mutacion sale de un id que ademas se comprueba contra el
 *   ALCANCE de la sesion: un deal de un programa que no ve responde 404 (ADR 0048).
 * - `zod` en el borde y `normalizando`; el resultado es serializable (una excepcion no viaja
 *   con su tipo por la red).
 * - Tras escribir, `revalidatePath` por PATRON para el Kanban (`"/p/[programa]/deals"`,
 *   `"page"`); la ficha misma la refresca el cliente con `router.refresh()` (AGENTS.md:
 *   `revalidatePath` no refresca la pantalla que acaba de escribir).
 * - Mover de etapa NO esta aqui: la ficha reusa `moverDeal` de `../acciones.ts`.
 */

export type ResultadoFicha<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

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

/** El deal tiene que ser de un programa que la sesion ve; si no, 404 como si no existiera. */
async function exigirProgramaVisible(ctx: Contexto, programId: string | undefined): Promise<void> {
  if (!programId || !(await programaEnAlcance(ctx.actor.userId, ctx.actor.rol, programId, db))) {
    throw new ErrorDeApp("No existe el deal.", 404);
  }
}

async function exigirDealVisible(ctx: Contexto, dealId: string): Promise<void> {
  // Por clave primaria, no una metrica: `incluyendoAnulados` para poder decir "esta anulado".
  const [d] = await db.select({ programId: deals.programId }).from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  await exigirProgramaVisible(ctx, d?.programId);
}

async function exigirLlamadaVisible(ctx: Contexto, callId: string): Promise<void> {
  const [c] = await db.select({ programId: calls.programId }).from(calls).where(and(eq(calls.id, callId), incluyendoAnulados(calls)));
  await exigirProgramaVisible(ctx, c?.programId);
}

async function exigirAbonoVisible(ctx: Contexto, abonoId: string): Promise<void> {
  const [a] = await db.select({ programId: abonos.programId }).from(abonos).where(and(eq(abonos.id, abonoId), incluyendoAnulados(abonos)));
  await exigirProgramaVisible(ctx, a?.programId);
}

function aError(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[ficha-deal] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/** Corre una accion: contexto de la sesion y traduccion del error. Cada cuerpo valida su entrada Y su alcance. */
async function correr<T extends object>(cuerpo: (ctx: Contexto) => Promise<T>): Promise<ResultadoFicha<T>> {
  const ctx = await contextoDe();
  try {
    const extra = await normalizando(() => cuerpo(ctx));
    // El Kanban es otra ruta: su cache de ruta queda vieja (por PATRON, AGENTS.md).
    revalidatePath("/p/[programa]/deals", "page");
    return { ok: true, ...extra };
  } catch (error) {
    return aError(error);
  }
}

// ───────────────────────────────────────────── esquemas del borde

const id = (mensaje: string) => z.string().uuid(mensaje);
/** Un campo de formulario vacio es "no lo mande", no un texto vacio que falle la validacion. */
const vacioAUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const textoOpcional = <T extends z.ZodTypeAny>(esquema: T) => z.preprocess(vacioAUndefined, esquema.optional());
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.");
const hora = z.string().regex(/^\d{2}:\d{2}$/, "La hora debe ser HH:MM.");

function instante(d: string, h: string): Date {
  const i = instanteDeBogota(d, h);
  if (!i) throw new ErrorDeApp("La fecha y la hora de la cita no son válidas.", 400);
  return i;
}

// ───────────────────────────────────────────── el deal

const esquemaEditar = z.object({
  dealId: id("Deal inválido."),
  descuentoUsd: esquemaDescuentoUsdOpcional,
  motivoCambioVenta: z.string().trim().min(1, "El motivo es obligatorio para cambiar una venta.").optional(),
  ownerUserId: id("Dueño inválido.").optional(),
  fechaSeguimiento: dia.nullable().optional(),
  motivoId: id("Motivo inválido.").nullable().optional(),
  areaDeclaradaId: id("Área inválida.").nullable().optional(),
});
export type EntradaEditarDeal = z.input<typeof esquemaEditar>;

export async function editarDealAccion(entrada: EntradaEditarDeal): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    // Solo estos campos pasan a la funcion: nada mas del cuerpo de la peticion llega a ella.
    const { dealId, descuentoUsd, motivoCambioVenta, ownerUserId, fechaSeguimiento, motivoId, areaDeclaradaId } = esquemaEditar.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    await editarDeal(db, actor, { dealId, descuentoUsd, motivoCambioVenta, ownerUserId, fechaSeguimiento, motivoId, areaDeclaradaId });
    return {};
  });
}

const esquemaAnular = z.object({ dealId: id("Deal inválido."), motivo: z.string() });
export type EntradaAnularDeal = z.input<typeof esquemaAnular>;

export async function anularDealAccion(entrada: EntradaAnularDeal): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { dealId, motivo } = esquemaAnular.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    await anularDeal(db, actor, { dealId, motivo });
    return {};
  });
}

const esquemaLinkEnviado = z.object({ dealId: id("Deal inválido.") });

export async function marcarLinkEnviadoAccion(entrada: z.input<typeof esquemaLinkEnviado>): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { dealId } = esquemaLinkEnviado.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    await marcarLinkEnviado(db, ctx.actor, dealId);
    return {};
  });
}

const esquemaAcuerdo = z.object({
  dealId: id("Deal inválido."),
  acuerdoPago: z.string().max(500, "El acuerdo es muy largo.").optional(),
  fechaLimitePago: dia.nullable().optional(),
});
export type EntradaAcuerdo = z.input<typeof esquemaAcuerdo>;

export async function editarAcuerdoAccion(entrada: EntradaAcuerdo): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { dealId, acuerdoPago, fechaLimitePago } = esquemaAcuerdo.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    await editarAcuerdoDePago(db, actor, { dealId, acuerdoPago, fechaLimitePago });
    return {};
  });
}

// ───────────────────────────────────────────── actividades

const esquemaActividad = z.object({
  dealId: id("Deal inválido."),
  tipo: z.enum(["contacto", "intento", "nota"]),
  canal: textoOpcional(z.string().max(60)),
  nota: z.string(),
});
export type EntradaActividad = z.input<typeof esquemaActividad>;

export async function registrarActividadAccion(entrada: EntradaActividad): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { dealId, tipo, canal, nota } = esquemaActividad.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    // La fecha del contacto es AHORA (la pone el servidor): el closer registra lo que acaba de pasar.
    await registrarActividad(db, actor, { dealId, tipo, canal, nota });
    return {};
  });
}

// ───────────────────────────────────────────── abonos

const esquemaAbonoAccion = z.object({
  dealId: id("Deal inválido."),
  fecha: dia,
  monto: z.string(),
  plataformaId: textoOpcional(id("Plataforma inválida.")),
  comprobanteUrl: textoOpcional(z.string().url("El comprobante debe ser una URL válida.")),
  areaDeclaradaId: id("Área inválida.").nullable().optional(),
});
export type EntradaAbono = z.input<typeof esquemaAbonoAccion>;

export async function registrarAbonoAccion(
  entrada: EntradaAbono,
): Promise<ResultadoFicha<{ etapa: EtapaDeal; movioElDeal: boolean; saldo: number; cohorteAsignada: string | null }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const datos = esquemaAbonoAccion.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    const r = await registrarAbono(db, actor, datos);
    return { etapa: r.etapa, movioElDeal: r.movioElDeal, saldo: r.saldo, cohorteAsignada: r.cohorteAsignada };
  });
}

const esquemaComprobanteAccion = z.object({
  abonoId: id("Abono inválido."),
  comprobanteUrl: z.string().url("El comprobante debe ser una URL válida."),
});
export type EntradaPegarComprobante = z.input<typeof esquemaComprobanteAccion>;

export async function pegarComprobanteAccion(entrada: EntradaPegarComprobante): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const datos = esquemaComprobanteAccion.parse(entrada);
    await exigirAbonoVisible(ctx, datos.abonoId);
    await pegarComprobante(db, ctx.actor, datos);
    return {};
  });
}

const esquemaAnularAbonoAccion = z.object({ abonoId: id("Abono inválido."), motivo: z.string() });
export type EntradaAnularAbono = z.input<typeof esquemaAnularAbonoAccion>;

export async function anularAbonoAccion(entrada: EntradaAnularAbono): Promise<ResultadoFicha<{ etapa: string; movioElDeal: boolean }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { abonoId, motivo } = esquemaAnularAbonoAccion.parse(entrada);
    await exigirAbonoVisible(ctx, abonoId);
    const r = await anularAbono(db, actor, { abonoId, motivo });
    return { etapa: r.etapa, movioElDeal: r.movioElDeal };
  });
}

// ───────────────────────────────────────────── estudiante

const esquemaSoloDeal = z.object({ dealId: id("Deal inválido.") });
export type EntradaSoloDeal = z.input<typeof esquemaSoloDeal>;

export async function marcarOnboardedAccion(entrada: EntradaSoloDeal): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const datos = esquemaSoloDeal.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    await marcarOnboarded(db, actor, datos);
    return {};
  });
}

export async function marcarCortesiaAccion(entrada: EntradaSoloDeal): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const datos = esquemaSoloDeal.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    await marcarCortesia(db, actor, datos);
    return {};
  });
}

export async function desmarcarOnboardedAccion(entrada: EntradaSoloDeal): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const datos = esquemaSoloDeal.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    await desmarcarOnboarded(db, actor, datos);
    return {};
  });
}

const esquemaCohorte = z.object({ dealId: id("Deal inválido."), cohortId: id("Cohorte inválida."), motivo: z.string() });
export type EntradaCohorte = z.input<typeof esquemaCohorte>;

export async function cambiarCohorteAccion(entrada: EntradaCohorte): Promise<ResultadoFicha<{ fechaLimiteAjustada: string | null }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const datos = esquemaCohorte.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    const r = await cambiarCohorte(db, actor, datos);
    return { fechaLimiteAjustada: r.fechaLimiteAjustada };
  });
}

// ───────────────────────────────────────────── llamadas

const esquemaAgregarLlamada = z.object({
  dealId: id("Deal inválido."),
  dia,
  hora,
  linkCalendly: textoOpcional(z.string().url("El link de la reunión no es una URL válida.")),
  notas: textoOpcional(z.string().max(2000)),
});
export type EntradaAgregarLlamada = z.input<typeof esquemaAgregarLlamada>;

export async function agregarLlamadaAccion(entrada: EntradaAgregarLlamada): Promise<ResultadoFicha<{ movioAAgendado: boolean }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { dealId, dia: d, hora: h, linkCalendly, notas } = esquemaAgregarLlamada.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    const r = await agregarLlamada(db, actor, { dealId, fechaAgenda: instante(d, h), linkCalendly, notas });
    return { movioAAgendado: r.movioAAgendado };
  });
}

const esquemaCompletar = z.object({
  callId: id("Llamada inválida."),
  dia,
  hora,
  linkCalendly: textoOpcional(z.string().url("El link de la reunión no es una URL válida.")),
});
export type EntradaCompletarAgendada = z.input<typeof esquemaCompletar>;

export async function completarAgendadaAccion(entrada: EntradaCompletarAgendada): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { callId, dia: d, hora: h, linkCalendly } = esquemaCompletar.parse(entrada);
    await exigirLlamadaVisible(ctx, callId);
    await completarAgendada(db, actor, { callId, fechaAgenda: instante(d, h), linkCalendly });
    return {};
  });
}

const esquemaGrain = z.object({ callId: id("Llamada inválida."), linkGrain: z.string() });
export type EntradaPegarGrain = z.input<typeof esquemaGrain>;

export async function pegarGrainAccion(entrada: EntradaPegarGrain): Promise<ResultadoFicha<{ etapa: string; movioAAtendido: boolean }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { callId, linkGrain } = esquemaGrain.parse(entrada);
    await exigirLlamadaVisible(ctx, callId);
    const r = await pegarGrain(db, actor, { callId, linkGrain });
    return { etapa: r.etapa, movioAAtendido: r.movioAAtendido };
  });
}

const esquemaFallida = z.object({
  callId: id("Llamada inválida."),
  resultado: z.enum(RESULTADOS_FALLIDOS),
  motivoId: textoOpcional(id("Motivo inválido.")),
});
export type EntradaMarcarFallida = z.input<typeof esquemaFallida>;

export async function marcarFallidaAccion(entrada: EntradaMarcarFallida): Promise<ResultadoFicha<{ etapa: string }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { callId, resultado, motivoId } = esquemaFallida.parse(entrada);
    await exigirLlamadaVisible(ctx, callId);
    const r = await marcarFallida(db, actor, { callId, resultado, motivoId });
    return { etapa: r.etapa };
  });
}
