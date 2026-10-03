import { z } from "zod";
import { diaHabilSiguiente } from "@/lib/dias-habiles";
import { hoyEnBogota } from "@/lib/format";
import type { PendienteDeal } from "@/lib/deals/etapas";

export function proximoContactoSugerido(hoy: string): string {
  return diaHabilSiguiente(diaHabilSiguiente(hoy));
}

export const esquemaProximoContacto = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.")
  .nullable()
  .optional()
  .refine((valor) => valor == null || valor > hoyEnBogota(), {
    message: "El próximo contacto tiene que ser una fecha futura.",
  });

export function proximoContactoVencido(
  deal: { pendiente: PendienteDeal | null; fechaSeguimiento: string | null },
  hoy: string,
): boolean {
  return deal.pendiente === "seguimiento"
    && deal.fechaSeguimiento != null
    && deal.fechaSeguimiento < hoy;
}
