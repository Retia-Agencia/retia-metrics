import { z } from "zod";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { campoDeMetrica, campoDeTasa, campoPorMoneda } from "./campos";

const programa = z.object({
  nombre: z.string().describe("Nombre legible del programa."),
  slug: z.string().describe("Identificador opaco del programa usado en sus enlaces."),
}).strict().describe("Programa al que pertenecen todas las cifras.");

const periodo = z.object({
  desde: z.string().describe("Primer día incluido, en Bogotá, con formato AAAA-MM-DD."),
  hasta: z.string().describe("Último día incluido, en Bogotá, con formato AAAA-MM-DD."),
}).strict().describe("Periodo de las cifras, en días de Bogotá.");

export const salidaDeResumen = z.object({
  programa,
  enlace: z.string().url().describe("Enlace al Hub del programa para verificar las cifras."),
  periodo,
  cifras: z.object({
    ventas: campoDeMetrica("ventas", { unidad: "cupos", monedas: [] }),
    vendido: campoDeMetrica("vendido", { unidad: "dinero", monedas: ["usd"] }),
    recaudado: campoDeMetrica("recaudado", { unidad: "dinero", monedas: ["usd"] }),
    por_cobrar: campoDeMetrica("por_cobrar", { unidad: "dinero", monedas: ["usd"] }),
    citas: campoDeMetrica("citas", { unidad: "citas", monedas: [] }),
    shows: campoDeMetrica("shows", { unidad: "citas", monedas: [] }),
  }).strict().describe("Cifras principales del periodo, nombradas con el vocabulario del negocio."),
  entro_a_caja: z.array(campoPorMoneda("entro_a_caja", { unidad: "dinero", monedas: ["usd", "cop"] }))
    .describe("Totales que entraron a caja en el periodo, separados por moneda."),
  tasas: z.object({
    asistencia: campoDeTasa("asistencia"),
    cierre_de_ventas: campoDeTasa("cierre_de_ventas"),
    cita_a_venta: campoDeTasa("cita_a_venta"),
  }).strict().describe("Tasas del periodo con su cobertura."),
}).strict();

type ProgramaDeResumen = { nombre: string; slug: string };

/** Traduce la vista canónica del Hub a un contrato de negocio sin exponer su estructura interna. */
export function aSalidaDeResumen(vista: VistaDelDashboard, programaVisible: ProgramaDeResumen, enlace: string) {
  const grupo = vista.embudo.grupo;
  return {
    programa: programaVisible,
    enlace,
    periodo: { desde: vista.periodo.a.desde, hasta: vista.periodo.a.hasta },
    cifras: {
      ventas: { valor: vista.embudo.cierres, unidad: "cupos" as const },
      vendido: { valor: vista.dinero.vendido, unidad: "dinero" as const, moneda: "USD" as const },
      recaudado: { valor: vista.dinero.recaudado, unidad: "dinero" as const, moneda: "USD" as const },
      por_cobrar: { valor: vista.dinero.porCobrar, unidad: "dinero" as const, moneda: "USD" as const },
      citas: { valor: vista.embudo.agendas, unidad: "citas" as const },
      shows: { valor: vista.embudo.llamadasConShow, unidad: "citas" as const },
    },
    entro_a_caja: vista.caja.map(({ moneda, total }) => ({ moneda, total })),
    tasas: {
      asistencia: { valor: vista.embudo.pctShow, cobertura: grupo.cobertura, parcial: grupo.parcial },
      cierre_de_ventas: { valor: vista.embudo.pctCierre, cobertura: grupo.cobertura, parcial: grupo.parcial },
      cita_a_venta: { valor: vista.embudo.agendaAVenta, cobertura: grupo.cobertura, parcial: grupo.parcial },
    },
  };
}
