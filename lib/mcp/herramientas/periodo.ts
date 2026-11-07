import { z } from "zod";
import { ErrorDeApp } from "@/lib/errors";
import { atajosDePeriodo, type AtajoDePeriodo } from "@/lib/periodo";

export const PERIODOS_MCP = [
  ...(Object.keys(atajosDePeriodo) as AtajoDePeriodo[]),
  "custom",
] as const;

const fechaBogota = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha AAAA-MM-DD de Bogotá.");

export const camposDePeriodoMcp = {
  periodo: z.enum(PERIODOS_MCP),
  desde: fechaBogota.optional(),
  hasta: fechaBogota.optional(),
};

export interface EntradaDePeriodoMcp {
  periodo: (typeof PERIODOS_MCP)[number];
  desde?: string;
  hasta?: string;
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
