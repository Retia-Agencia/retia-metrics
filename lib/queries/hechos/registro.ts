import * as abono from "@/lib/queries/hechos/abono";
import * as agenda from "@/lib/queries/hechos/agenda";
import * as cita from "@/lib/queries/hechos/cita";
import * as envio from "@/lib/queries/hechos/envio";
import * as gasto from "@/lib/queries/hechos/gasto";
import * as venta from "@/lib/queries/hechos/venta";
import type { DimensionAbono, MedidaAbono } from "@/lib/queries/hechos/abono";
import type { DimensionAgenda, MedidaAgenda } from "@/lib/queries/hechos/agenda";
import type { DimensionCita, MedidaCita } from "@/lib/queries/hechos/cita";
import type { DimensionEnvio, MedidaEnvio } from "@/lib/queries/hechos/envio";
import type { DimensionGasto, MedidaGasto } from "@/lib/queries/hechos/gasto";
import type { DimensionVenta, MedidaVenta } from "@/lib/queries/hechos/venta";
import type { Db } from "@/lib/db/tipos";
import type { ConsultaAgrupada, ConsultaDeLista, ListaPaginada } from "@/lib/queries/hechos/dimensiones";

export type HechoConsultable = "envio" | "agenda" | "cita" | "venta" | "abono" | "gasto";

function listaExacta<U extends string>() {
  return <A extends readonly U[]>(valores: A & (Exclude<U, A[number]> extends never ? unknown : never)) => valores;
}

const dimensionesEnvio = listaExacta<DimensionEnvio>()(["dia", "semana", "mes", "area", "canal", "cuenta", "campana", "fuente", "utm_source", "utm_medium", "categoria"] as const);
const dimensionesAgenda = listaExacta<DimensionAgenda>()(["dia", "semana", "mes", "hora", "area", "canal", "cuenta", "utm_source", "utm_medium", "categoria", "tiene_envio", "dueno", "cohorte", "etapa"] as const);
const dimensionesCita = listaExacta<DimensionCita>()(["dia", "semana", "mes", "area", "canal", "cuenta", "dueno", "cohorte", "etapa", "ocurrio"] as const);
const dimensionesVenta = listaExacta<DimensionVenta>()(["dia", "semana", "mes", "area", "canal", "cuenta", "dueno", "cohorte"] as const);
const dimensionesAbono = listaExacta<DimensionAbono>()(["dia", "semana", "mes", "moneda", "plataforma", "registrado_por", "dueno", "cohorte"] as const);
const dimensionesGasto = listaExacta<DimensionGasto>()(["dia", "semana", "mes", "moneda", "objeto_de_pauta"] as const);

interface DefinicionDeHecho {
  dimensiones: readonly string[];
  medidas: readonly string[];
  camposDeLista: readonly string[];
  modulo: {
    listar(db: Db, opciones: ConsultaDeLista<string, string>): Promise<ListaPaginada<Record<string, unknown>>>;
    agrupar(db: Db, opciones: ConsultaAgrupada<string, string>): Promise<Record<string, unknown>[]>;
    contarGrupos(db: Db, opciones: ConsultaAgrupada<string, string>): Promise<number>;
  };
}

type DefinicionFuente = Omit<DefinicionDeHecho, "modulo"> & { modulo: object };

const definiciones = {
  envio: { dimensiones: dimensionesEnvio, medidas: ["envios"] as const satisfies readonly MedidaEnvio[], camposDeLista: ["id_del_envio", ...dimensionesEnvio], modulo: envio },
  agenda: { dimensiones: dimensionesAgenda, medidas: ["agendas"] as const satisfies readonly MedidaAgenda[], camposDeLista: ["id_de_la_llamada", "id_del_deal", "hora_minuto", ...dimensionesAgenda], modulo: agenda },
  cita: { dimensiones: dimensionesCita, medidas: ["citas", "shows"] as const satisfies readonly MedidaCita[], camposDeLista: ["id_de_la_llamada", "id_del_deal", ...dimensionesCita], modulo: cita },
  venta: { dimensiones: dimensionesVenta, medidas: ["ventas"] as const satisfies readonly MedidaVenta[], camposDeLista: ["id_del_deal", ...dimensionesVenta], modulo: venta },
  abono: { dimensiones: dimensionesAbono, medidas: ["abonos", "monto"] as const satisfies readonly MedidaAbono[], camposDeLista: ["id_del_abono", "id_del_deal", "monto", ...dimensionesAbono], modulo: abono },
  gasto: { dimensiones: dimensionesGasto, medidas: ["monto"] as const satisfies readonly MedidaGasto[], camposDeLista: ["monto", ...dimensionesGasto], modulo: gasto },
} as const satisfies Record<HechoConsultable, DefinicionFuente>;

type DimensionConsultable = typeof definiciones[keyof typeof definiciones]["dimensiones"][number];

/** Dimensiones que describen el trabajo individual del equipo comercial. */
export const DIMENSIONES_DEL_EQUIPO_COMERCIAL = ["dueno", "registrado_por"] as const satisfies readonly DimensionConsultable[];

/** Las dimensiones de un hecho que puede usar quien ve (o no) el trabajo del equipo comercial. */
export function dimensionesVisibles(dimensiones: readonly string[], veEquipo: boolean): string[] {
  return dimensiones.filter((dimension) => veEquipo || !(DIMENSIONES_DEL_EQUIPO_COMERCIAL as readonly string[]).includes(dimension));
}

// Los módulos conservan dimensiones genéricas más estrechas; el registro valida aquí una sola vez
// el contrato común que consume la herramienta, sin repartir casts entre sus llamadores.
export const HECHOS_CONSULTABLES = definiciones as unknown as Record<HechoConsultable, DefinicionDeHecho>;
