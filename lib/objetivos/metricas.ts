import { metricaObjetivoEnum } from "@/lib/db/schema";

export const METRICAS_OBJETIVO = metricaObjetivoEnum.enumValues;
export type MetricaObjetivo = (typeof METRICAS_OBJETIVO)[number];
export type SentidoObjetivo = "menor_es_mejor" | "mayor_es_mejor";

export interface DefinicionMetricaObjetivo {
  nombre: string;
  descripcion: string;
  sentido: SentidoObjetivo;
  unidad: "COP" | "conteo" | "razon" | "porcentaje";
  admiteArea: boolean;
  lector: string | null;
}

/** Definición exhaustiva: agregar una métrica al enum obliga a describirla aquí. */
export const DEFINICION_METRICAS_OBJETIVO: Record<MetricaObjetivo, DefinicionMetricaObjetivo> = {
  cupos: {
    nombre: "Cupos",
    descripcion: "Ventas que debe alcanzar la cohorte.",
    sentido: "mayor_es_mejor",
    unidad: "conteo",
    admiteArea: true,
    lector: "122",
  },
  agendas_por_dia: {
    nombre: "Agendas por día",
    descripcion: "Agendas que necesita el programa por día hábil.",
    sentido: "mayor_es_mejor",
    unidad: "conteo",
    admiteArea: true,
    lector: null,
  },
  costo_por_agenda: {
    nombre: "Costo por agenda",
    descripcion: "Lo que cuesta en pauta cada agenda que entra por Paid: gasto ÷ agendas del CRM.",
    sentido: "menor_es_mejor",
    unidad: "COP",
    admiteArea: false,
    lector: "258",
  },
  costo_por_lead: {
    nombre: "Costo por lead",
    descripcion: "Lo que cuesta en pauta cada registro que entra por Paid: gasto ÷ registros de Paid.",
    sentido: "menor_es_mejor",
    unidad: "COP",
    admiteArea: true,
    lector: null,
  },
  costo_por_venta: {
    nombre: "Costo por venta",
    descripcion: "Lo que cuesta en pauta cada venta que entra por Paid: gasto ÷ ventas de Paid.",
    sentido: "menor_es_mejor",
    unidad: "COP",
    admiteArea: true,
    lector: null,
  },
  roas: {
    nombre: "ROAS",
    descripcion: "Valor contratado de ventas de Paid ÷ gasto de Paid, ambos en USD.",
    sentido: "mayor_es_mejor",
    unidad: "razon",
    admiteArea: true,
    lector: null,
  },
  conversion_agenda_venta: {
    nombre: "Conversión de agenda a venta",
    descripcion: "Porcentaje de agendas que terminan en venta.",
    sentido: "mayor_es_mejor",
    unidad: "porcentaje",
    admiteArea: true,
    lector: null,
  },
};

export const METRICAS_OFRECIDAS = METRICAS_OBJETIVO.filter(
  (metrica) => DEFINICION_METRICAS_OBJETIVO[metrica].lector !== null,
);

export function monedaDeMetrica(metrica: MetricaObjetivo): "COP" | null {
  return DEFINICION_METRICAS_OBJETIVO[metrica].unidad === "COP" ? "COP" : null;
}
