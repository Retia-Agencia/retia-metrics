import { z } from "zod";
import { cajaConMonedaDelPrograma } from "@/lib/queries/dashboard";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { FilaPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import type { VistaDeEscalera } from "@/lib/queries/vista-escalera";
import type { ProyeccionDeCohorte } from "@/lib/queries/proyeccion";
import type { CumplimientoDeCohorteLeido } from "@/lib/metas/cumplimiento-de-cohorte";
import type { ProyeccionDeRoas } from "@/lib/queries/proyeccion-roas";
import { campoDeMetrica, campoDeTasa, campoPorMoneda } from "./campos";

const programa = z.object({
  nombre: z.string().describe("Nombre legible del programa."),
  slug: z.string().describe("Identificador opaco del programa usado en sus enlaces."),
}).strict().describe("Programa al que pertenecen todas las cifras.");
const periodo = z.object({
  desde: z.string().describe("Primer día incluido, en Bogotá, con formato AAAA-MM-DD."),
  hasta: z.string().describe("Último día incluido, en Bogotá, con formato AAAA-MM-DD."),
}).strict().describe("Periodo de las cifras, en días de Bogotá.");
const numeroNulo = (descripcion: string) => z.number().nullable().describe(`${descripcion}; null significa que no se puede calcular.`);
const celdaDePauta = z.object({
  clave: z.string().describe("Clave canónica devuelta por la tabla semanal de Pauta."),
  nombre: z.string().describe("Nombre legible de la fila de Pauta."),
  unidad: z.enum(["COP", "USD", "conteo", "razon", "porcentaje"]).describe("Unidad original de la fila, sin conversiones."),
  valor: numeroNulo("Valor de la columna Total para el periodo"),
  cobertura: z.object({
    estado: z.enum(["ok", "parcial", "sin_dato"]).describe("Estado de cobertura calculado por Pauta."),
    razon: z.string().nullable().describe("Razón de cobertura parcial o ausencia de dato; null cuando no aplica."),
  }).strict().describe("Cobertura de la cifra según la tabla semanal de Pauta."),
}).strict().describe("Fila Total de la tabla semanal de Pauta.");

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
  entro_a_caja: z.array(campoPorMoneda("entro_a_caja", { unidad: "dinero", monedas: ["usd", "cop"] })).describe("Totales que entraron a caja en el periodo, separados por moneda."),
  tasas: z.object({
    asistencia: campoDeTasa("asistencia"),
    cierre_de_ventas: campoDeTasa("cierre_de_ventas"),
    cita_a_venta: campoDeTasa("cita_a_venta"),
  }).strict().describe("Tasas del periodo con su cobertura."),
  pauta: z.array(celdaDePauta).describe("Columna Total de cada fila que devuelve la tabla semanal de Pauta para el mismo periodo y cohorte."),
  perdidos: z.array(z.object({
    motivo: z.string().describe("Motivo vigente de cierre perdido."),
    deals: z.number().int().describe("Deals perdidos con este motivo."),
    ticket_perdido_usd: z.number().describe("Suma del ticket perdido, en USD."),
    deals_sin_ticket: z.number().int().describe("Deals del motivo cuyo ticket no se puede calcular."),
  }).strict().describe("Pérdidas agrupadas por motivo.")).describe("Pérdidas del mismo embudo y filtros que muestra Comercial."),
  dias_cita_a_pago: z.object({
    pago_rapido: numeroNulo("Mediana de días hábiles entre la cita y el primer abono para pago rápido"),
    pago_despues: numeroNulo("Mediana de días hábiles entre la cita y el primer abono para pago después"),
    unidad: z.literal("dias_habiles").describe("Unidad de las dos medianas."),
  }).strict().describe("Medianas de cita a pago calculadas por la escalera de Comercial."),
  norte: z.object({
    cohorte: z.object({
      meta: z.number().describe("Meta de cupos declarada para la cohorte activa."),
      vendidos: z.number().describe("Ventas acumuladas de la cohorte activa."),
      faltan: z.number().describe("Cupos que faltan para la meta de la cohorte."),
      ventana: z.object({
        esperado: z.number().describe("Cupos esperados a hoy dentro de la ventana de ventas."),
        meta_dinamica: z.number().describe("Objetivo del día calculado por el Hub."),
        meta_lineal: z.number().describe("Ritmo lineal diario de la meta de la cohorte."),
        habiles_restantes: z.number().int().describe("Días hábiles restantes de la ventana."),
      }).strict().nullable().describe("Ventana de venta; null cuando la cohorte no tiene fechas completas."),
    }).strict().nullable().describe("Cifras directas de la cohorte activa; null cuando no hay cohorte activa."),
    metas_del_mes: z.object({
      meta_cupos: z.number().describe("Objetivo de cupos del mes."),
      meta_usd: z.number().describe("Objetivo monetario del mes, en USD."),
      vendidos: z.number().describe("Ventas acumuladas del mes."),
      esperado: z.number().describe("Ventas esperadas a hoy para el mes."),
      deuda: z.number().describe("Cupos de atraso frente a lo esperado del mes."),
      objetivo_semana: numeroNulo("Objetivo compensado de la semana"),
      por_dia_habil: numeroNulo("Cupos diarios requeridos para compensar la cohorte activa"),
    }).strict().describe("Metas del mes ya calculadas por la vista del Hub."),
  }).strict().describe("Cifras de norte disponibles directamente en VistaDelDashboard, sin recalcularlas."),
  cifras_derivadas: z.object({
    comision: z.object({
      total_usd: z.number().describe("Comisión total de las ventas del periodo, en USD."),
      ventas_sin_comision: z.number().int().describe("Ventas cuya comisión no se puede calcular."),
    }).strict().describe("Comisión calculada por la vista del Hub."),
    descuento: z.object({
      promedio_usd: numeroNulo("Descuento promedio por venta, en USD"),
      promedio_porcentaje: numeroNulo("Descuento promedio como porcentaje"),
      ventas: z.number().int().describe("Ventas que participan en el promedio de descuento."),
    }).strict().describe("Descuentos calculados por la vista del Hub."),
    leads: z.object({
      total: numeroNulo("Personas deduplicadas por correo en el periodo"),
      objetivo_por_dia: numeroNulo("Objetivo declarado de leads por día"),
      objetivo_del_rango: numeroNulo("Objetivo de leads para el rango"),
    }).strict().describe("Leads y sus objetivos ya calculados por la vista del Hub."),
  }).strict().describe("Cifras ya derivadas por VistaDelDashboard; el MCP no repite sus fórmulas."),
  proyeccion: z.object({
    dias_del_ritmo: z.object({
      valor: z.number().int().describe("Días hábiles escogidos para medir el ritmo."),
      unidad: z.literal("dias_habiles").describe("Unidad de la ventana de ritmo."),
    }).strict().describe("Ventana de ritmo usada por la proyección del Hub."),
    citas_minimas: z.object({
      valor: z.number().int().describe("Muestra mínima configurada para confiar en las tasas."),
      unidad: z.literal("personas").describe("Unidad de la muestra mínima."),
    }).strict().describe("Muestra mínima usada por la proyección del Hub."),
    ventas: z.object({
      valor: numeroNulo("Ventas proyectadas al cierre de la cohorte"),
      razon: z.string().nullable().describe("Razón cuando la proyección no se puede calcular."),
      unidad: z.literal("cupos").describe("Unidad de la proyección de ventas."),
    }).strict().describe("Proyección de cierre calculada por Planeación."),
    leads_que_hacen_falta: z.object({
      valor: numeroNulo("Leads requeridos por día"),
      razon: z.string().nullable().describe("Razón cuando los leads requeridos no se pueden calcular."),
      unidad: z.literal("personas_por_dia_habil").describe("Unidad de los leads requeridos."),
    }).strict().describe("Necesidad diaria de leads calculada por Planeación."),
    presupuesto: z.object({
      valor: numeroNulo("Presupuesto consumido"),
      meta: numeroNulo("Presupuesto total declarado"),
      razon: z.string().nullable().describe("Razón cuando no hay presupuesto calculable."),
      unidad: z.literal("dinero").describe("Unidad del presupuesto."),
      moneda: z.literal("COP").describe("Moneda del presupuesto, sin conversiones."),
    }).strict().describe("Presupuesto de la cohorte calculado por Cumplimiento."),
    agendas_dia: z.object({
      valor: numeroNulo("Agendas por día hábil"),
      razon: z.string().nullable().describe("Razón cuando el promedio no se puede calcular."),
      unidad: z.literal("citas_por_dia_habil").describe("Unidad del promedio de agendas."),
    }).strict().describe("Ritmo real de agendas calculado por Cumplimiento."),
    agendas_req: z.object({
      valor: numeroNulo("Agendas por día necesarias"),
      razon: z.string().nullable().describe("Razón cuando las agendas requeridas no se pueden calcular."),
      unidad: z.literal("citas_por_dia_habil").describe("Unidad de las agendas requeridas."),
    }).strict().describe("Agendas por día necesarias, calculadas por Cumplimiento."),
    inversion_req: z.object({
      valor: numeroNulo("Inversión requerida por día"),
      razon: z.string().nullable().describe("Razón cuando la inversión requerida no se puede calcular."),
      unidad: z.literal("dinero_por_dia_habil").describe("Unidad de la inversión requerida."),
      moneda: z.literal("COP").describe("Moneda de la inversión requerida, sin conversiones."),
    }).strict().describe("Inversión diaria requerida calculada por Cumplimiento."),
    roas_proy: z.object({
      valor: numeroNulo("ROAS proyectado al terminar las citas pendientes"),
      razon: z.string().nullable().describe("Razón cuando el ROAS proyectado no se puede calcular."),
      unidad: z.literal("veces").describe("Unidad del ROAS proyectado."),
    }).strict().describe("ROAS proyectado calculado por la vista de Pauta."),
  }).strict().describe("Proyecciones y ritmos devueltos por los mismos módulos que usa el Hub."),
}).strict();

