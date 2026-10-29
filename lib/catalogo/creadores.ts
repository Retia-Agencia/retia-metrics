import { z } from "zod";
import { creadores as tablaCreadores, piezas, tiposPieza as tablaTiposPieza } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esRedDeContenido } from "@/lib/media/redes";
import { moldeDeCatalogo } from "./molde";

/**
 * El catalogo de creadores (ticket 316, ADR 0110) y el de tipos de pieza, sobre el molde de
 * catalogo (ADR 0012). Un creador puede NO tener programa: tiene pipeline, no link ni
 * embudo. Un solo esquema zod por entidad; el rastro en `change_log` y el "se desactiva si ya
 * se uso" (ADR 0026) los pone el molde.
 *
 * `cuentas` es `{ red: handle }` y solo informa; la red sale de la lista cerrada
 * (`lib/media/redes.ts`), no de texto libre.
 */
export const esquemaCreador = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Máximo 80 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "El slug es obligatorio.")
    .max(40, "Máximo 40 caracteres.")
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones."),
  cuentas: z
    .record(z.string(), z.string().trim().min(1).max(80))
    .default({})
    .refine((c) => Object.keys(c).every(esRedDeContenido), "Una de las redes de las cuentas no existe."),
  programId: z.string().uuid().nullable().default(null),
});
export type EntradaCreador = z.input<typeof esquemaCreador>;

export function creadores(db?: Db) {
  return moldeDeCatalogo<EntradaCreador>(
    {
      tabla: tablaCreadores,
      nombreTabla: "creadores",
      esquema: esquemaCreador as unknown as z.ZodType<EntradaCreador>,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un creador",
      mensajeDuplicado: "Ya existe un creador con ese slug.",
      dependientes: [{ tabla: piezas, columna: piezas.creadorId }],
    },
    db,
  );
}

export const esquemaTipoPieza = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(60, "Máximo 60 caracteres."),
});
export type EntradaTipoPieza = z.input<typeof esquemaTipoPieza>;

export function tiposDePieza(db?: Db) {
  return moldeDeCatalogo<EntradaTipoPieza>(
    {
      tabla: tablaTiposPieza,
      nombreTabla: "tipos_pieza",
      esquema: esquemaTipoPieza,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un tipo de pieza",
      dependientes: [{ tabla: piezas, columna: piezas.tipoId }],
    },
    db,
  );
}
