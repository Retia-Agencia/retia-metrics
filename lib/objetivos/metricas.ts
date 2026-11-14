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
  dePauta: boolean;
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
    dePauta: false,
    lector: "122",
  },
  costo_por_agenda: {
    nombre: "Costo por agenda",
    descripcion: "Lo que cuesta en pauta cada agenda que entra por Paid: gasto ÷ agendas del CRM.",
    sentido: "menor_es_mejor",
    unidad: "COP",
    admiteArea: false,
    dePauta: true,
    lector: "258",
  },
  roas: {
    nombre: "ROAS",
    descripcion: "Valor contratado de ventas de Paid ÷ gasto de Paid, ambos en USD.",
    sentido: "mayor_es_mejor",
    unidad: "razon",
    admiteArea: true,
    dePauta: true,
    lector: "403",
  },
  conversion_agenda_venta: {
    nombre: "Conversión de agenda a venta",
    descripcion: "Porcentaje de agendas que terminan en venta.",
    sentido: "mayor_es_mejor",
    unidad: "porcentaje",
    admiteArea: true,
    dePauta: false,
    lector: "403",
  },
  agendas: {
    nombre: "Agendas de la cohorte",
    descripcion: "Agendas totales que debe juntar la cohorte para llegar a su meta de ventas.",
    sentido: "mayor_es_mejor",
    unidad: "conteo",
    admiteArea: false,
    dePauta: true,
    lector: "412",
  },
  inversion: {
    nombre: "Inversión de la cohorte",
    descripcion: "Presupuesto de pauta de la cohorte, en la moneda de la meta.",
    sentido: "menor_es_mejor",
    unidad: "COP",
    admiteArea: false,
    dePauta: true,
    lector: "412",
  },
  costo_por_venta: {
    nombre: "Costo por venta",
    descripcion: "Lo que cuesta en pauta cada venta que entra por Paid: inversión ÷ ventas de Paid.",
    sentido: "menor_es_mejor",
    unidad: "COP",
    admiteArea: false,
    dePauta: true,
    lector: "415",
  },
};

export const METRICAS_OFRECIDAS = METRICAS_OBJETIVO.filter(
  (metrica) => DEFINICION_METRICAS_OBJETIVO[metrica].lector !== null,
);

export function monedaDeMetrica(metrica: MetricaObjetivo): "COP" | null {
  return DEFINICION_METRICAS_OBJETIVO[metrica].unidad === "COP" ? "COP" : null;
}
