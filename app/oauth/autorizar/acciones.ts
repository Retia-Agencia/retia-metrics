"use server";

import { redirect } from "next/navigation";
import { requireSesionReal } from "@/lib/auth/guards";
import { AuthorizationError } from "@/lib/auth/roles";
import { rolRealDeSesion, sesionEfectiva } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeAutorizar, validarPeticionDeAutorizar } from "@/lib/oauth/autorizar";
import { crearCodigoDeAutorizacion } from "@/lib/oauth/codigos";
import { issuer } from "@/lib/oauth/origen";
import { scopeConcedido } from "@/lib/oauth/scope";

function parametros(formData: FormData): Record<string, string> {
  return Object.fromEntries([
    "client_id", "redirect_uri", "response_type", "code_challenge_method",
    "code_challenge", "resource", "scope", "state",
  ].flatMap((clave) => {
    const valor = formData.get(clave);
    return typeof valor === "string" ? [[clave, valor]] : [];
  }));
}

function destino(redirectUri: string, valores: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [clave, valor] of Object.entries(valores)) if (valor !== undefined) url.searchParams.set(clave, valor);
  return url.toString();
}

function redirigirError(error: ErrorDeAutorizar): never {
  if (!error.redirigir || !error.redirectUri) throw error;
  redirect(destino(error.redirectUri, {
    error: error.codigo,
    error_description: error.message,
    state: error.state,
    iss: issuer(),
  }));
}

async function contexto(formData: FormData) {
  const real = await requireSesionReal();
  const efectiva = await sesionEfectiva(real);
  if (efectiva.user.suplantadoPor) {
    throw new AuthorizationError("Termina de ver como otra persona antes de conectar una IA.");
  }
  const rolReal = rolRealDeSesion(real);
  if (!rolReal) throw new AuthorizationError();
  let peticion: Awaited<ReturnType<typeof validarPeticionDeAutorizar>>;
  try {
    peticion = await validarPeticionDeAutorizar(db, parametros(formData));
  } catch (error) {
    if (error instanceof ErrorDeAutorizar) redirigirError(error);
    throw error;
  }
  return { real, rolReal, peticion };
}

export async function permitirConexion(formData: FormData): Promise<never> {
  const { real, rolReal, peticion } = await contexto(formData);
  const scope = scopeConcedido(rolReal, peticion.scopePedido);
  const code = await crearCodigoDeAutorizacion(db, {
    userId: real.user.id,
    clientId: peticion.cliente.clientId,
    redirectUri: peticion.redirectUri,
    codeChallenge: peticion.codeChallenge!,
    scope,
    resource: peticion.resource,
  });
  redirect(destino(peticion.redirectUri, { code, state: peticion.state, iss: issuer() }));
}

export async function cancelarConexion(formData: FormData): Promise<never> {
  const { peticion } = await contexto(formData);
  redirect(destino(peticion.redirectUri, {
    error: "access_denied",
    state: peticion.state,
    iss: issuer(),
  }));
}
