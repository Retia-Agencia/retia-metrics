"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { esquemaDescuentoUsdOpcional } from "@/lib/deals/valor-vendido";
import { esquemaProximoContacto } from "@/lib/deals/proximo-contacto";
import type { Session } from "next-auth";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido, trabajaLeads, type Rol } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { abonos, calls, deals, etapaDealEnum, leadContactos, leads, pendienteDealEnum } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { instanteDeBogota } from "@/lib/format";
import { adjuntarComprobante, registrarAbono, anularAbono, pegarComprobante, cambiarPlataformaDeAbono } from "@/lib/deals/abonos";
import { almacenDeArchivos, confirmarArchivo, pedirSubida, verificarArchivo } from "@/lib/archivos";
import { MAX_BYTES, TIPOS_PERMITIDOS } from "@/lib/archivos/reglas";
import { puedeTrabajarDeal } from "@/lib/deals/permiso";
import { crearOVincularPlataforma } from "@/lib/catalogo/plataformas";
import { registrarActividad } from "@/lib/deals/actividades";
import { anotar, esquemaAnotar, type DatosAnotar, type AnotacionHecha } from "@/lib/deals/anotar";
import { moverConHecho } from "@/lib/deals/mover-con-hecho";
import { resumenDelCambio } from "@/lib/deals/resumen-del-cambio";
import { anularDeal } from "@/lib/deals/anular-deal";
import { editarDeal } from "@/lib/deals/editar-deal";
import { marcarLinkEnviado } from "@/lib/deals/handoff";
import { agregarLlamada, completarAgendada, corregirResultado, esquemaCorregirResultado, marcarFallida, marcarShow, pegarGrain, reagendarLlamada, RESULTADOS_FALLIDOS, type DatosCorregirResultado } from "@/lib/deals/llamadas";
import { eventoParaAgendar, horasDisponibles, reservarCita, type CitaReservada } from "@/lib/calendly/escritura";
import { editarAcuerdoDePago } from "@/lib/deals/pago";
import { cambiarCohorte, desmarcarOnboarded, marcarOnboarded } from "@/lib/deals/estudiante";
import { marcarCortesia } from "@/lib/deals/cortesia";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { confirmarCorreo, EnvioConDealVigenteError, esquemaContacto, separarCorreo } from "@/lib/ingesta/separar";

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

export type ResultadoFicha<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; dealId?: string };

interface Contexto {
  session: Session;
  actor: { userId: string; rol: Rol; operaComoCloser: boolean };
}

