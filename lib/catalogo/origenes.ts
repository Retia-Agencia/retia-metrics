import { z } from "zod";
import { calls, origenes as tablaOrigenes } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moldeDeCatalogo } from "./molde";

/**
 * Origenes del lead (ADR 0012), sobre el molde de catalogo.
 *
 * Un solo esquema zod para toda la entidad: lo usan el formulario, el route
 * handler y cualquier codigo. No hay dos validaciones de la misma cosa.
 */
export const esquemaOrigen = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Maximo 80 caracteres."),
});

/** Entrada validada para crear o editar un origen. */
export type EntradaOrigen = z.infer<typeof esquemaOrigen>;

/** Catalogo de origenes del lead. Recibe la base (por defecto la de la app). */
export function origenes(db?: Db) {
  return moldeDeCatalogo(
    {
      tabla: tablaOrigenes,
      nombreTabla: "origenes",
      esquema: esquemaOrigen,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un origen",
      // Quien apunta a un origen: la columna `origen_id` de las llamadas (ADR 0026).
      dependientes: [{ tabla: calls, columna: calls.origenId }],
    },
    db,
  );
}
