import { programasVisiblesMcp } from "./programas";
import { consultarMetricaMcp, resumenDelHubMcp } from "./metricas";
import { bandejaMcp, buscarLeadsMcp, buscarMcp, fichaDeDealMcp, fichaDeLeadMcp, opcionesDeFiltrosMcp, tableroDeDealsMcp } from "./operacion";
import { carteraVencidaMcp, origenDelProgramaMcp, pautaRoasMcp } from "./decisiones";
import type { ContextoMcp, Herramienta } from "./tipos";
import { capacidadesMcp } from "./capacidades";
import { consultarHechosMcp } from "./hechos";

/** Registro exhaustivo: una herramienta que no aparece aquí no existe para el MCP. */
export const HERRAMIENTAS = [
  programasVisiblesMcp,
  capacidadesMcp,
  resumenDelHubMcp,
  consultarMetricaMcp,
  consultarHechosMcp,
  buscarMcp,
  buscarLeadsMcp,
  fichaDeLeadMcp,
  fichaDeDealMcp,
  tableroDeDealsMcp,
  opcionesDeFiltrosMcp,
  bandejaMcp,
  carteraVencidaMcp,
  pautaRoasMcp,
  origenDelProgramaMcp,
] as const satisfies readonly Herramienta[];

export function herramientasPara(contexto: ContextoMcp): readonly Herramienta[] {
  return HERRAMIENTAS.filter((herramienta) => herramienta.puede(contexto));
}

export type { ContextoMcp, Herramienta } from "./tipos";
