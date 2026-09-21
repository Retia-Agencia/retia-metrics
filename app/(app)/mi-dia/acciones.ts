"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { registrarLlamada, type EntradaRegistroLlamada } from "@/lib/mutations/registro";
import { registrarAbono, type EntradaRegistroAbono } from "@/lib/mutations/abonos";
import {
  crearPersonaManual,
  type Actor,
  type EntradaPersonaManual,
} from "@/lib/mutations/personas";
import { ventasDePersona, type VentaDePersona } from "@/lib/queries/personas";

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
/**
 * El alta manual dice ademas si CREO la persona o si el correo ya existia. El error
 * es la misma forma que `ResultadoAccion`, asi que `aResultado` sirve sin cambios.
 */
export type ResultadoAlta = { ok: true; creada: boolean } | { ok: false; error: string };
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

/**
 * Arma el actor de las mutaciones de personas desde la sesion ya validada.
 *
 * El rol del actor sale de `rolDeVista`, NO de `session.user.rol` (ticket 028): un
 * developer en vista `closer` ES un closer para la capa de mutaciones —crea persona,
 * la toma, registra— y en vista `gerente` vuelve a tener prohibido registrar
 * (ADR 0003), porque `requireRole("closer")` ya lo habria rechazado antes de llegar
 * aca. El `closerId` sigue saliendo de la sesion (ADR 0011): la vista no lo inventa.
 */
async function actorDe(session: Session): Promise<Actor> {
  const rol = await rolDeVista(session);
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
 * Crea a mano una persona que no paso por el formulario (WhatsApp, masivos).
 *
 * Devuelve `creada` para que la pantalla NO confirme un alta que no ocurrio: si el
 * correo ya existia en ese programa, el dedup devuelve la fila de siempre sin tocar
 * nada, y decir "Persona creada" ahi haria creer al closer que su nombre se guardo.
 */
export async function crearPersonaAccion(
  input: EntradaPersonaManual,
): Promise<ResultadoAlta> {
  try {
    const session = await requireRole("closer");
    const { creada } = await crearPersonaManual(db, await actorDe(session), input);
    revalidatePath("/mi-dia");
    return { ok: true, creada };
  } catch (error) {
    return aResultado(error);
  }
}
