import { z } from "zod";
import { motivos as tablaMotivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moldeDeCatalogo } from "./molde";

/**
 * Motivos de perdida de una llamada (ADR 0012, ADR 0015), sobre el molde de
 * catalogo.
 *
 * Un solo esquema zod para toda la entidad: lo usan el formulario, el route
 * handler y cualquier codigo. No hay dos validaciones de la misma cosa.
 */
export const esquemaMotivo = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Maximo 80 caracteres."),
});

/** Entrada validada para crear o editar un motivo. */
export type EntradaMotivo = z.infer<typeof esquemaMotivo>;

/** Catalogo de motivos. Recibe la base (por defecto la de la app). */
export function motivos(db?: Db) {
  return moldeDeCatalogo(
    {
      tabla: tablaMotivos,
      nombreTabla: "motivos",
      esquema: esquemaMotivo,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un motivo",
    },
    db,
  );
}
