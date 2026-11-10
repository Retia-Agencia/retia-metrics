import { z } from "zod";
import { ONBOARDING_STUDENTS, VALORES_ORDEN_STUDENTS } from "@/lib/queries/estudiantes";
import { NIVELES_PAUTA, type RenglonRoas, type VistaRoasDePauta } from "@/lib/queries/roas-de-pauta";
import type { CarteraVencida } from "@/lib/queries/cartera";
import type { VistaOrigen } from "@/lib/queries/origen";
import { descripcionDeMetrica } from "./campos";

const programa = z.object({
  nombre: z.string().describe("Nombre legible del programa."),
  slug: z.string().describe("Identificador opaco del programa usado en sus enlaces."),
}).strict().describe("Programa al que pertenecen todas las cifras y filas.");

const periodo = z.object({
  desde: z.string().describe("Primer día incluido, en Bogotá, con formato AAAA-MM-DD."),
  hasta: z.string().describe("Último día incluido, en Bogotá, con formato AAAA-MM-DD."),
}).strict().describe("Periodo de las cifras, en días de Bogotá.");

const dinero = (descripcion: string) => z.object({
  valor: z.number().describe("Valor monetario sin formato."),
  moneda: z.string().min(3).max(3).describe("Moneda del valor, sin conversiones."),
  legible: z.string().describe("Valor monetario listo para mostrar, con su moneda."),
}).strict().describe(descripcion);

export const salidaDeCarteraVencida = z.object({
  programa,
  fecha_de_corte: z.string().describe("Fecha de corte en Bogotá, con formato AAAA-MM-DD."),
  filtros: z.object({
    cohorte: z.string().describe("Identificador opaco de la cohorte elegida, o todas."),
    onboarding: z.enum(ONBOARDING_STUDENTS).nullable().describe("Estado de onboarding aplicado, o null cuando se incluyen ambos."),
    busqueda: z.string().nullable().describe("Texto de búsqueda aplicado, o null cuando no se filtró por texto."),
    orden: z.enum(VALORES_ORDEN_STUDENTS).describe("Orden aplicado a las filas."),
  }).strict().describe("Filtros resueltos con los mismos criterios de Students."),
  total: z.number().int().describe("Cantidad de deals en cartera vencida que cumplen los filtros."),
  pagina: z.number().int().describe("Página devuelta."),
  hay_otra_pagina: z.boolean().describe("Indica si quedan filas en otra página."),
  filas: z.array(z.object({
    id_del_deal: z.string().describe("Identificador opaco del deal."),
    id_de_la_persona: z.string().describe("Identificador opaco de la persona."),
    nombre: z.string().nullable().describe("Nombre de la persona, cuando está disponible."),
    email: z.string().describe("Correo principal de la persona."),
    saldo: dinero("Saldo vencido del deal; siempre conserva su moneda.").nullable().describe("Saldo vencido, o null cuando no se puede expresar con moneda."),
    fecha_limite: z.string().describe("Fecha límite de pago con formato AAAA-MM-DD."),
    fecha_definida_en_el_deal: z.boolean().describe("Indica si la fecha límite fue definida en el deal y no heredada de la cohorte."),
    dias_de_atraso: z.number().int().describe("Días calendario transcurridos desde la fecha límite."),
    acuerdo_de_pago: z.string().nullable().describe("Acuerdo de pago registrado, cuando existe."),
    enlace: z.string().url().describe("Enlace al deal en el CRM."),
    enlace_de_la_persona: z.string().url().describe("Enlace a la ficha de la persona en el CRM."),
  }).strict().describe("Deal con saldo vencido.")).describe("Deals de la cartera vencida."),
}).strict();

type ProgramaVisible = { nombre: string; slug: string };
type FiltrosCartera = { cohorte: string; onboarding: (typeof ONBOARDING_STUDENTS)[number] | null; busqueda: string | null; orden: (typeof VALORES_ORDEN_STUDENTS)[number] };

