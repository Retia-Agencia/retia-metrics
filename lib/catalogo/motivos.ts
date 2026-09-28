import { z } from "zod";
import { calls, dealEtapaHistorial, deals, motivos as tablaMotivos, tipoMotivoEnum } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moldeDeCatalogo } from "./molde";

/**
 * Motivos de perdida de una llamada (ADR 0012, ADR 0015), sobre el molde de
 * catalogo.
 *
 * Un solo esquema zod para toda la entidad: lo usan el formulario, el route
 * handler y cualquier codigo. No hay dos validaciones de la misma cosa.
 *
 * `tipo` decide a que LISTA pertenece (Mani 27-sep, ticket 103): el motor solo acepta
 * un motivo de la lista que la flecha pide (P `perdida`, T29 `reagenda`, T15
 * `retroceso`, R `recuperacion`). Es TIPO y no catalogo porque el codigo decide con el.
 * Default `perdida`: todo lo que existia antes del 27-sep era de perdida (ADR 0015), y
 * la pantalla que no lo elija crea uno de perdida sin romperse.
 */
export const esquemaMotivo = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Maximo 80 caracteres."),
  tipo: z.enum(tipoMotivoEnum.enumValues).default("perdida"),
});

/** Entrada validada para crear o editar un motivo (con `tipo` opcional: default `perdida`). */
export type EntradaMotivo = z.input<typeof esquemaMotivo>;

/** Catalogo de motivos. Recibe la base (por defecto la de la app). */
export function motivos(db?: Db) {
  // El molde se parametriza con la ENTRADA (`z.input`), donde `tipo` es opcional por su
  // default: asi el catalogo generico —que solo escribe `nombre`— sigue creando motivos
  // (de `perdida`) sin pasar `tipo`, y el tipo encaja con `EntradaCatalogo`.
  return moldeDeCatalogo<EntradaMotivo>(
    {
      tabla: tablaMotivos,
      nombreTabla: "motivos",
      esquema: esquemaMotivo as unknown as z.ZodType<EntradaMotivo>,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un motivo",
      // Quien lo referencia por FK `restrict` (ADR 0026 punto 5). Sin esto el molde contaba
      // cero y un motivo ya usado reventaba con la FK al borrarse, en vez de desactivarse.
      dependientes: [
        { tabla: calls, columna: calls.motivoId },
        { tabla: deals, columna: deals.motivoId },
        { tabla: dealEtapaHistorial, columna: dealEtapaHistorial.motivoId },
      ],
    },
    db,
  );
}