type ProgramaDeResumen = { nombre: string; slug: string };
type ExtrasDeResumen = {
  pauta: readonly FilaPautaSemanal[];
  escalera: VistaDeEscalera;
  planeacion: ProyeccionDeCohorte;
  cumplimiento: CumplimientoDeCohorteLeido;
  roasProyectado: ProyeccionDeRoas;
};

/** Traduce las vistas canónicas del Hub a un contrato de negocio sin repetir ninguna proyección. */
export function aSalidaDeResumen(vista: VistaDelDashboard, extras: ExtrasDeResumen, programaVisible: ProgramaDeResumen, enlace: string) {
  const grupo = vista.embudo.grupo;
  const dias = (escalon: "pago_rapido" | "pago_despues") => extras.escalera.principal.celdas[escalon].diasMedianos;
  const { planeacion, cumplimiento, roasProyectado } = extras;
  const requeridos = cumplimiento.requeridos;
  const razonSinRequeridos = !cumplimiento.cohorte
    ? "No hay una cohorte abierta para calcular el ritmo requerido."
    : cumplimiento.cohorte.cerrada
      ? "La cohorte ya cerró."
      : "No hay datos suficientes para calcular el ritmo requerido.";
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
    entro_a_caja: cajaConMonedaDelPrograma(vista.caja).map(({ moneda, total }) => ({ moneda, total })),
    tasas: {
      asistencia: { valor: vista.embudo.razonShow.valor, cobertura: grupo.cobertura, parcial: grupo.parcial },
      cierre_de_ventas: { valor: vista.embudo.razonCierre.valor, cobertura: grupo.cobertura, parcial: grupo.parcial },
      cita_a_venta: { valor: vista.embudo.agendaAVenta, cobertura: grupo.cobertura, parcial: grupo.parcial },
    },
    pauta: extras.pauta.map(({ clave, nombre, unidad, celdas }) => ({ clave, nombre, unidad, valor: celdas.total.valor, cobertura: celdas.total.cobertura })),
    perdidos: vista.embudoEtapas.motivosDePerdida.map((fila) => ({ motivo: fila.motivo, deals: fila.deals, ticket_perdido_usd: fila.ticketPerdidoUsd, deals_sin_ticket: fila.dealsSinTicket })),
    dias_cita_a_pago: { pago_rapido: dias("pago_rapido"), pago_despues: dias("pago_despues"), unidad: "dias_habiles" as const },
    norte: {
      cohorte: vista.cohorte ? {
        meta: vista.cohorte.meta, vendidos: vista.cohorte.vendidos, faltan: vista.cohorte.faltan,
        ventana: vista.cohorte.ventana ? {
          esperado: vista.cohorte.ventana.esperado,
          meta_dinamica: vista.cohorte.ventana.metaDinamica,
          meta_lineal: vista.cohorte.ventana.metaLineal,
          habiles_restantes: vista.cohorte.ventana.habilesRestantes,
        } : null,
      } : null,
      metas_del_mes: {
        meta_cupos: vista.metasDelMes.metaCupos, meta_usd: vista.metasDelMes.metaUsd,
        vendidos: vista.metasDelMes.vendidos, esperado: vista.metasDelMes.esperado, deuda: vista.metasDelMes.deuda,
        objetivo_semana: vista.metasDelMes.compensacionSemanal?.meta ?? null,
        por_dia_habil: vista.metasDelMes.compensacionCohorte?.porDia ?? null,
      },
    },
    cifras_derivadas: {
      comision: { total_usd: vista.comision.totalUsd, ventas_sin_comision: vista.comision.ventasSinComision },
      descuento: { promedio_usd: vista.descuento.promedioUsd, promedio_porcentaje: vista.descuento.promedioPct, ventas: vista.descuento.ventas },
      leads: { total: vista.leads.leads, objetivo_por_dia: vista.leads.metaLeadsDia, objetivo_del_rango: vista.leads.metaDelRango },
    },
    proyeccion: {
      dias_del_ritmo: { valor: planeacion.supuestos.ventanaDiasHabiles, unidad: "dias_habiles" as const },
      citas_minimas: { valor: planeacion.supuestos.muestraMinima, unidad: "personas" as const },
      ventas: { ...planeacion.proyeccion, unidad: "cupos" as const },
      leads_que_hacen_falta: { ...planeacion.leadsRequeridosDia, unidad: "personas_por_dia_habil" as const },
      presupuesto: {
        valor: cumplimiento.inversion?.llevamos ?? null,
        meta: cumplimiento.inversion?.meta ?? null,
        razon: cumplimiento.inversion ? null : "La cohorte no tiene un presupuesto de inversión activo.",
        unidad: "dinero" as const,
        moneda: "COP" as const,
      },
      agendas_dia: {
        valor: cumplimiento.agendasPorDia?.valor ?? null,
        razon: cumplimiento.agendasPorDia
          ? cumplimiento.agendasPorDia.valor === null ? "La venta abrió hoy y todavía no hay un día hábil completo." : null
          : "La cohorte no tiene una ventana de ventas abierta para calcular el promedio.",
        unidad: "citas_por_dia_habil" as const,
      },
      agendas_req: {
        valor: requeridos?.agendasDia.valor ?? null,
        razon: requeridos?.agendasDia.razon ?? (requeridos ? null : razonSinRequeridos),
        unidad: "citas_por_dia_habil" as const,
      },
      inversion_req: {
        valor: requeridos?.inversionDiaMeta ?? null,
        razon: requeridos?.inversionDiaMeta !== null && requeridos?.inversionDiaMeta !== undefined
          ? null
          : requeridos?.agendasDia.valor === null
            ? requeridos.agendasDia.razon ?? "No hay agendas requeridas con qué calcular la inversión."
            : requeridos ? "La cohorte no tiene un costo por agenda objetivo activo." : razonSinRequeridos,
        unidad: "dinero_por_dia_habil" as const,
        moneda: "COP" as const,
      },
      roas_proy: { valor: roasProyectado.valor, razon: roasProyectado.motivo, unidad: "veces" as const },
    },
  };
}
