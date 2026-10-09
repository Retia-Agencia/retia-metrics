import { z } from "zod";
import { areas as tablaAreas, canales as tablaCanales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { moldeDeCatalogo } from "./molde";

/**
 * Areas de Retia (ticket 083, ADR 0043), sobre el molde de catalogo.
 *
 * Un solo esquema zod para toda la entidad: lo usan el formulario, el route
 * handler y cualquier codigo. No hay dos validaciones de la misma cosa.
 */
export const esquemaArea = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Maximo 80 caracteres."),
});

/** Entrada validada para crear o editar un area. */
export type EntradaArea = z.infer<typeof esquemaArea>;

/** Catalogo de areas de Retia. Recibe la base (por defecto la de la app). */
export function areas(db?: Db) {
  return moldeDeCatalogo(
    {
      tabla: tablaAreas,
      nombreTabla: "areas",
      esquema: esquemaArea,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un área",
      dependientes: [{ tabla: tablaCanales, columna: tablaCanales.areaId }],
    },
    db,
  );
}

/**
 * Que un area exista y este activa antes de ponerla en un deal (ticket 121). Una sola
 * respuesta para el motor y la edicion del deal: la FK solo mira que exista.
 */
export async function exigirAreaActiva(db: Db, areaId: string): Promise<void> {
  // Por el molde y no con un select propio: el catalogo tiene tres o cuatro filas.
  const activas = await areas(db).listar({ soloActivos: true });
  if (!activas.some((a) => a.id === areaId)) throw new ErrorDeApp("El área no existe o está inactiva.", 422);
}
