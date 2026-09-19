import { MAPEO_FORMULARIO, type MapeoColumnas } from "./mapeo";

/**
 * Combinacion del mapeo de columnas campo por campo (ADR 0019, ticket 016).
 *
 * Modulo PURO, sin base: la decision vive aparte de la escritura, mismo molde que
 * `lib/sheets/plan-sync.ts`. `lib/sheets/sync.ts` importa `combinarMapeo` y le pasa
 * lo que ya cargo (el `mapeoColumnas` de la fuente y el `plantillaLead` del
 * programa); esta funcion no toca la base.
 *
 * Un programa puede tener varias hojas que preguntan lo mismo con otra redaccion.
 * En vez de repetir el mapeo entero por hoja, la plantilla se escribe UNA vez en el
 * programa y cada fuente solo ajusta los campos que su hoja redacta distinto. El
 * mapeo efectivo es la union campo por campo con esta precedencia:
 *
 *   fuente  gana sobre  programa  gana sobre  defecto (MAPEO_FORMULARIO)
 *
 * Antes el sync elegia todo-o-nada con un ternario: si la fuente traia CUALQUIER
 * campo, se usaba SOLO su mapeo y se ignoraba el defecto entero. Combinar campo por
 * campo es un no-op para los datos de hoy (las tres fuentes activas mapean los
 * mismos 14 campos que MAPEO_FORMULARIO, sin huecos ni extras), pero deja que una
 * hoja nueva ajuste un solo campo sin volver a escribir el resto.
 */

/** De que nivel salio cada campo del mapeo combinado. Lo usa la pantalla. */
export type OrigenDelCampo = "fuente" | "programa" | "defecto";

export interface MapeoCombinado {
  /** El mapeo efectivo: el patron que gano para cada campo. */
  mapeo: MapeoColumnas;
  /** Para cada campo del mapeo, de que nivel salio su patron. */
  origen: Record<string, OrigenDelCampo>;
}

/**
 * Combina fuente, programa y defecto campo por campo con la precedencia del ADR
 * 0019. Un nivel nulo o vacio simplemente no aporta campos; nunca rompe.
 *
 * El defecto por defecto es `MAPEO_FORMULARIO`. Se recibe como parametro para poder
 * probarlo aislado, no para cambiarlo en produccion.
 */
export function combinarMapeo(
  fuente: MapeoColumnas | null | undefined,
  programa: MapeoColumnas | null | undefined,
  defecto: MapeoColumnas = MAPEO_FORMULARIO,
): MapeoCombinado {
  const mapeo: MapeoColumnas = {};
  const origen: Record<string, OrigenDelCampo> = {};

  // Del nivel de menor a mayor precedencia: cada nivel superior pisa al anterior,
  // asi que fuente termina ganando. `origen` refleja quien escribio el valor final.
  aplicarNivel(mapeo, origen, defecto, "defecto");
  aplicarNivel(mapeo, origen, programa, "programa");
  aplicarNivel(mapeo, origen, fuente, "fuente");

  return { mapeo, origen };
}

/**
 * Vuelca los campos de un nivel sobre el acumulado, marcando su origen. Un patron
 * vacio ("" o []) no cuenta como ajuste: no aporta campo ni pisa al de abajo.
 */
function aplicarNivel(
  mapeo: MapeoColumnas,
  origen: Record<string, OrigenDelCampo>,
  nivel: MapeoColumnas | null | undefined,
  quien: OrigenDelCampo,
): void {
  if (!nivel) return;
  for (const [campo, patron] of Object.entries(nivel)) {
    if (esPatronVacio(patron)) continue;
    mapeo[campo] = patron;
    origen[campo] = quien;
  }
}

/** Un patron vacio no ajusta nada: cadena en blanco o arreglo sin elementos utiles. */
function esPatronVacio(patron: string | string[]): boolean {
  if (Array.isArray(patron)) {
    return patron.every((p) => String(p ?? "").trim() === "");
  }
  return String(patron ?? "").trim() === "";
}
