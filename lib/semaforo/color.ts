import { colorDeObjetivo, type ColorDeObjetivo } from "@/lib/objetivos/semaforo";
import type { CostoPorAgenda } from "./costo-por-agenda";

export type ColorSemaforo = ColorDeObjetivo | "sin_dato";
export type MotivoSemaforo = "sin_cohorte" | "sin_umbral" | "sin_pauta" | "sin_agendas_meta" | null;

export interface UmbralCostoPorAgenda {
  meta: number;
  aceptable: number | null;
}

export interface ResultadoColor {
  color: ColorSemaforo;
  motivo: MotivoSemaforo;
}

export function colorDelCosto(args: {
  datos: CostoPorAgenda;
  tieneCohorte: boolean;
  umbral: UmbralCostoPorAgenda | null;
}): ResultadoColor {
  if (!args.tieneCohorte) return { color: "sin_dato", motivo: "sin_cohorte" };
  if (!args.umbral) return { color: "sin_dato", motivo: "sin_umbral" };
  if (args.datos.gasto === 0) return { color: "sin_dato", motivo: "sin_pauta" };
  if (args.datos.agendasMeta === null) return { color: "sin_dato", motivo: "sin_agendas_meta" };
  if (args.datos.agendasMeta === 0) return { color: "peligro", motivo: null };
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

export function porcentajeDelUmbral(costo: number | null, umbral: UmbralCostoPorAgenda | null): number | null {
  if (costo === null || !umbral || umbral.meta === 0) return null;
  return (costo / umbral.meta) * 100;
}