export function aSalidaDeCarteraVencida(
  cartera: CarteraVencida,
  programaVisible: ProgramaVisible,
  fechaDeCorte: string,
  filtros: FiltrosCartera,
  enlaces: { deal: (id: string) => string; persona: (id: string) => string },
  dineroLegible: (valor: number, moneda: string) => string,
) {
  const filas = cartera.vencidos.map((fila) => ({
    id_del_deal: fila.dealId,
    id_de_la_persona: fila.leadId,
    nombre: fila.nombreLead,
    email: fila.emailLead,
    saldo: fila.moneda === null ? null : { valor: fila.saldo, moneda: fila.moneda, legible: dineroLegible(fila.saldo, fila.moneda) },
    fecha_limite: fila.fechaLimite,
    fecha_definida_en_el_deal: fila.fechaPropia,
    dias_de_atraso: fila.diasDeAtraso,
    acuerdo_de_pago: fila.acuerdoPago,
    enlace: enlaces.deal(fila.dealId),
    enlace_de_la_persona: enlaces.persona(fila.leadId),
  }));
  return { programa: programaVisible, fecha_de_corte: fechaDeCorte, filtros, total: filas.length, filas };
}

const roas = z.object({
  valor: z.number().nullable().describe("Retorno por cada dólar gastado; null significa que no se puede calcular."),
  base: z.number().int().describe("Ventas con valor vendido que sí cubren el cálculo."),
  faltan: z.number().int().describe("Ventas sin valor vendido que impiden completar el cálculo."),
  motivo: z.string().nullable().describe("Razón por la que el cálculo es parcial o no calculable, cuando aplica."),
  agendas_pendientes: z.number().int().describe("Citas por venir de deals abiertos sin venta que aún pueden subir el ROAS; con alguna, el estado es parcial."),
  estado: z.enum(["completa", "parcial", "no_calculable"]).describe("Estado de cobertura del cálculo."),
  legible: z.string().describe("ROAS listo para mostrar, o — cuando no se puede calcular."),
}).strict().describe("ROAS con su cobertura explícita.");

export const salidaDePautaRoas = z.object({
  programa,
  periodo,
  nivel: z.enum(NIVELES_PAUTA).describe("Nivel de la jerarquía de pauta consultado."),
  identificador: z.string().nullable().describe("Identificador opaco del nivel consultado, o null para el total."),
  nombre: z.string().describe("Nombre legible del nivel consultado."),
  envios: z.number().int().describe("Cantidad de envíos atribuidos a este nivel."),
  agendadas: z.number().int().describe(descripcionDeMetrica("agendadas")),
  realizadas: z.number().int().describe(descripcionDeMetrica("shows")),
  no_asistio: z.number().int().describe(descripcionDeMetrica("no_asistio")),
  ventas: z.number().int().describe(descripcionDeMetrica("ventas")),
  vendido: dinero(descripcionDeMetrica("vendido")),
  gasto: dinero("Gasto de pauta convertido a USD para el periodo.").nullable().describe("Gasto en USD, o null cuando no está disponible (por canal: Meta da el gasto por anuncio); null nunca es 0."),
  roas,
  precision_del_origen: z.object({
    hasta_el_anuncio: z.number().int().describe("Envíos atribuidos hasta un anuncio exacto."),
    hasta_campana_o_conjunto: z.number().int().describe("Envíos atribuidos a campaña o conjunto, pero no a un anuncio."),
    solo_pauta: z.number().int().describe("Envíos identificados como pauta sin campaña."),
  }).strict().describe("Precisión con la que se pudo atribuir el origen de los envíos."),
  enlace: z.string().url().describe("Enlace a Pauta en el Hub del programa."),
}).strict();

