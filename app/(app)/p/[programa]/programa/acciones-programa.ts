"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearPrograma,
  desactivarPrograma,
  editarPrograma,
  guardarTokenCalendly,
  reactivarPrograma,
  type EntradaPrograma,
} from "@/lib/catalogo/programas";
import { conectarCalendly } from "@/lib/calendly/suscripcion";
import { agregarMembresia, quitarMembresia } from "@/lib/catalogo/usuarios";
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

type EntradaProgramaNuevo = Pick<EntradaPrograma, "nombre" | "slug" | "ticketUsd">;
type ResultadoCreacion = { ok: true; slug: string } | { ok: false; error: string };

/** Crea el cascaron inactivo; se completa y activa desde su propia ficha. */
export async function crearProgramaInactivoAccion(
  input: EntradaProgramaNuevo,
): Promise<ResultadoCreacion> {
  try {
    const session = await requireRole("gerente");
    const programa = await crearPrograma(db, session.user.id, input);
    revalidarNav();
    return { ok: true, slug: String(programa.slug) };
  } catch (error) {
    const resultado = aResultado(error);
    return resultado.ok ? { ok: false, error: "Error interno." } : resultado;
  }
}

/**
 * Crea un programa con su Calendly Token. El token NO viaja por la entrada del molde
 * (ADR 0057): se guarda aparte con `guardarTokenCalendly`. El programa queda INACTIVO:
 * activarlo exige fuente principal (ADR 0068), y un programa recien creado no tiene
 * fuentes. Se activa desde su ficha, por `reactivarPrograma`. Ninguna pantalla la llama hoy
 * (la creación usa `crearProgramaInactivoAccion`); queda para crear con token de una vez.
 */
export async function crearProgramaAccion(
  input: EntradaPrograma,
  tokenCalendly: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    const programa = await crearPrograma(db, session.user.id, input);
    await guardarTokenCalendly(db, session.user.id, programa.id, tokenCalendly);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

/**
 * Edita un programa. `tokenCalendly` vacio = conservar el que tiene; con valor, lo
 * reemplaza por `guardarTokenCalendly` (nunca por el molde, ADR 0057).
 */
export async function editarProgramaAccion(
  id: string,
  input: EntradaPrograma,
  tokenCalendly: string,
): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await editarPrograma(db, session.user.id, id, input);
    if (tokenCalendly.trim()) {
      await guardarTokenCalendly(db, session.user.id, id, tokenCalendly);
    }
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarProgramaAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarPrograma(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function reactivarProgramaAccion(id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
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
    const session = await requireRole("gerente");
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
    const session = await requireRole("gerente");
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
    const session = await requireRole("gerente");
    await quitarMembresia(db, session.user.id, input.userId, input.programId);
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
    const session = await requireRole("gerente");
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
    const session = await requireRole("gerente");
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
    const session = await requireRole("gerente");
    await editarCohorte(db, session.user.id, id, input);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function activarCohorteAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await activarCohorte(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

export async function desactivarCohorteAccion(slug: string, id: string): Promise<ResultadoAccion> {
  try {
    const session = await requireRole("gerente");
    await desactivarCohorte(db, session.user.id, id);
    revalidarNav();
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}