async function contextoDe(permitidos: readonly Rol[] = ["gerente", "closer"]): Promise<Contexto> {
  const session = await requireRole(...permitidos);
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { session, actor: { userId: session.user.id, rol, operaComoCloser: session.user.operaComoCloser } };
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

function aError(error: unknown): { ok: false; error: string; dealId?: string } {
  if (error instanceof EnvioConDealVigenteError) return { ok: false, error: error.message, dealId: error.dealId };
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[ficha-deal] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/** Corre una accion: contexto de la sesion y traduccion del error. Cada cuerpo valida su entrada Y su alcance. */
async function correr<T extends object>(
  cuerpo: (ctx: Contexto) => Promise<T>,
  permitidos: readonly Rol[] = ["gerente", "closer"],
): Promise<ResultadoFicha<T>> {
  try {
    // La guarda va DENTRO del try: un 403 (rol, o la reja de solo lectura del "ver como",
    // ticket 172) vuelve como resultado y la pantalla lo muestra, no como excepción.
    const ctx = await contextoDe(permitidos);
    const extra = await normalizando(() => cuerpo(ctx));
    // El Kanban es otra ruta: su cache de ruta queda vieja (por PATRON, AGENTS.md).
    revalidatePath("/p/[programa]/deals", "page");
    return { ok: true, ...extra };
  } catch (error) {
    return aError(error);
  }
}

/**
 * Los roles que entran a las acciones de ONBOARDING (ticket 145): además de gerente y closer,
 * el customer success. Es acceso a la acción; QUIÉN puede marcar el onboarding de ESTE deal lo
 * decide `puedeMarcarOnboarding` dentro de `lib/deals/estudiante.ts` (dueño, administrador, o
 * customer success con membresía activa). El resto de las acciones de la ficha mantiene su
 * `requireRole("gerente", "closer")` por defecto, así que el customer success no entra a ellas.
 */
const ROLES_ONBOARDING: readonly Rol[] = ["gerente", "closer", "customer_success"];

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

// ───────────────────────────────────────────── mover con el hecho de la etapa

const esquemaDatosMovimiento = z.object({
  descuentoUsd: esquemaDescuentoUsdOpcional,
  fechaLimitePago: dia.nullable().optional(),
  acuerdoPago: z.string().trim().max(500).nullable().optional(),
  cohorteDestinoId: id("Cohorte inválida.").nullable().optional(),
  fechaSeguimiento: esquemaProximoContacto,
}).optional();

const esquemaHecho = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("atendido"),
    callId: id("Llamada inválida.").optional(),
    dia: textoOpcional(dia),
    hora: textoOpcional(hora),
    linkGrain: textoOpcional(z.string().url("El link de Grain debe ser una URL válida.")),
  }).superRefine((hecho, ctx) => {
    if (!hecho.callId && (!hecho.dia || !hecho.hora)) {
      ctx.addIssue({ code: "custom", message: "Pon la fecha y la hora de la llamada." });
    }
  }),
  z.object({ tipo: z.literal("agendado"), dia, hora }),
  z.object({
    tipo: z.literal("abono"),
    fecha: dia,
    monto: z.string(),
    plataformaId: textoOpcional(id("Plataforma inválida.")),
    comprobanteUrl: textoOpcional(z.string().url("El comprobante debe ser una URL válida.")),
    archivoId: textoOpcional(id("Archivo inválido.")),
  }),
]);

const esquemaMoverConHechoAccion = z.object({
  dealId: id("Deal inválido."),
  a: z.enum(etapaDealEnum.enumValues),
  pendiente: z.enum(pendienteDealEnum.enumValues).nullable().optional(),
  motivoId: id("Motivo inválido.").nullable().optional(),
  comentarioMotivo: z.string().trim().max(4000, "El comentario es muy largo.").optional(),
  // El comentario de "Lo estoy trabajando" (ticket 228): se guarda como nota antes de mover.
  comentario: z.string().trim().max(4000, "El comentario es muy largo.").optional(),
  correccion: z.boolean().optional(),
  datos: esquemaDatosMovimiento,
  hecho: esquemaHecho.optional(),
});

export type EntradaMoverConHecho = z.input<typeof esquemaMoverConHechoAccion>;

/** Una sola puerta para el botón de la ficha y el arrastre del Kanban. */
export async function moverConHechoAccion(
  entrada: EntradaMoverConHecho,
): Promise<ResultadoFicha<{ etapa: EtapaDeal; resumen: string[] }>> {
  return correr(async (ctx) => {
    const datos = esquemaMoverConHechoAccion.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    const archivo = datos.hecho?.tipo === "abono" && datos.hecho.archivoId
      ? await verificarArchivo(db, almacenDeArchivos(), { archivoId: datos.hecho.archivoId, actorId: ctx.actor.userId })
      : undefined;
    const hecho = datos.hecho?.tipo === "atendido"
      ? {
          tipo: "atendido" as const,
          callId: datos.hecho.callId,
          fechaAgenda: datos.hecho.dia && datos.hecho.hora ? instante(datos.hecho.dia, datos.hecho.hora) : undefined,
          linkGrain: datos.hecho.linkGrain,
        }
      : datos.hecho?.tipo === "agendado"
        ? { tipo: "agendado" as const, fechaAgenda: instante(datos.hecho.dia, datos.hecho.hora) }
        : datos.hecho?.tipo === "abono"
          ? { ...datos.hecho, moneda: "USD" as const, archivo }
          : undefined;
    // El resumen se arma en el servidor; al cliente solo le llegan los textos, nunca el `cambio`.
    if (hecho?.tipo === "agendado") await exigirSinCitaAgendada(datos.dealId);
    const cita = hecho?.tipo === "agendado" ? await reservarParaDeal(datos.dealId, hecho.fechaAgenda) : undefined;
    const { etapa, cambio } = await moverConHecho(db, ctx.actor, { ...datos, hecho }, { cita });
    return { etapa, resumen: resumenDelCambio(cambio) };
  });
}