export function aSalidaDePautaRoas(args: {
  programa: ProgramaVisible; periodo: { desde: string; hasta: string }; fila: RenglonRoas;
  vista: VistaRoasDePauta; estado: "completa" | "parcial" | "no_calculable"; roasLegible: string;
  enlace: string; dineroLegible: (valor: number, moneda: string) => string;
}) {
  const { fila } = args;
  // La llave interna va en snake_case al contrato; copiarla tal cual la rechaza el `.strict()` (403 F0).
  const { agendasPendientes, ...roasSinPendientes } = fila.roas;
  return {
    programa: args.programa, periodo: args.periodo, nivel: fila.nivel, identificador: fila.id, nombre: fila.nombre,
    envios: fila.registros, agendadas: fila.agendas, realizadas: fila.shows, no_asistio: fila.noShows, ventas: fila.ventas,
    vendido: { valor: fila.valorVendidoUsd, moneda: "USD", legible: args.dineroLegible(fila.valorVendidoUsd, "USD") },
    gasto: fila.gastoUsd === null ? null : { valor: fila.gastoUsd, moneda: "USD", legible: args.dineroLegible(fila.gastoUsd, "USD") },
    roas: { ...roasSinPendientes, agendas_pendientes: agendasPendientes ?? 0, estado: args.estado, legible: args.roasLegible },
    precision_del_origen: {
      hasta_el_anuncio: args.vista.cobertura.anuncio,
      hasta_campana_o_conjunto: args.vista.cobertura.soloCampanaOConjunto,
      solo_pauta: args.vista.cobertura.sinCampana,
    },
    enlace: args.enlace,
  };
}

export const salidaDeOrigenDelPrograma = z.object({
  programa,
  periodo,
  total_de_envios: z.number().int().describe("Cantidad total de envíos del periodo."),
  canales: z.array(z.object({
    nombre: z.string().describe("Nombre legible del origen."),
    envios: z.number().int().describe("Cantidad de envíos de este origen."),
    agendadas: z.number().int().describe(descripcionDeMetrica("agendadas")),
    porcentaje_del_total: z.number().nullable().describe("Proporción de todos los envíos, o null cuando no aplica."),
    porcentaje_de_agendadas: z.number().nullable().describe(`Proporción de envíos de este origen que agendaron cita, o null cuando no se puede calcular.`),
  }).strict().describe("Resumen de un origen visible en el Hub.")).describe("Orígenes del periodo."),
  precision_de_pauta: z.array(z.object({
    titulo: z.string().describe("Nivel legible de precisión."),
    detalle: z.string().describe("Explicación de lo que se conoce en este nivel."),
    envios: z.number().int().describe("Cantidad de envíos con este nivel de precisión."),
  }).strict()).describe("Desglose de la precisión disponible para los envíos de pauta."),
  envios_sin_pieza_reconocida: z.number().int().describe("Envíos de contenido cuya pieza no se pudo reconocer."),
  enlace: z.string().url().describe("Enlace a Origen en el Hub del programa."),
}).strict();

export function aSalidaDeOrigenDelPrograma(args: {
  programa: ProgramaVisible; periodo: { desde: string; hasta: string }; vista: VistaOrigen;
  canales: { nombre: string; registros: number; agendas: number; porcentajeDelTotal: number | null; porcentajeAgenda: number | null }[];
  precision: { nivel: "N1" | "N2" | "N3"; titulo: string; detalle: string; registros: number }[]; enlace: string;
}) {
  const detallePorNivel = {
    N3: "Se sabe el anuncio exacto que trajo el envío.",
    N2: "Se sabe la campaña o el conjunto, pero no el anuncio.",
    N1: "Llegó por pauta, pero sin datos para ubicar la campaña.",
  } as const;
  return {
    programa: args.programa, periodo: args.periodo, total_de_envios: args.vista.totalEnvios,
    canales: args.canales.map((fila) => ({
      nombre: fila.nombre, envios: fila.registros, agendadas: fila.agendas,
      porcentaje_del_total: fila.porcentajeDelTotal, porcentaje_de_agendadas: fila.porcentajeAgenda,
    })),
    precision_de_pauta: args.precision.map((fila) => ({
      titulo: fila.titulo,
      detalle: detallePorNivel[fila.nivel],
      envios: fila.registros,
    })),
    envios_sin_pieza_reconocida: args.vista.piezasDesconocidas.envios,
    enlace: args.enlace,
  };
}
