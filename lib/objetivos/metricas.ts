import { metricaObjetivoEnum } from "@/lib/db/schema";

export const METRICAS_OBJETIVO = metricaObjetivoEnum.enumValues;
export type MetricaObjetivo = (typeof METRICAS_OBJETIVO)[number];
export type SentidoObjetivo = "menor_es_mejor" | "mayor_es_mejor";

export interface DefinicionMetricaObjetivo {
  nombre: string;
  sentido: SentidoObjetivo;
  esCosto: boolean;
}

/** Definición exhaustiva: agregar una métrica al enum obliga a describirla aquí. */
export const DEFINICION_METRICAS_OBJETIVO: Record<MetricaObjetivo, DefinicionMetricaObjetivo> = {
  cupos: { nombre: "Cupos", sentido: "mayor_es_mejor", esCosto: false },
  agendas_por_dia: { nombre: "Agendas por día", sentido: "mayor_es_mejor", esCosto: false },
  costo_por_agenda: { nombre: "Costo por agenda", sentido: "menor_es_mejor", esCosto: true },
  costo_por_lead: { nombre: "Costo por lead", sentido: "menor_es_mejor", esCosto: true },
  costo_por_venta: { nombre: "Costo por venta", sentido: "menor_es_mejor", esCosto: true },
  roas: { nombre: "ROAS", sentido: "mayor_es_mejor", esCosto: false },
  conversion_agenda_venta: {
    nombre: "Conversión de agenda a venta",
    sentido: "mayor_es_mejor",
    esCosto: false,
  },
};
