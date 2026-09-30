import { z } from "zod";
import { canales as tablaCanales, formatoUtmEnum } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moldeDeCatalogo } from "./molde";

const valorUtm = z
  .string()
  .trim()
  .refine((valor) => !valor.includes("{{"), "Una macro no es un valor UTM válido.");

export const esquemaCanal = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Máximo 80 caracteres."),
  utmSource: valorUtm.transform((valor) => (valor === "" ? null : valor)),
  utmMedium: valorUtm.min(1, "El medium es obligatorio."),
  areaId: z.string().uuid("Área inválida."),
  formato: z.enum(formatoUtmEnum.enumValues).nullable(),
});

export type EntradaCanal = z.input<typeof esquemaCanal>;

/** Catálogo global de pares UTM y el área a la que pertenecen. */
export function canales(db?: Db) {
  return moldeDeCatalogo(
    {
      tabla: tablaCanales,
      nombreTabla: "canales",
      esquema: esquemaCanal,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un canal",
      mensajeDuplicado: "Ya existe un canal con ese par de source y medium.",
      dependientes: [],
    },
    db,
  );
}
