import { cache } from "react";

/**
 * Lecturas de identidad UNA vez por request (perf, 6-nov).
 *
 * La capa de identidad (`auth()` con su `revalidarToken`, `sesionEfectiva`, `rolDeVista`,
 * `programasVisibles`) se repetia en el layout, en `paginaConRol` y en la propia pagina:
 * unas 7 consultas por navegacion para responder 3 preguntas. `cache` de React memoiza
 * por request en el servidor (en el cliente y en los tests es un passthrough, asi que
 * la conducta de los tests no cambia).
 *
 * **Una escritura nunca lee de la memoria.** Una server action que cambia membresias,
 * alcance o rol y relee en el mismo request (o cuyo re-render posterior a
 * `revalidatePath` corre en ese request) tiene que ver el dato nuevo. Next marca toda
 * server action con la cabecera `next-action` (misma pista que usa la reja de solo
 * lectura de `guards.ts`): con ella, la lectura va directo a la base, exactamente como
 * antes. Memoizar solo los GET de render es lo que mantiene intacto el contrato de
 * `revalidarToken` (quitar a alguien surte efecto en el siguiente request: aqui el
 * request siguiente es otro scope).
 */

/**
 * ¿La invocacion actual es una ESCRITURA? Hoy = una server action (cabecera
 * `next-action`). Fuera de un request `headers()` lanza: la reja de solo lectura de
 * `guards.ts` quiere ese fallo (falla cerrado); la memoizacion de abajo lo trata como
 * "no es escritura" porque sin request no hay scope que compartir.
 *
 * ⚠️ Cubre server actions, no route handlers (no se sabe el metodo desde aqui): mientras
 * todo write sea una server action basta. Lo vigila `tests/reja-solo-lectura-handlers.test.ts`.
 */
export async function esEscritura(): Promise<boolean> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return h.get("next-action") != null;
}

async function esEscrituraOFueraDeRequest(): Promise<boolean> {
  try {
    return await esEscritura();
  } catch {
    return false;
  }
}

/**
 * Memoiza por request una lectura de identidad. Los argumentos se comparan por
 * identidad (`cache` usa `Object.is`): pasa solo primitivos o el MISMO objeto de sesion.
 */
export function memoizadaPorSolicitud<A extends unknown[], R>(
  lectura: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  const memoizada = cache(lectura);
  return async (...args: A) => ((await esEscrituraOFueraDeRequest()) ? lectura(...args) : memoizada(...args));
}
