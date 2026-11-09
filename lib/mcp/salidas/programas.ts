import { z } from "zod";

export const salidaDeProgramasVisibles = z.object({
  programas: z.array(z.object({
    nombre: z.string().describe("Nombre legible del programa."),
    slug: z.string().describe("Identificador opaco del programa que se usa en las demás herramientas."),
  }).strict().describe("Programa activo que puede consultar la persona actual."))
    .describe("Programas activos que puede consultar la persona actual."),
}).strict();
