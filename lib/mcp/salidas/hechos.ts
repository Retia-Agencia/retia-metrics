import { z } from "zod";

const filtroAplicado = z.object({
  campo: z.string().describe("Dimensión a la que se aplicó el filtro."),
  id: z.string().nullable().describe("Identificador resuelto; null significa que no se restringió."),
  nombre: z.string().describe("Nombre legible del valor resuelto."),
  origen: z.enum(["pedido", "por_defecto"]).describe("Indica si la persona lo pidió o si se aplicó por defecto."),
  como_quitarlo: z.string().optional().describe("Instrucción para quitar un valor aplicado por defecto."),
}).strict().describe("Filtro que realmente llegó a la consulta.");

export const salidaDeConsultaDeHechos = z.object({
  programa: z.object({
    nombre: z.string().describe("Nombre legible del programa."),
    slug: z.string().describe("Identificador opaco del programa."),
  }).strict().describe("Programa consultado."),
  hecho: z.string().describe("Tipo de hecho consultado."),
  periodo: z.object({
    desde: z.string().describe("Primer día incluido, en Bogotá."),
    hasta: z.string().describe("Último día incluido, en Bogotá."),
  }).strict().describe("Periodo efectivo de la consulta."),
  filtros_aplicados: z.array(filtroAplicado).describe("Filtros semánticos resueltos antes de consultar."),
  agrupado: z.boolean().describe("Verdadero cuando cada fila es un grupo y no un hecho individual."),
  filas: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
    .describe("Fila proyectada con dimensiones y medidas pedidas."))
    .describe("Filas de esta página."),
  total: z.number().int().describe("Cantidad total de filas o grupos en todas las páginas."),
  pagina: z.number().int().describe("Número de la página devuelta."),
  tamano_de_pagina: z.number().int().describe("Máximo de filas solicitado para esta página."),
  hay_otra_pagina: z.boolean().describe("Indica si existe una página posterior."),
}).strict();
