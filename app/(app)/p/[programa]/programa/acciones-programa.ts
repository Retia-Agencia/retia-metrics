"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import type { Session } from "next-auth";
import { requireAdministracionGlobal, requireRole } from "@/lib/auth/guards";
import { exigirAccesoAlPrograma } from "@/lib/catalogo/acceso-programa";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { cohorts, miembrosPrograma, programs } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearPrograma,
  desactivarPrograma,
  editarPrograma,
  reactivarPrograma,
  type EntradaPrograma,
} from "@/lib/catalogo/programas";
import { conectarCalendly } from "@/lib/calendly/suscripcion";
import { agregarMembresia, quitarMembresia } from "@/lib/catalogo/usuarios";
import { marcarSetterPorDefecto } from "@/lib/deals/setter-por-defecto";
import { fichaDelPrograma, faltaParaActivar } from "@/lib/queries/ficha-programa";
import {
  activarCohorte,
  crearCohorte,
  desactivarCohorte,
  editarCohorte,
  type EntradaCohorte,
} from "@/lib/catalogo/cohortes";

/**
 * Server actions de la administracion de programas y cohortes (ticket 014). Viven en la
 * tab Programa (`/p/[programa]/programa`, ADR 0077: cada dato vive en la pantalla de su
 * objeto); antes vivian en la seccion Programas de Ajustes.
 *
 * Son la unica cara publica: enforzan `requireRole("gerente")` en el servidor
 * (ADR 0003: un closer nunca entra, esconder un boton no es seguridad), envuelven la
 * logica pura de `lib/catalogo/{programas,cohortes}` con la base real, y traducen
 * cualquier error al contrato de lib/errors. El resultado es serializable — nunca se
 * lanza al cliente — porque las server actions se invocan por red y una excepcion no
 * viaja con su tipo (mismo patron que las acciones de catalogos y usuarios).
 *
 * Se revalida la pagina del programa tocado y la raiz `/` para que el sidebar (010),
 * que lee los programas activos de la base, refleje un alta o una baja sin desplegar.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): ResultadoAccion {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[programas] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

/**
 * Revalida las rutas que dependen de la lista de programas (incluido el sidebar). Ya
 * no hay una pagina propia de la lista: todo vive en la tab Programa.
 */
function revalidarNav() {
  revalidatePath("/", "layout");
  revalidatePath("/p/[programa]/programa", "page");
}

async function actorGerente(): Promise<{ session: Session; rol: NonNullable<Awaited<ReturnType<typeof rolDeVista>>> }> {
  const session = await requireRole("gerente");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  return { session, rol };
}

async function exigirProgramaVisible(
  actor: Awaited<ReturnType<typeof actorGerente>>,
  programId: string | undefined,
): Promise<void> {
  // `exigirAccesoAlPrograma` y no `programaEnAlcance`: este decide por alcance sin mirar si el
  // programa esta activo, y la ficha configura y activa programas inactivos (ADR 0094 punto 4).
  if (!programId) throw new ErrorDeApp("No existe el programa.", 404);
  await exigirAccesoAlPrograma(db, { id: actor.session.user.id, rol: actor.rol }, programId, "No puedes administrar este programa.");
}

async function exigirProgramaPorId(actor: Awaited<ReturnType<typeof actorGerente>>, id: string): Promise<void> {
  const [programa] = await db.select({ programId: programs.id }).from(programs).where(eq(programs.id, id));
  await exigirProgramaVisible(actor, programa?.programId);
}

async function exigirProgramaDeCohorte(actor: Awaited<ReturnType<typeof actorGerente>>, id: string): Promise<void> {
  const [cohorte] = await db.select({ programId: cohorts.programId }).from(cohorts).where(eq(cohorts.id, id));
  await exigirProgramaVisible(actor, cohorte?.programId);
}

async function exigirProgramaDeMembresia(
  actor: Awaited<ReturnType<typeof actorGerente>>,
  input: { userId: string; programId: string },
): Promise<void> {
  const [membresia] = await db
    .select({ programId: miembrosPrograma.programId })
    .from(miembrosPrograma)
    .where(and(eq(miembrosPrograma.userId, input.userId), eq(miembrosPrograma.programId, input.programId)));
  await exigirProgramaVisible(actor, membresia?.programId);
}

type EntradaProgramaNuevo = Pick<EntradaPrograma, "nombre" | "slug" | "ticketUsd">;
type ResultadoCreacion = { ok: true; slug: string } | { ok: false; error: string };

