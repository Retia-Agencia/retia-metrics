"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";
import { requireSession } from "@/lib/auth/guards";
import { AuthorizationError, puedeConectarIa, puedeCrearTokenPersonal, trabajaLeads } from "@/lib/auth/roles";
import { rolDeVista, rolRealDeSesion } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import {
  asignarCalendlyDeMembresia,
  type EntradaCalendlyDeMembresia,
} from "@/lib/catalogo/usuarios";
import {
  abrirNovedadCalendly,
  marcarNovedadCalendlyVista,
} from "@/lib/notificaciones-calendly/notificaciones";
import {
  emitirTokenPersonal,
  esMcpScope,
  listarTokensPersonales,
  revocarToken,
  type McpScope,
} from "@/lib/mcp/token";
import { comandoParaClaudeMcp } from "@/lib/mcp/enlaces";
import { revocarConexionOauthPropia } from "@/lib/oauth/conexiones";

/**
 * Server actions de Mi espacio (ticket 172). Lo único que se edita del propio usuario es
 * la cuenta de Calendly por membresía (nombre, foto, rol y `closer_id` no se tocan aquí).
 *
 * La reja real está en el servidor: `requireSession` ya rechaza TODA escritura cuando la
 * vista está suplantando a un closer (solo lectura, ticket 172), y `trabajaLeads` sobre
 * el ROL DE VISTA decide quién tiene cuenta de Calendly. El objetivo es siempre la propia
 * membresía (el id sale de la sesión), así que no se puede tocar la de otro.
 */

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function aResultado(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[mi-espacio] error no controlado", error);
  return { ok: false, error: "Error interno." };
}

function aResultadoMcp(error: unknown): { ok: false; error: string } {
  if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Revisa los datos." };
  return aResultado(error);
}

async function exigirConexionIa() {
  const session = await requireSession();
  if (!puedeConectarIa(rolRealDeSesion(session))) {
    throw new AuthorizationError("No tienes permiso para administrar conexiones de IA.");
  }
  return session;
}

async function exigirTokenPersonal() {
  const session = await requireSession();
  if (!puedeCrearTokenPersonal(rolRealDeSesion(session))) {
    throw new AuthorizationError("No tienes permiso para crear claves personales.");
  }
  return session;
}

const entradaTokenPersonal = z.object({
  nombre: z.string().trim().min(1, "Escribe un nombre para reconocer esta conexión.").max(80),
  scope: z.custom<McpScope>(esMcpScope, { message: "El permiso elegido no es válido." }),
}).strict();

export type ResultadoEmitirToken =
  | { ok: true; token: { valor: string; comando: string } }
  | { ok: false; error: string };

export async function emitirMiTokenAccion(input: unknown): Promise<ResultadoEmitirToken> {
  try {
    const session = await exigirTokenPersonal();
    const entrada = entradaTokenPersonal.parse(input);
    const token = await emitirTokenPersonal(db, {
      userId: session.user.id,
      actorId: session.user.id,
      nombre: entrada.nombre,
      scope: entrada.scope,
    });
    revalidatePath("/mi-espacio");
    return {
      ok: true,
      token: { valor: token.valor, comando: comandoParaClaudeMcp(token.valor) },
    };
  } catch (error) {
    return aResultadoMcp(error);
  }
}

export async function revocarMiTokenAccion(tokenId: string): Promise<ResultadoAccion> {
  try {
    const session = await exigirTokenPersonal();
    const id = z.string().uuid("La conexión no es válida.").parse(tokenId);
    const propios = await listarTokensPersonales(db, session.user.id);
    if (!propios.some((token) => token.id === id)) {
      throw new AuthorizationError("Solo puedes revocar tus propias conexiones.");
    }
    await revocarToken(db, { tokenId: id, actorId: session.user.id });
    revalidatePath("/mi-espacio");
    return { ok: true };
  } catch (error) {
    return aResultadoMcp(error);
  }
}

export async function desconectarMiConexionAccion(tokenId: string): Promise<ResultadoAccion> {
  try {
    const session = await exigirConexionIa();
    const id = z.string().uuid("La conexion no es valida.").parse(tokenId);
    await revocarConexionOauthPropia(db, { tokenId: id, userId: session.user.id });
    revalidatePath("/mi-espacio");
    return { ok: true };
  } catch (error) {
    return aResultadoMcp(error);
  }
}

export async function asignarMiCalendlyAccion(
  input: EntradaCalendlyDeMembresia,
): Promise<ResultadoAccion> {
  try {
    const session = await requireSession();
    const rol = await rolDeVista(session);
    if (!trabajaLeads({ rol, operaComoCloser: session.user.operaComoCloser })) {
      throw new AuthorizationError("Solo quien trabaja leads tiene cuenta de Calendly.");
    }
    await asignarCalendlyDeMembresia(db, session.user.id, input);
    revalidatePath("/mi-espacio");
    revalidatePath("/ajustes/usuarios");
    return { ok: true };
  } catch (error) {
    return aResultado(error);
  }
}

const idNotificacion = z.string().uuid("La notificación no es válida.");
const idPrograma = z.string().uuid("El programa no es válido.");

/** El id objetivo se cruza contra el usuario de la sesión: no se marca la fila de otro. */
export async function marcarNovedadCalendlyVistaAccion(formData: FormData): Promise<void> {
  const session = await requireSession();
  const notificationId = idNotificacion.parse(formData.get("notificationId"));
  const programId = idPrograma.parse(formData.get("programId"));
  await marcarNovedadCalendlyVista(db, { notificationId, programId, userId: session.user.id });
  revalidatePath("/mi-espacio");
}

/** Abre el Deal resuelto desde la fila propia; ninguna ruta llega confiada desde el cliente. */
export async function abrirNovedadCalendlyAccion(formData: FormData): Promise<void> {
  const session = await requireSession();
  const notificationId = idNotificacion.parse(formData.get("notificationId"));
  const destino = await abrirNovedadCalendly(db, { notificationId, userId: session.user.id });
  if (!destino) throw new ErrorDeApp("La notificación no existe o no es tuya.", 404);
  revalidatePath("/mi-espacio");
  redirect(destino);
}
