import { z } from "zod";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import type { FilaLead } from "@/lib/queries/leads";

const programa = z.object({
  nombre: z.string().describe("Nombre legible del programa."),
  slug: z.string().describe("Identificador opaco del programa usado en sus enlaces."),
}).strict().describe("Programa al que pertenecen todas las personas encontradas.");

const fila = z.object({
  id_de_la_persona: z.string().describe("Identificador opaco de la persona."),
  nombre: z.string().nullable().describe("Nombre de la persona, cuando está disponible."),
  email: z.string().describe("Correo principal de la persona."),
  telefono: z.string().nullable().describe("Teléfono de la persona, cuando está disponible."),
  calidad: z.string().nullable().describe("Calidad comercial asignada a la persona, cuando existe."),
  estado_del_deal: z.string().nullable().describe("Etapa actual del deal, cuando la persona tiene uno."),
  fecha_de_ultima_aplicacion: z.string().nullable().describe("Fecha de la última aplicación en Bogotá, con formato AAAA-MM-DD, o null cuando no está disponible."),
  enlace_de_la_persona: z.string().url().describe("Enlace a la ficha de la persona en el CRM."),
}).strict().describe("Persona encontrada, limitada a los campos visibles de negocio.");

export const salidaDeBuscarLeads = z.object({
  programa,
  total: z.number().int().describe("Cantidad total de personas que cumplen la búsqueda y los filtros."),
  pagina: z.number().int().describe("Número de la página devuelta."),
  hay_otra_pagina: z.boolean().describe("Indica si se puede pedir la página siguiente."),
  filas: z.array(fila).describe("Personas incluidas en esta página."),
}).strict();

type ProgramaVisible = { nombre: string; slug: string };

export function aSalidaDeBuscarLeads(
  resultado: { filas: FilaLead[]; total: number },
  programaVisible: ProgramaVisible,
  pagina: number,
  hayOtraPagina: boolean,
  enlaceDePersona: (id: string) => string,
) {
  return {
    programa: programaVisible,
    total: resultado.total,
    pagina,
    hay_otra_pagina: hayOtraPagina,
    filas: resultado.filas.map((fila) => ({
      id_de_la_persona: fila.id,
      nombre: fila.nombre,
      email: fila.email,
      telefono: fila.telefono,
      calidad: fila.leadQuality,
      estado_del_deal: fila.etapa,
      fecha_de_ultima_aplicacion: fila.fechaUltimaAplicacion ? fechaDeInstanteEnBogota(fila.fechaUltimaAplicacion) : null,
      enlace_de_la_persona: enlaceDePersona(fila.id),
    })),
  };
}