// ───────────────────────────────────────────── el deal

const esquemaEditar = z.object({
  dealId: id("Deal inválido."),
  descuentoUsd: esquemaDescuentoUsdOpcional,
  motivoCambioVenta: z.string().trim().min(1, "El motivo es obligatorio para cambiar una venta.").optional(),
  ownerUserId: id("Dueño inválido.").optional(),
  motivoId: id("Motivo inválido.").nullable().optional(),
});
export type EntradaEditarDeal = z.input<typeof esquemaEditar>;

export async function editarDealAccion(entrada: EntradaEditarDeal): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    // Solo estos campos pasan a la funcion: nada mas del cuerpo de la peticion llega a ella.
    const { dealId, descuentoUsd, motivoCambioVenta, ownerUserId, motivoId } = esquemaEditar.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    await editarDeal(db, actor, { dealId, descuentoUsd, motivoCambioVenta, ownerUserId, motivoId });
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

// ───────────────────────────────────────────── posible duplicado del lead

async function decidirCorreoDesdeDeal(entrada: unknown, accion: "confirmar" | "separar"): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const datos = esquemaContacto.parse(entrada);
    const [contacto] = await db
      .select({ programId: leadContactos.programId })
      .from(leadContactos)
      .where(eq(leadContactos.id, datos.contactoId));
    if (!contacto || !(await programaEnAlcance(ctx.actor.userId, ctx.actor.rol, contacto.programId, db))) {
      throw new ErrorDeApp("No existe ese contacto.", 404);
    }
    const actor = { id: ctx.actor.userId, rol: ctx.actor.rol };
    if (accion === "confirmar") await confirmarCorreo(db, actor, datos);
    else await separarCorreo(db, actor, datos);
    return {};
  });
}

export async function confirmarCorreoDesdeDealAccion(entrada: { contactoId: string }): Promise<ResultadoFicha> {
  return decidirCorreoDesdeDeal(entrada, "confirmar");
}

export async function separarCorreoDesdeDealAccion(entrada: { contactoId: string }): Promise<ResultadoFicha> {
  return decidirCorreoDesdeDeal(entrada, "separar");
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

export async function anotarAccion(
  entrada: DatosAnotar,
): Promise<ResultadoFicha<Omit<AnotacionHecha, "cambio"> & { resumen: string[] }>> {
  return correr(async (ctx) => {
    const datos = esquemaAnotar.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    // El resumen se arma en el servidor; al cliente solo le llegan los textos, nunca el `cambio`.
    const cita = datos.reagenda?.fechaLlamada ? await reservarParaDeal(datos.dealId, datos.reagenda.fechaLlamada) : undefined;
    const { cambio, ...resto } = await anotar(db, ctx.actor, datos, { cita });
    return { ...resto, resumen: resumenDelCambio(cambio) };
  });
}

const esquemaProximaCohorte = z.object({
  dealId: id("Deal inválido."),
  cohortId: id("Cohorte inválida."),
});

/** La respuesta "Próxima cohorte" cambia la cohorte ya; no pasa por el motor de etapas. */
export async function proximaCohorteAccion(
  entrada: z.input<typeof esquemaProximaCohorte>,
): Promise<ResultadoFicha<{ resumen: string[] }>> {
  return correr(async (ctx) => {
    const { dealId, cohortId } = esquemaProximaCohorte.parse(entrada);
    await exigirDealVisible(ctx, dealId);
    const { cambio } = await anotar(db, ctx.actor, {
      dealId,
      proximaCohorte: { cohorteDestinoId: cohortId },
    });
    return { resumen: resumenDelCambio(cambio) };
  });
}

const esquemaActividad = z.object({
  dealId: id("Deal inválido."),
  tipo: z.enum(["contacto", "nota"]),
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
  archivoId: textoOpcional(id("Archivo inválido.")),
});
export type EntradaAbono = z.input<typeof esquemaAbonoAccion>;

export async function registrarAbonoAccion(
  entrada: EntradaAbono,
): Promise<ResultadoFicha<{ etapa: EtapaDeal; movioElDeal: boolean; saldo: number; cohorteAsignada: string | null }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const datos = esquemaAbonoAccion.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    const archivo = datos.archivoId
      ? await verificarArchivo(db, almacenDeArchivos(), { archivoId: datos.archivoId, actorId: actor.userId })
      : undefined;
    const r = await registrarAbono(db, actor, { ...datos, archivo });
    return { etapa: r.etapa, movioElDeal: r.movioElDeal, saldo: r.saldo, cohorteAsignada: r.cohorteAsignada };
  });
}

