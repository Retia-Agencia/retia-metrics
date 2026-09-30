import { z } from "zod";
import { estadosLlegada as tablaEstadosLlegada, prioridadLlegadaEnum } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";

/**
 * Los Estados de llegada de cada programa (ticket 117, ADR 0061), sobre el molde de
 * catalogo (ADR 0012): cada alta, edicion o desactivacion deja su fila en `change_log`.
 * Nadie los borra: un Estado que ya abrio deals se desactiva, y desactivado deja de
 * reconocerse (el envio queda "sin estado", visible).
 *
 * Las ETAPAS de entrada posibles si son un tipo (el motor solo deja nacer un deal en
 * Pendiente Setteo o Agendado, ADR 0037); que valor va a cual no.
 */
export const ETAPAS_DE_ENTRADA = ["pendiente_setteo", "agendado"] as const;

export const esquemaEstadoLlegada = z.object({
  programId: z.string().uuid("Programa inválido."),
  valor: z
    .string()
    .trim()
    .min(1, "El valor es obligatorio.")
    .max(80, "Máximo 80 caracteres.")
    .refine((valor) => !valor.includes("{{"), "Una macro sin expandir no es un Estado."),
  etapaEntrada: z.enum(ETAPAS_DE_ENTRADA).nullable(),
  prioridad: z.enum(prioridadLlegadaEnum.enumValues),
  alertaMinutos: z
    .number()
    .int("Los minutos son un número entero.")
    .positive("Los minutos de alerta van en positivo.")
    .max(10_080, "Máximo una semana (10.080 minutos).")
    .nullable(),
});

export type EntradaEstadoLlegada = z.input<typeof esquemaEstadoLlegada>;

/** El catálogo de Estados de llegada. Recibe la base (por defecto la de la app). */
export function estadosDeLlegada(db?: Db) {
  const molde = moldeDeCatalogo(
    {
      tabla: tablaEstadosLlegada,
      nombreTabla: "estados_llegada",
      esquema: esquemaEstadoLlegada,
      etiqueta: (fila) => String(fila.valor),
      nombreEntidad: "un Estado de llegada",
      mensajeDuplicado: "Ese programa ya tiene ese Estado de llegada.",
      dependientes: [],
    },
    db,
  );

  return {
    ...molde,
    /**
     * Una fila no cambia de programa: el valor significa algo DENTRO de su programa (ADR
     * 0043). Editarla a otro programa seria borrar un Estado y crear otro sin rastro.
     */
    async editar(userId: string, id: string, input: EntradaEstadoLlegada): Promise<FilaCatalogo> {
      const [actual] = (await molde.listar()).filter((fila) => fila.id === id);
      if (actual && actual.programId !== input.programId) {
        throw new ErrorDeApp("Un Estado de llegada no cambia de programa.", 422);
      }
      return molde.editar(userId, id, input);
    },
  };
}
