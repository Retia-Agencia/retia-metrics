import { z } from "zod";
import { categoriasRecurso } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moldeDeCatalogo } from "./molde";

/**
 * Categorias de recurso (ADR 0017, ADR 0012), sobre el molde de catalogo.
 *
 * Brochure, Pagina web, Guion, Formulario, Calendly, Drive... son filas editables,
 * no literales. Un solo esquema zod: lo usan el formulario, el route handler y
 * cualquier codigo. No hay dos validaciones de la misma cosa.
 */
export const esquemaCategoriaRecurso = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Maximo 80 caracteres."),
});

/** Entrada validada para crear o editar una categoria de recurso. */
export type EntradaCategoriaRecurso = z.infer<typeof esquemaCategoriaRecurso>;

/** Catalogo de categorias de recurso. Recibe la base (por defecto la de la app). */
export function categoriasDeRecurso(db?: Db) {
  return moldeDeCatalogo(
    {
      tabla: categoriasRecurso,
      nombreTabla: "categorias_recurso",
      esquema: esquemaCategoriaRecurso,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "una categoria de recurso",
    },
    db,
  );
}
