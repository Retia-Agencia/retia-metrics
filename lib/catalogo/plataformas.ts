import { z } from "zod";
import { plataformasPago } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moldeDeCatalogo } from "./molde";

/**
 * Plataformas de pago (ADR 0012), estrenando el molde de catalogo.
 *
 * Un solo esquema zod para toda la entidad: lo usan el formulario, el route
 * handler y cualquier codigo. No hay dos validaciones de la misma cosa.
 */
export const esquemaPlataformaPago = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Maximo 80 caracteres."),
});

/** Entrada validada para crear o editar una plataforma de pago. */
export type EntradaPlataformaPago = z.infer<typeof esquemaPlataformaPago>;

/** Catalogo de plataformas de pago. Recibe la base (por defecto la de la app). */
export function plataformasDePago(db?: Db) {
  return moldeDeCatalogo(
    {
      tabla: plataformasPago,
      nombreTabla: "plataformas_pago",
      esquema: esquemaPlataformaPago,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "una plataforma de pago",
    },
    db,
  );
}
