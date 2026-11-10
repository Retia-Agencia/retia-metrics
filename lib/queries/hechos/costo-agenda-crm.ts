import { razon, type RazonConCobertura } from "@/lib/cobertura";
import type { Db } from "@/lib/db/tipos";
import { costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";

export interface CostoPorAgendaDelCrm {
  gasto: number;
  agendasCrm: number;
  gastoTotal: number;
  gastoOtras: number;
  moneda: "COP";
  costo: RazonConCobertura;
}

export async function costoPorAgendaDelCrm(
  db: Db,
  args: { programId: string; desde: string; hasta: string },
): Promise<CostoPorAgendaDelCrm> {
  const ventana = await costoPorAgendaDeVentana(db, args);
  const { base, faltan, motivo } = ventana.costoCobertura;
  return {
    gasto: ventana.gasto,
    agendasCrm: ventana.agendasCrm,
    gastoTotal: ventana.gastoTotal,
    gastoOtras: Math.max(0, ventana.gastoTotal - ventana.gasto - ventana.lanzamiento.gasto),
    moneda: "COP",
    // Sin gasto de agenda no hay costo que calcular: 0 / N diría "COP 0 por agenda" para agendas que
    // nadie pagó (412 F, Mani 10-nov). Es la misma regla de la fila de Meta, que con 0 agendas da "—".
    costo: razon(ventana.gasto, ventana.agendasCrm, {
      base,
      faltan,
      motivo: ventana.gasto === 0 && faltan === 0 ? "Sin gasto de agenda en el periodo" : motivo,
      calculable: ventana.gasto > 0 && (ventana.costoCobertura.valor !== null || faltan === 0),
    }),
  };
}
