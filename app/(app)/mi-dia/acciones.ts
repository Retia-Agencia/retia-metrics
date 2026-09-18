"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { registrarLlamada, type EntradaRegistroLlamada } from "@/lib/mutations/registro";
import { registrarAbono, type EntradaRegistroAbono } from "@/lib/mutations/abonos";
import {
  asignarResponsable,
  crearPersonaManual,
  type Actor,
  type EntradaPersonaManual,
} from "@/lib/mutations/personas";
import { buscarPersonas, ventasDePersona, type PersonaEncontrada, type VentaDePersona } from "@/lib/queries/personas";

/**
 * Server actions de la pantalla `/mi-dia` (ticket 003, ADR 0003, 0011, 0015, 0021).
 *
 * Son la unica cara publica de las lecturas y mutaciones de esta pantalla. Toda
 * accion enforza `requireRole("closer")` en el servidor: `/mi-dia` es del closer y
 * el gerente NO registra (ADR 0003), ni siquiera la asignacion de responsable. La
 * barrera es de servidor, no de UI (esconder un boton no es seguridad).
 *
 * Se traduce cualquier error al contrato de `lib/errors`: el resultado es
 * serializable y nunca se lanza al cliente, porque una server action se invoca por
 * red y una excepcion no viaja con su tipo (mismo patron que `productos/acciones.ts`).
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
export type ResultadoBusqueda =
  | { ok: true; personas: PersonaEncontrada[] }
  | { ok: false; error: string };
export type ResultadoVentas =
  | { ok: true; ventas: VentaDePersona[] }
  | { ok: false; error: string };

function aResultado(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  if (error instanceof ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Petición inválida." };
  }
  console.error("[mi-dia] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/** Arma el actor de las mutaciones de personas desde la sesion ya validada. */
function actorDe(session: Session): Actor {
  const rol = session.user.rol;
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { id: session.user.id, rol, closerId: session.user.closerId };
}

/**
 * Un dia de calendario 'YYYY-MM-DD' de un `<input type="date">` a `Date`, anclado al
 * MEDIODIA de Bogota: `new Date('YYYY-MM-DDT12:00:00-05:00')`.
 *
 * La conversion vive aca y no en la mutacion (que pide `z.date()` y no se toca): con
 * `new Date('2026-09-20')` el string se interpreta como medianoche UTC, que en Bogota
 * (UTC-5) cae el 19 — el compromiso de pago quedaria un dia antes del prometido. El
 * mediodia deja margen de 12 horas a cada lado, asi que el dia en Bogota nunca corre.
 * Un texto vacio o ausente queda como `undefined` (el campo es opcional).
 */
function fechaDeBogota(dia: string | undefined): Date | undefined {
  if (!dia) return undefined;
  return new Date(`${dia}T12:00:00-05:00`);
}

/**
 * Lo que llega del formulario: las fechas como texto 'YYYY-MM-DD' (lo que manda un
 * `<input type="date">`), no como `Date`. La accion las convierte antes de pasarlas
 * a la mutacion.
 */
export interface EntradaRegistroLlamadaUI
  extends Omit<EntradaRegistroLlamada, "fechaAgenda" | "fechaLlamada" | "fechaSeguimiento"> {
  fechaAgenda?: string;
  fechaLlamada?: string;
  fechaSeguimiento?: string;
}

/**
 * Busca personas por nombre o correo (ticket 003).
 *
 * El texto NO va a la URL: es un dato personal (correo, nombre) y AGENTS.md prohibe
 * datos personales en URLs y query strings. Por eso la busqueda es una server action
 * invocada desde el componente cliente con el texto en estado local, y los resultados
 * viajan en el payload, no en la barra de direcciones.
 */
export async function buscarPersonasAccion(texto: string): Promise<ResultadoBusqueda> {
  try {
    const session = await requireRole("closer");
    const personas = await buscarPersonas(session.user.id, texto, db);
    return { ok: true, personas };
  } catch (error) {
    return aResultado(error);
  }
}

/** Registra una llamada (y su venta + primer abono si cerro). */
export async function registrarLlamadaAccion(
  input: EntradaRegistroLlamadaUI,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("closer");
    const entrada: EntradaRegistroLlamada = {
      ...input,
      fechaAgenda: fechaDeBogota(input.fechaAgenda),
      fechaLlamada: fechaDeBogota(input.fechaLlamada),
      fechaSeguimiento: fechaDeBogota(input.fechaSeguimiento),
    };
    await registrarLlamada(session, entrada, db);
    revalidatePath("/mi-dia");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/** Las ventas de una persona con lo abonado y el saldo, para registrar un abono. */
export async function ventasDePersonaAccion(personId: string): Promise<ResultadoVentas> {
  try {
    await requireRole("closer");
    const ventas = await ventasDePersona(personId, db);
    return { ok: true, ventas };
  } catch (error) {
    return aResultado(error);
  }
}

/** Registra un abono sobre una venta que ya existe. */
export async function registrarAbonoAccion(
  input: EntradaRegistroAbono,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("closer");
    await registrarAbono(session, input, db);
    revalidatePath("/mi-dia");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Toma una persona sin responsable: el closer logueado queda como su responsable.
 * El `closerId` se copia de la sesion (ADR 0011); el closer nunca lo elige.
 */
export async function tomarPersonaAccion(personaId: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("closer");
    const actor = actorDe(session);
    if (!actor.closerId) {
      throw new ErrorDeApp("Tu cuenta no tiene closerId cargado.", 400);
    }
    await asignarResponsable(db, actor, { personaId, closerId: actor.closerId });
    revalidatePath("/mi-dia");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/** Crea a mano una persona que no paso por el formulario (WhatsApp, masivos). */
export async function crearPersonaAccion(
  input: EntradaPersonaManual,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("closer");
    await crearPersonaManual(db, actorDe(session), input);
    revalidatePath("/mi-dia");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
