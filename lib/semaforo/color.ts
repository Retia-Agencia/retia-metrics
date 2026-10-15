import { colorDeObjetivo, type ColorDeObjetivo } from "@/lib/objetivos/semaforo";
import type { CostoPorAgenda } from "./costo-por-agenda";

export type ColorSemaforo = ColorDeObjetivo | "sin_dato";
export type MotivoSemaforo = "sin_cohorte" | "sin_umbral" | "sin_pauta" | "sin_referencia" | null;

export interface UmbralCostoPorAgenda {
  meta: number;
  aceptable: number | null;
}

export interface ResultadoColor {
  color: ColorSemaforo;
  motivo: MotivoSemaforo;
}

export function colorDeCierre(args: {
  datos: CostoPorAgenda;
  tieneCohorte: boolean;
  umbral: UmbralCostoPorAgenda | null;
}): ResultadoColor {
  if (!args.tieneCohorte) return { color: "sin_dato", motivo: "sin_cohorte" };
  if (!args.umbral) return { color: "sin_dato", motivo: "sin_umbral" };
  if (args.datos.gasto === 0 && args.datos.agendas === 0) {
    return { color: "sin_dato", motivo: "sin_pauta" };
  }
  if (args.datos.agendas === 0) return { color: "peligro", motivo: null };
  return {
    color: colorDeObjetivo({
      metrica: "costo_por_agenda",
      meta: args.umbral.meta,
      aceptable: args.umbral.aceptable,
      valor: args.datos.costo as number,
    }),
    motivo: null,
  };
}

export function colorDeDia(args: {
  hoy: CostoPorAgenda;
  ayer: CostoPorAgenda;
  umbral: UmbralCostoPorAgenda | null;
}): ResultadoColor {
  if (args.hoy.gasto === 0) return { color: "sin_dato", motivo: "sin_pauta" };
  if (args.hoy.agendas > 0 && args.ayer.agendas === 0) return { color: "exito", motivo: null };
  if (args.hoy.agendas === 0 && args.ayer.agendas > 0) return { color: "peligro", motivo: null };
  if (args.hoy.agendas === 0 && args.ayer.agendas === 0) {
    return { color: "sin_dato", motivo: "sin_referencia" };
  }
  const referencia = args.ayer.costo;
  if (referencia === null) return { color: "sin_dato", motivo: "sin_referencia" };
  const aceptable = args.umbral?.aceptable === null || !args.umbral
    ? null
    : referencia * (args.umbral.aceptable / args.umbral.meta);
  return {
    color: colorDeObjetivo({
      metrica: "costo_por_agenda",
      meta: referencia,
      aceptable,
      valor: args.hoy.costo as number,
    }),
    motivo: null,
  };
}

export function porcentajeDelUmbral(costo: number | null, umbral: UmbralCostoPorAgenda | null): number | null {
  if (costo === null || !umbral || umbral.meta === 0) return null;
  return (costo / umbral.meta) * 100;
}
