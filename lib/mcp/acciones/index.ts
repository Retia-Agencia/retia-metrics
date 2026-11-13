import { deshacerEventoMcp } from "./deshacer";
import { moverEtapaMcp } from "./mover-etapa";
import { marcarShowMcp } from "./marcar-show";
import { pegarGrainMcp } from "./pegar-grain";
import { corregirResultadoMcp } from "./corregir-resultado";
import { registrarAbonoMcp } from "./registrar-abono";
import { cambiarPlataformaDeAbonoMcp } from "./cambiar-plataforma-de-abono";
import { anularDealMcp } from "./anular-deal";
import { anularAbonoMcp } from "./anular-abono";
import { anularLlamadaMcp } from "./anular-llamada";
import { marcarFallidaMcp } from "./marcar-fallida";
import { asignarLlamadaSueltaMcp } from "./asignar-llamada-suelta";
import type { AccionMcp } from "./tipos";

export const ACCIONES = [
  moverEtapaMcp,
  deshacerEventoMcp,
  marcarShowMcp,
  pegarGrainMcp,
  corregirResultadoMcp,
  registrarAbonoMcp,
  cambiarPlataformaDeAbonoMcp,
  anularDealMcp,
  anularAbonoMcp,
  anularLlamadaMcp,
  marcarFallidaMcp,
  asignarLlamadaSueltaMcp,
] as const satisfies readonly AccionMcp[];
export const CLAVES_DE_ACCION = ACCIONES.map((accion) => accion.clave) as [string, ...string[]];

export function accionPorClave(clave: string): AccionMcp | undefined {
  return ACCIONES.find((accion) => accion.clave === clave) as AccionMcp | undefined;
}

export type { AccionMcp, ObjetivoAccionMcp, RevisionAccionMcp } from "./tipos";
