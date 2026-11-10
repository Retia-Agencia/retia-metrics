import { razonDeCosto, type RazonConCobertura } from "@/lib/cobertura";
import type { Db } from "@/lib/db/tipos";
import { costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";

export interface CostoPorAgendaDelCrm {
  /** Gasto de campañas con propósito agenda (D-2, aprobada por Mani el 9-nov); es el numerador del costo. */
  gasto: number;
  agendasCrm: number;
  gastoTotal: number;
  /** Lo que no fue agenda ni lanzamiento: campañas sin propósito. Va aparte y no entra al costo. */
  gastoOtras: number;
  moneda: "COP";
  costo: RazonConCobertura;
}

/**
 * Costo por agenda del Hub. El denominador NO se vuelve a contar: lo trae quien pinta la celda "Agendadas"
 * (`agendasCrm`, salida de `agendasDePauta`), así que costo y celda no pueden diverger (412 F, ADR 0115 N1).
 */
export async function costoPorAgendaDelCrm(
  db: Db,
  args: { programId: string; desde: string; hasta: string; agendasCrm: number },
): Promise<CostoPorAgendaDelCrm> {
  const ventana = await costoPorAgendaDeVentana(db, { programId: args.programId, desde: args.desde, hasta: args.hasta });
  const { base, faltan, motivo } = ventana.costoCobertura;
  // Una campaña sin propósito es "Otras campañas"; el gasto manual sin campaña cuenta como agenda (D-2).
  const gastoDeAgenda = ventana.campanas
    .filter((campana) => campana.proposito === "agenda")
    .reduce((total, campana) => total + campana.gasto, 0);
  return {
    gasto: gastoDeAgenda,
    agendasCrm: args.agendasCrm,
    gastoTotal: ventana.gastoTotal,
    gastoOtras: Math.max(0, ventana.gastoTotal - gastoDeAgenda - ventana.lanzamiento.gasto),
    moneda: "COP",
    costo: razonDeCosto(gastoDeAgenda, args.agendasCrm, {
      base,
      faltan,
      motivo,
      calculable: ventana.costoCobertura.valor !== null || faltan === 0,
    }),
  };
}
