import { z } from "zod";
import { METRICAS_DE_LISTA } from "@/lib/queries/filtros-de-lista";
import { campoDeMetrica, campoPorMoneda, descripcionDeMetrica } from "./campos";

const programa = z.object({
  nombre: z.string().describe("Nombre legible del programa."),
  slug: z.string().describe("Identificador opaco del programa usado en sus enlaces."),
}).strict().describe("Programa al que pertenecen el resumen y las filas.");

const periodo = z.object({
  desde: z.string().describe("Primer día incluido, en Bogotá, con formato AAAA-MM-DD."),
  hasta: z.string().describe("Último día incluido, en Bogotá, con formato AAAA-MM-DD."),
}).strict().describe("Periodo consultado, en días de Bogotá.");

const dinero = z.object({
  valor: z.number().describe("Valor monetario sin formato."),
  moneda: z.string().min(3).max(3).describe("Moneda del valor, sin conversiones."),
}).strict().describe("Valor monetario y su moneda.");

const lineaDeDesglose = z.object({
  nombre: z.string().describe("Nombre legible del grupo."),
  cantidad: z.number().describe("Cantidad de filas de la métrica en este grupo."),
  entro_a_caja: z.array(campoPorMoneda("entro_a_caja", { unidad: "dinero", monedas: ["usd", "cop"] }))
    .describe("Entró a caja en el grupo, separado por moneda."),
}).strict();

const fila = z.object({
  fecha: z.string().describe("Fecha de negocio de la fila, en Bogotá."),
  cita_en: z.string().nullable().describe("Instante de la cita en formato ISO, o null cuando la fila no es una cita."),
  resultado: z.string().nullable().describe("Resultado legible de la cita, cuando aplica."),
  responsable: z.string().nullable().describe("Nombre del responsable visible para el rol actual."),
  codigo_del_responsable: z.string().describe("Código opaco que puede usarse en el filtro closer de otra consulta."),
  etapa: z.string().nullable().describe("Etapa de negocio del deal, cuando aplica."),
  dias_sin_actividad: z.number().describe("Días transcurridos desde la actividad que rige esta fila."),
  rango_de_antiguedad: z.string().describe("Rango legible de días sin actividad."),
  valor: dinero.nullable().describe("Valor principal de la fila, o null cuando la métrica no lleva dinero."),
  recaudado: dinero.nullable().describe("Recaudado de esta venta, o null cuando no aplica o no se puede calcular."),
  por_cobrar: dinero.nullable().describe("Por cobrar de esta venta, o null cuando no aplica o no se puede calcular."),
  concepto: z.string().nullable().describe("Concepto de negocio asociado a la fila, cuando aplica."),
  nota: z.string().nullable().describe("Nota visible asociada a la fila, cuando aplica."),
  cantidad: z.number().describe("Cantidad que representa la fila."),
  persona: z.object({
    nombre: z.string().nullable().describe("Nombre de la persona, cuando está disponible."),
    id: z.string().describe("Identificador opaco de la persona."),
  }).strict().nullable().describe("Persona asociada a la fila, cuando el rol puede verla."),
  ultima_actividad: z.string().nullable().describe("Fecha de la última actividad, cuando aplica."),
  enlace: z.string().url().nullable().describe("Enlace al deal o a la persona para verificar la fila."),
}).strict().describe("Fila de negocio de la métrica, proyectada según el rol actual.");

export const salidaDeConsultaDeMetrica = z.object({
  programa,
  metrica: z.enum(METRICAS_DE_LISTA).describe("Clave canónica o identificador de la métrica aceptado por la consulta."),
  periodo,
  resumen: z.object({
    disponible: z.boolean().describe("Indica si la métrica se puede calcular con los datos disponibles."),
    total: z.number().describe("Cantidad total de filas que cumplen la métrica y los filtros."),
    entro_a_caja: z.array(campoPorMoneda("entro_a_caja", { unidad: "dinero", monedas: ["usd", "cop"] }))
      .describe("Entró a caja en toda la consulta, separado por moneda."),
    vendido: campoDeMetrica("vendido", { unidad: "dinero", monedas: ["usd"] }).nullable().describe(descripcionDeMetrica("vendido")),
    recaudado: campoDeMetrica("recaudado", { unidad: "dinero", monedas: ["usd"] }).nullable().describe(descripcionDeMetrica("recaudado")),
    por_cobrar: campoDeMetrica("por_cobrar", { unidad: "dinero", monedas: ["usd"] }).nullable().describe(descripcionDeMetrica("por_cobrar")),
  }).strict().describe("Resumen de la métrica antes de paginar sus filas."),
  desgloses: z.object({
    por_responsable: z.array(lineaDeDesglose).describe("Totales agrupados por responsable."),
    por_etapa: z.array(lineaDeDesglose).describe("Totales agrupados por etapa de negocio."),
    por_antiguedad: z.array(lineaDeDesglose).describe("Totales agrupados por rango de antigüedad."),
  }).strict().describe("Desgloses del mismo total; no son filas adicionales."),
  paginacion: z.object({
    pagina: z.number().int().describe("Número de la página devuelta."),
    filas_en_esta_pagina: z.number().int().describe("Cantidad de filas incluidas en esta respuesta."),
    hay_siguiente: z.boolean().describe("Indica si se puede pedir la página siguiente."),
  }).strict().describe("Estado de la paginación de las filas."),
  filas: z.array(fila).describe("Filas de esta página."),
  enlace: z.string().url().describe("Enlace al Hub del programa para verificar la consulta."),
}).strict();
