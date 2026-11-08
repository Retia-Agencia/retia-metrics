import { z } from "zod";
import { ErrorDeApp } from "@/lib/errors";
import { atajosDePeriodo, esquemaDeMes, type AtajoDePeriodo } from "@/lib/periodo";

export const PERIODOS_MCP = [
  ...(Object.keys(atajosDePeriodo) as AtajoDePeriodo[]),
  "custom",
] as const;

const fechaBogota = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha AAAA-MM-DD de Bogotá.");

export const camposDePeriodoMcp = {
  periodo: z.union([z.enum(PERIODOS_MCP), esquemaDeMes]),
  desde: fechaBogota.optional(),
  hasta: fechaBogota.optional(),
};

export interface EntradaDePeriodoMcp {
  /** Un atajo, `custom` (con desde y hasta) o un mes concreto `AAAA-MM`. */
  periodo: (typeof PERIODOS_MCP)[number] | string;
  desde?: string;
  hasta?: string;
}

/** El atajo que la vista dibuja: un mes concreto es un periodo `custom`. */
export function presetDePeriodoMcp(entrada: EntradaDePeriodoMcp): AtajoDePeriodo | "custom" {
  return (PERIODOS_MCP as readonly string[]).includes(entrada.periodo)
    ? (entrada.periodo as AtajoDePeriodo | "custom")
    : "custom";
}

export function busquedaDePeriodoMcp(entrada: EntradaDePeriodoMcp) {
  if (entrada.periodo === "custom" && (!entrada.desde || !entrada.hasta)) {
    throw new ErrorDeApp("Un periodo custom necesita desde y hasta.", 400);
  }
  if (entrada.periodo !== "custom" && (entrada.desde || entrada.hasta)) {
    throw new ErrorDeApp("Desde y hasta solo se usan con el periodo custom.", 400);
  }
  return {
    periodo: entrada.periodo,
    ...(entrada.desde ? { a_desde: entrada.desde } : {}),
    ...(entrada.hasta ? { a_hasta: entrada.hasta } : {}),
    comparar: "no",
  };
}
