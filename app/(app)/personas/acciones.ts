"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { anularRegistro, type EntradaAnulacion } from "@/lib/mutations/anulaciones";
import { buscarPersonas, type PersonaEncontrada } from "@/lib/queries/personas";

/**
 * Server action de la anulacion (ticket 029, ADR 0026). Vive en `personas/` y no en
 * `personas/[id]/` porque la usan DOS pantallas —el historial de la persona y la
 * lista de ventas de `/mi-dia`— y la regla de quien puede anular tiene que ser una
 * sola. `personas/` no tiene `page.tsx`, asi que esto no crea ninguna ruta.
 *
 * La guarda de ruta deja pasar a gerente y closer (y al developer por
 * `esAccesoTotal`, ADR 0025), que son quienes ven el historial. **De quien es el
 * registro y si su cohorte sigue abierta NO se decide aca**: eso es dominio y vive
 * en `anularRegistro` (ADR 0026 punto 6). Repetirlo en la pantalla dejaria dos
 * definiciones de la misma regla, que es como se desincronizan.
 */

export type ResultadoAnular =
  | { ok: true; mensaje: string }
  | { ok: false; error: string };

export async function anularRegistroAccion(entrada: EntradaAnulacion): Promise<ResultadoAnular> {
  try {
    const session = await requireRole("gerente", "closer");
    const { llamadas, ventas, abonos } = await anularRegistro(session, entrada, db);

    // La ruta del historial es dinamica, asi que se invalida por su PATRON y no por
    // un path concreto. `revalidatePath("/personas", "layout")` no coincidia con
    // nada —`personas/` no tiene layout propio— y no invalidaba nada.
    revalidatePath("/personas/[id]", "page");
    // Anular mueve las cifras de las pantallas que las muestran. Sin esto, el cache
    // de ruta del cliente puede servir el dashboard que ya tenia prefetcheado, con
    // la caja de antes de la anulacion.
    revalidatePath("/programas/[slug]", "page");
    revalidatePath("/mi-dia");

    return { ok: true, mensaje: resumen(llamadas, ventas, abonos) };
  } catch (error) {
    if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
    if (error instanceof ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Petición inválida." };
    }
    console.error("[anular] error no controlado", error);
    return { ok: false, error: "Error interno." };
  }
}

/**
 * Dice lo que REALMENTE se anuló, no lo que se pidió: quien anula una llamada
 * cerrada necesita enterarse de que se llevo la venta y sus abonos por delante
 * (ADR 0026 punto 2). Un "Registro anulado" a secas esconderia la cascada.
 */
function resumen(llamadas: number, ventas: number, abonos: number): string {
  const partes = [
    llamadas === 1 ? "la llamada" : null,
    // "su venta" solo cuando cuelga de la llamada que se anulo; si la venta era el
    // objetivo, decir "su" no se refiere a nada.
    ventas === 1 ? (llamadas === 1 ? "su venta" : "la venta") : null,
    abonos === 1 ? "1 abono" : abonos > 1 ? `${abonos} abonos` : null,
  ].filter(Boolean) as string[];

  if (partes.length === 1) return `Se anuló ${partes[0]}.`;
  return `Se anuló ${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}.`;
}

export type ResultadoBusqueda =
  | { ok: true; personas: PersonaEncontrada[] }
  | { ok: false; error: string };

/**
 * Busca personas por nombre o correo (ticket 003).
 *
 * Vive aca y no en `mi-dia/` por la misma razon que la anulacion de arriba: la usan
 * DOS pantallas —`/mi-dia` para elegir sobre quien registrar, y `/personas` para
 * llegar al historial— y quien puede buscar tiene que ser UNA sola regla. Estaba en
 * `mi-dia/acciones.ts` con `requireRole("closer")`, asi que un gerente no podia
 * invocarla; sumado a que el buscador filtraba por membresia, un gerente no tenia
 * ninguna forma de abrir el historial de un lead (18-sep).
 *
 * El ALCANCE no se decide aca: `buscarPersonas` recibe el rol y decide contra que
 * programas busca (administrador: todos los activos; closer: sus membresias). La
 * accion solo dice quien puede entrar.
 *
 * El texto NO va a la URL: es un dato personal (correo, nombre) y AGENTS.md prohibe
 * datos personales en URLs y query strings. Por eso la busqueda es una server action
 * invocada desde el componente cliente con el texto en estado local, y los resultados
 * viajan en el payload, no en la barra de direcciones.
 */
export async function buscarPersonasAccion(texto: string): Promise<ResultadoBusqueda> {
  try {
    const session = await requireRole("gerente", "closer");
    const personas = await buscarPersonas(session.user.id, session.user.rol, texto, db);
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
