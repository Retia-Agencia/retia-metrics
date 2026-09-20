import { z } from "zod";
import { abonos, enlacesPago, plataformasPago } from "@/lib/db/schema";
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
      // Quien apunta a una plataforma por FK `restrict`: los abonos (`plataforma_id`)
      // y los enlaces de pago (`plataforma_id`). Se declaran las DOS: si solo se
      // contaran los abonos, un enlace de pago que aun la usa daria conteo cero y el
      // `DELETE` chocaria contra su FK, saliendo como el 400 de "carrera" cuando en
      // realidad la plataforma SI esta en uso. Contar ambas hace que se desactive y
      // se explique, que es lo correcto.
      dependientes: [
        { tabla: abonos, columna: abonos.plataformaId },
        { tabla: enlacesPago, columna: enlacesPago.plataformaId },
      ],
    },
    db,
  );
}
