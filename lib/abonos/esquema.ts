import { z } from "zod";

/**
 * Esquema zod de un abono (ADR 0013). Solo la validacion del borde: las funciones
 * que escriben abonos viven en el ticket 019.
 *
 * La moneda vive al lado del monto para que nunca se convierta en silencio
 * (restriccion dura de AGENTS.md). Por decision de Michael (16-sep) hoy solo se
 * acepta `USD`; se usa `z.literal` para que agregar otra moneda sea un cambio
 * explicito de codigo y no un valor que se cuele.
 *
 * El monto se recibe como texto (la columna es `numeric`, que Drizzle mapea a
 * string): un adelanto POSITIVO con hasta dos decimales. Cero o negativo no es un
 * abono.
 */
export const esquemaAbono = z.object({
  saleId: z.string().uuid("Venta inválida."),
  programId: z.string().uuid("Programa inválido."),
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD."),
  monto: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser un número (por ejemplo 750 o 750.00).")
    .refine((v) => Number(v) > 0, "El monto debe ser mayor que cero."),
  moneda: z.literal("USD").default("USD"),
  plataformaId: z.string().uuid("Plataforma inválida.").optional(),
  comprobanteUrl: z.string().url("El comprobante debe ser una URL válida.").optional(),
});

/** Entrada de un abono (lo que el llamador escribe). */
export type EntradaAbono = z.input<typeof esquemaAbono>;
/** Abono ya validado y normalizado. */
export type AbonoValidado = z.output<typeof esquemaAbono>;
