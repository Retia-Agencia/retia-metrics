"use server";

import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { buscarPersonas, type PersonaEncontrada } from "@/lib/queries/personas";

export type ResultadoBusqueda =
  | { ok: true; personas: PersonaEncontrada[] }
  | { ok: false; error: string };

/**
 * Busca personas por nombre o correo (ticket 003).
 *
 * Vive aca y no en `mi-dia/` porque la usan DOS pantallas y quien puede buscar
 * tiene que ser UNA sola regla. Estaba en
 * `mi-dia/acciones.ts` con `requireRole("closer")`, asi que un gerente no podia
 * invocarla; sumado a que el buscador filtraba por membresia, un gerente no tenia
 * ninguna forma de abrir el historial de un lead (18-sep).
 *
 * El ALCANCE no se decide aca: `buscarPersonas` recibe el rol y decide contra que
 * programas busca (administrador: todos los activos; closer: sus membresias). La
 * accion solo dice quien puede entrar.
 *
 * El rol que se le pasa es el ROL DE VISTA, no `session.user.rol` crudo (ticket 028):
 * un developer en vista `closer` busca SOLO en sus membresias, no en todos los
 * programas. En vista `todo` o `gerente` (administrador) sigue viendo todos los
 * activos. Estrechar nunca ensancha: un closer real ignora la vista.
 *
 * El texto NO va a la URL: es un dato personal (correo, nombre) y AGENTS.md prohibe
 * datos personales en URLs y query strings. Por eso la busqueda es una server action
 * invocada desde el componente cliente con el texto en estado local, y los resultados
 * viajan en el payload, no en la barra de direcciones.
 */
export async function buscarPersonasAccion(texto: string): Promise<ResultadoBusqueda> {
  try {
    const session = await requireRole("gerente", "closer");
    const personas = await buscarPersonas(session.user.id, await rolDeVista(session), texto, db);
    return { ok: true, personas };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Petición inválida." };
    }
    console.error("[buscarPersonas] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}