const esquemaCrearPlataformaParaAbono = z.object({
  dealId: id("Deal inválido."),
  nombre: z.string().trim().min(2, "Escribe al menos 2 caracteres."),
});

const esquemaPedirSubidaParaAbono = z.object({
  dealId: id("Deal inválido."),
  tipoMime: z.enum(TIPOS_PERMITIDOS, { error: "El tipo de archivo no está permitido." }),
  bytes: z.number().int().positive("El archivo debe tener contenido.").max(MAX_BYTES, "El archivo supera 5 MB."),
});
export type EntradaPedirSubidaParaAbono = z.input<typeof esquemaPedirSubidaParaAbono>;

export async function pedirSubidaParaAbonoAccion(
  entrada: EntradaPedirSubidaParaAbono,
): Promise<ResultadoFicha<{ archivoId: string; subida: { url: string; metodo: "PUT"; cabeceras: Record<string, string> } }>> {
  return correr(async (ctx) => {
    const datos = esquemaPedirSubidaParaAbono.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    const [deal] = await db.select().from(deals).where(and(eq(deals.id, datos.dealId), incluyendoAnulados(deals)));
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    if (!trabajaLeads(ctx.actor) || !puedeTrabajarDeal(ctx.actor, deal)) {
      throw new ErrorDeApp("Solo el dueño del deal puede subir un comprobante para sus abonos.", 403);
    }
    return pedirSubida(db, almacenDeArchivos(), {
      programId: deal.programId,
      tipoMime: datos.tipoMime,
      bytes: datos.bytes,
      actorId: ctx.actor.userId,
    });
  });
}
export type EntradaCrearPlataformaParaAbono = z.input<typeof esquemaCrearPlataformaParaAbono>;

export async function crearPlataformaParaAbonoAccion(
  entrada: EntradaCrearPlataformaParaAbono,
): Promise<ResultadoFicha<{ plataforma: { id: string; nombre: string } }>> {
  return correr(async (ctx) => {
    const datos = esquemaCrearPlataformaParaAbono.parse(entrada);
    const [deal] = await db
      .select({ programId: deals.programId, ownerUserId: deals.ownerUserId })
      .from(deals)
      .where(and(eq(deals.id, datos.dealId), incluyendoAnulados(deals)));
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    if (!trabajaLeads(ctx.actor) || !puedeTrabajarDeal(ctx.actor, deal)) {
      throw new ErrorDeApp("Solo el dueño del deal puede crear una plataforma para sus abonos.", 403);
    }
    const plataforma = await crearOVincularPlataforma(
      db,
      { id: ctx.actor.userId, rol: ctx.actor.rol },
      datos.nombre,
      deal.programId,
    );
    return { plataforma: { id: plataforma.id, nombre: String(plataforma.nombre) } };
  });
}

const esquemaCambiarPlataformaDeAbonoAccion = z.object({
  abonoId: id("Abono inválido."),
  plataformaId: id("Plataforma inválida.").nullable(),
});
export type EntradaCambiarPlataformaDeAbono = z.input<typeof esquemaCambiarPlataformaDeAbonoAccion>;

export async function cambiarPlataformaDeAbonoAccion(
  entrada: EntradaCambiarPlataformaDeAbono,
): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const datos = esquemaCambiarPlataformaDeAbonoAccion.parse(entrada);
    await exigirAbonoVisible(ctx, datos.abonoId);
    await cambiarPlataformaDeAbono(db, ctx.actor, datos);
    return {};
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

