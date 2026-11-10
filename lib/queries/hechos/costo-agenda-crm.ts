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
    costo: razon(ventana.gasto, ventana.agendasCrm, {
      base,
      faltan,
      motivo,
      calculable: ventana.costoCobertura.valor !== null || faltan === 0,
    }),
  };
}