/** Crea el cascaron inactivo; se completa y activa desde su propia ficha. */
export async function crearProgramaInactivoAccion(
  input: EntradaProgramaNuevo,
): Promise<ResultadoCreacion> {
  try {
    const session = await requireAdministracionGlobal();
    const programa = await crearPrograma(db, session.user.id, input);
    revalidarNav();
    return { ok: true, slug: String(programa.slug) };
  } catch (error) {
    const resultado = aResultado(error);
    return resultado.ok ? { ok: false, error: "Error interno." } : resultado;
  }
}

/** Edita únicamente los datos generales; los secretos viven en Integraciones. */
export async function editarProgramaAccion(
  id: string,
  input: EntradaPrograma,
): Promise<ResultadoAccion> {
  try {
    const { session, ...actor } = await actorGerente();
    await exigirProgramaPorId({ session, ...actor }, id);
    await editarPrograma(db, session.user.id, id, input);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarProgramaAccion(id: string): Promise<ResultadoAccion> {
  try {
    const { session, ...actor } = await actorGerente();
    await exigirProgramaPorId({ session, ...actor }, id);
    await desactivarPrograma(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarProgramaAccion(id: string): Promise<ResultadoAccion> {
  try {
    const { session, ...actor } = await actorGerente();
    await exigirProgramaPorId({ session, ...actor }, id);
    await reactivarPrograma(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/** La ficha vuelve a comprobar todos los requisitos antes de activar. */
export async function activarProgramaDesdeFichaAccion(id: string): Promise<ResultadoAccion> {
  try {
    const { session, ...actor } = await actorGerente();
    await exigirProgramaPorId({ session, ...actor }, id);
    const ficha = await fichaDelPrograma(id, db);
    if (!ficha) throw new ErrorDeApp("No existe el programa.", 404);
    const faltan = faltaParaActivar(ficha.programa);
    if (faltan.length > 0) {
      throw new ErrorDeApp(
        `No se puede activar: falta ${faltan.map((item) => item.texto).join(", ")}.`,
        422,
      );
    }
    await reactivarPrograma(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function agregarAlProgramaAccion(input: {
  userId: string;
  programId: string;
}): Promise<ResultadoAccion> {
  try {
    const session = await requireAdministracionGlobal();
    await agregarMembresia(db, session.user.id, input.userId, input.programId);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function quitarDelProgramaAccion(input: {
  userId: string;
  programId: string;
}): Promise<ResultadoAccion> {
  try {
    const actor = await actorGerente();
    await exigirProgramaDeMembresia(actor, input);
    const { session } = actor;
    await quitarMembresia(db, session.user.id, input.userId, input.programId);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function marcarSetterPorDefectoAccion(input: {
  programId: string;
  userId: string | null;
}): Promise<ResultadoAccion> {
  try {
    const actor = await actorGerente();
    if (input.userId) await exigirProgramaDeMembresia(actor, { userId: input.userId, programId: input.programId });
    else await exigirProgramaPorId(actor, input.programId);
    const { session, rol } = actor;
    await marcarSetterPorDefecto(db, { userId: session.user.id, rol }, input);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * "Conectar Calendly" (ticket 096): crea (o rehace) la suscripcion del webhook de Calendly
 * del programa con su token y guarda la clave de firma. La URL publica sale de `AUTH_URL`,
 * nunca del navegador: desde local no se conecta produccion por accidente.
 */
export async function conectarCalendlyAccion(id: string): Promise<ResultadoAccion> {
  try {
    const actor = await actorGerente();
    await exigirProgramaPorId(actor, id);
    const { session } = actor;
    await conectarCalendly(db, session.user.id, id, { urlBase: process.env.AUTH_URL });
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

// ─────────────────────────────────────────────────────────── cohortes

export async function crearCohorteAccion(
  slug: string,
  input: EntradaCohorte,
): Promise<ResultadoAccion> {
  try {
    const actor = await actorGerente();
    await exigirProgramaPorId(actor, input.programId);
    const { session } = actor;
    await crearCohorte(db, session.user.id, input);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function editarCohorteAccion(
  slug: string,
  id: string,
  input: EntradaCohorte,
): Promise<ResultadoAccion> {
  try {
    const actor = await actorGerente();
    await exigirProgramaDeCohorte(actor, id);
    const { session } = actor;
    await editarCohorte(db, session.user.id, id, input);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function activarCohorteAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    const actor = await actorGerente();
    await exigirProgramaDeCohorte(actor, id);
    const { session } = actor;
    await activarCohorte(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarCohorteAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    const actor = await actorGerente();
    await exigirProgramaDeCohorte(actor, id);
    const { session } = actor;
    await desactivarCohorte(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