const esquemaPedirSubidaComprobanteAccion = z.object({
  abonoId: id("Abono inválido."),
  tipoMime: z.enum(TIPOS_PERMITIDOS, { error: "El tipo de archivo no está permitido." }),
  bytes: z.number().int().positive("El archivo debe tener contenido.").max(MAX_BYTES, "El archivo supera 5 MB."),
});
export type EntradaPedirSubidaComprobante = z.input<typeof esquemaPedirSubidaComprobanteAccion>;

export async function pedirSubidaComprobanteAccion(
  entrada: EntradaPedirSubidaComprobante,
): Promise<ResultadoFicha<{ archivoId: string; subida: { url: string; metodo: "PUT"; cabeceras: Record<string, string> } }>> {
  return correr(async (ctx) => {
    const datos = esquemaPedirSubidaComprobanteAccion.parse(entrada);
    await exigirAbonoVisible(ctx, datos.abonoId);
    const [fila] = await db
      .select({ abono: { programId: abonos.programId }, deal: deals })
      .from(abonos)
      .innerJoin(deals, eq(deals.id, abonos.dealId))
      .where(and(eq(abonos.id, datos.abonoId), vigente(abonos), incluyendoAnulados(deals)));
    if (!fila) throw new ErrorDeApp("No existe el abono vigente.", 404);
    if (!puedeTrabajarDeal(ctx.actor, fila.deal)) {
      throw new ErrorDeApp("Solo el dueño del deal puede adjuntar el comprobante.", 403);
    }
    return pedirSubida(db, almacenDeArchivos(), {
      programId: fila.abono.programId,
      tipoMime: datos.tipoMime,
      bytes: datos.bytes,
      actorId: ctx.actor.userId,
    });
  });
}

const esquemaConfirmarComprobanteAccion = z.object({
  abonoId: id("Abono inválido."),
  archivoId: id("Archivo inválido."),
});
export type EntradaConfirmarComprobante = z.input<typeof esquemaConfirmarComprobanteAccion>;

export async function confirmarComprobanteAccion(
  entrada: EntradaConfirmarComprobante,
): Promise<ResultadoFicha> {
  return correr(async (ctx) => {
    const datos = esquemaConfirmarComprobanteAccion.parse(entrada);
    await exigirAbonoVisible(ctx, datos.abonoId);
    await confirmarArchivo(db, almacenDeArchivos(), { archivoId: datos.archivoId, actorId: ctx.actor.userId });
    await adjuntarComprobante(db, ctx.actor, datos);
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
  }, ROLES_ONBOARDING);
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
  }, ROLES_ONBOARDING);
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

// El botón "Resultado" de una cita (ticket 177; vuelve el 9-oct a pedido de los closers, A-137):
// Show, No show, Cancelada o Reagendada desde la llamada misma, además de Anotar.

const esquemaMarcarShow = z.object({ callId: id("Llamada inválida.") });
export type EntradaMarcarShow = z.input<typeof esquemaMarcarShow>;

/** Marcar una llamada como show en un clic, sin pegar el link de Grain. */
export async function marcarShowAccion(entrada: EntradaMarcarShow): Promise<ResultadoFicha<{ etapa: string; movioAAtendido: boolean }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { callId } = esquemaMarcarShow.parse(entrada);
    await exigirLlamadaVisible(ctx, callId);
    const r = await marcarShow(db, actor, { callId });
    return { etapa: r.etapa, movioAAtendido: r.movioAAtendido };
  });
}

const esquemaReagendar = z.object({
  callId: id("Llamada inválida."),
  dia,
  hora,
  notas: textoOpcional(z.string().max(2000)),
});
export type EntradaReagendar = z.input<typeof esquemaReagendar>;

/** Cierra la cita vieja (`reagendada`) y crea la nueva en la misma transacción (`reagendarLlamada`). */
export async function reagendarLlamadaAccion(entrada: EntradaReagendar): Promise<ResultadoFicha<{ movioAAgendado: boolean; cancelacionPendiente: boolean }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { callId, dia: d, hora: h, notas } = esquemaReagendar.parse(entrada);
    await exigirLlamadaVisible(ctx, callId);
    const [llamada] = await db.select({ dealId: calls.dealId }).from(calls).where(and(eq(calls.id, callId), vigente(calls)));
    if (!llamada?.dealId) throw new ErrorDeApp("La llamada no pertenece a un deal.", 409);
    const cita = await reservarParaDeal(llamada.dealId, instante(d, h));
    const r = await reagendarLlamada(db, actor, { callId, cita, notas });
    return { movioAAgendado: r.movioAAgendado, cancelacionPendiente: r.cancelacionPendiente };
  });
}

