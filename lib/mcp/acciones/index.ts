import { deshacerEventoMcp } from "./deshacer";
import { moverEtapaMcp } from "./mover-etapa";
import type { AccionMcp } from "./tipos";

export const ACCIONES = [moverEtapaMcp, deshacerEventoMcp] as const satisfies readonly AccionMcp[];
export const CLAVES_DE_ACCION = ACCIONES.map((accion) => accion.clave) as [string, ...string[]];

export function accionPorClave(clave: string): AccionMcp | undefined {
  return ACCIONES.find((accion) => accion.clave === clave) as AccionMcp | undefined;
}

export type { AccionMcp, ObjetivoAccionMcp, RevisionAccionMcp } from "./tipos";
