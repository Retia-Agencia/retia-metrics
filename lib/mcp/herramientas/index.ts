import { programasVisiblesMcp } from "./programas";
import type { ContextoMcp, Herramienta } from "./tipos";

/** Registro exhaustivo: una herramienta que no aparece aquí no existe para el MCP. */
export const HERRAMIENTAS = [programasVisiblesMcp] as const satisfies readonly Herramienta[];

export function herramientasPara(contexto: ContextoMcp): readonly Herramienta[] {
  return HERRAMIENTAS.filter((herramienta) => herramienta.puede(contexto));
}

export type { ContextoMcp, Herramienta } from "./tipos";