const esquemaFallida = z.object({
  callId: id("Llamada inválida."),
  resultado: z.enum(RESULTADOS_FALLIDOS),
  motivoId: textoOpcional(id("Motivo inválido.")),
});
export type EntradaMarcarFallida = z.input<typeof esquemaFallida>;

export async function marcarFallidaAccion(entrada: EntradaMarcarFallida): Promise<ResultadoFicha<{ etapa: string; cancelacionPendiente: boolean }>> {
  return correr(async (ctx) => {
    const { actor } = ctx;
    const { callId, resultado, motivoId } = esquemaFallida.parse(entrada);
    await exigirLlamadaVisible(ctx, callId);
    const r = await marcarFallida(db, actor, { callId, resultado, motivoId });
    return { etapa: r.etapa, cancelacionPendiente: r.cancelacionPendiente ?? false };
  });
}

export type EntradaCorregirResultado = DatosCorregirResultado;

export async function corregirResultadoAccion(entrada: EntradaCorregirResultado): Promise<ResultadoFicha<{ etapa: string }>> {
  return correr(async (ctx) => {
    const datos = esquemaCorregirResultado.parse(entrada);
    await exigirLlamadaVisible(ctx, datos.callId);
    return corregirResultado(db, ctx.actor, datos);
  });
}

async function reservarParaDeal(dealId: string, fecha: Date): Promise<CitaReservada> {
  const [invitado] = await db
    .select({ nombre: leads.nombre, correo: leads.emailNormalizado })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), vigente(deals)));
  if (!invitado?.correo) throw new ErrorDeApp("El lead no tiene correo para reservar en Calendly.", 422);
  const evento = await eventoParaAgendar(db, dealId);
  return reservarCita(evento.token, {
    eventTypeUri: evento.eventTypeUri,
    startTime: fecha,
    invitado: { nombre: invitado.nombre ?? invitado.correo, correo: invitado.correo },
    conLocation: evento.conLocation,
    tracking: evento.tracking,
  });
}

async function exigirSinCitaAgendada(dealId: string): Promise<void> {
  const [activa] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.dealId, dealId), eq(calls.resultado, "agendada"), vigente(calls)));
  if (activa) throw new ErrorDeApp("El deal ya tiene una cita agendada.", 409);
}

const esquemaHoras = z.object({ dealId: id("Deal inválido."), desde: z.date(), hasta: z.date() });

export async function horasDisponiblesAccion(entrada: z.input<typeof esquemaHoras>): Promise<ResultadoFicha<{ horas: string[]; etiqueta: string }>> {
  return correr(async (ctx) => {
    const datos = esquemaHoras.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    const evento = await eventoParaAgendar(db, datos.dealId);
    const horas = await horasDisponibles(evento.token, evento.eventTypeUri, datos.desde, datos.hasta);
    return { horas: horas.map((fecha) => fecha.toISOString()), etiqueta: evento.etiqueta };
  });
}

const esquemaAgendar = z.object({ dealId: id("Deal inválido."), fecha: z.date(), notas: textoOpcional(z.string().max(2000)) });

export async function agendarLlamadaAccion(entrada: z.input<typeof esquemaAgendar>): Promise<ResultadoFicha<{ movioAAgendado: boolean }>> {
  return correr(async (ctx) => {
    const datos = esquemaAgendar.parse(entrada);
    await exigirDealVisible(ctx, datos.dealId);
    await exigirSinCitaAgendada(datos.dealId);
    const cita = await reservarParaDeal(datos.dealId, datos.fecha);
    const resultado = await agregarLlamada(db, ctx.actor, { dealId: datos.dealId, cita, notas: datos.notas });
    return { movioAAgendado: resultado.movioAAgendado };
  });
}
