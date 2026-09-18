import { z } from "zod";
import { enlacesPago } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";
import { esquemaUrlHttps } from "./recursos";
import { reemplazarVersionado, type FilaVersionada } from "./versionar";

/**
 * Enlaces de pago como links (ADR 0017, ADR 0012), sobre el molde de catalogo.
 *
 * Un enlace de pago es un link ya generado (PayPal y demas) con el MONTO y la
 * MONEDA que cobra. La moneda vive al lado del monto y nunca se convierte en
 * silencio (restriccion dura de AGENTS.md): los links se generan a mano segun la
 * TRM del momento, asi que el monto es el que cobra ese link y nada mas.
 *
 * Igual que un recurso tiene `vigente` + `reemplazaA` y la misma operacion
 * `reemplazar(id, nuevaUrl)`: crear la fila nueva vigente y bajar la anterior sin
 * borrarla. `productoId` nulo = el link no corresponde a un producto del catalogo.
 *
 * El monto se recibe como texto (la columna es `numeric`, que Drizzle mapea a
 * string): un monto POSITIVO con hasta dos decimales, igual que en
 * `lib/abonos/esquema.ts`. Nunca pasa por un float.
 */

/** Monedas admitidas. Instancia NO: el codigo no crece con monedas, son un tipo fijo. */
export const MONEDAS = ["USD", "COP"] as const;

/** id: uuid o error de validacion (400). */
const esquemaId = z.string().uuid("El identificador no es válido.");

/** El unico esquema zod de un enlace de pago. */
export const esquemaEnlacePago = z.object({
  programId: z.string().uuid("Programa inválido."),
  productoId: z.string().uuid("Producto inválido.").optional(),
  plataformaId: z.string().uuid("Plataforma inválida."),
  monto: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "El monto debe ser un número (por ejemplo 797 o 797.00).")
    .refine((v) => Number(v) > 0, "El monto debe ser mayor que cero."),
  moneda: z.enum(MONEDAS).default("USD"),
  url: esquemaUrlHttps,
});

/** Entrada de un enlace de pago (lo que el llamador escribe). */
export type EntradaEnlacePago = z.input<typeof esquemaEnlacePago>;
/** Enlace de pago ya validado y normalizado. */
export type EnlacePagoValidado = z.output<typeof esquemaEnlacePago>;

/** Un enlace de pago tal como lo ve el llamador. */
export interface EnlacePagoVista extends FilaCatalogo {
  programId: string;
  productoId: string | null;
  plataformaId: string;
  monto: string;
  moneda: string;
  url: string;
  vigente: boolean;
  reemplazaA: string | null;
}

/** Columnas de `enlaces_pago` que el molde administra al crear/editar. */
type CamposEnlacePago = {
  programId: string;
  productoId?: string;
  plataformaId: string;
  monto: string;
  moneda: string;
  url: string;
};

/** Traduce un `ZodError` a un `ErrorDeApp` 400 con el primer mensaje. */
async function normalizando<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ErrorDeApp) throw error;
    if (error instanceof z.ZodError) {
      throw new ErrorDeApp(error.issues[0]?.message ?? "Petición inválida.", 400);
    }
    throw error;
  }
}

/** Valida el id como uuid; un id invalido sale como ErrorDeApp 400, nunca como 500. */
function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

/** Molde sobre `enlaces_pago`. Recibe la base por inyeccion. */
function moldeEnlaces(db: Db) {
  return moldeDeCatalogo<CamposEnlacePago>(
    {
      tabla: enlacesPago,
      nombreTabla: "enlaces_pago",
      esquema: esquemaEnlacePago as unknown as z.ZodType<CamposEnlacePago>,
      etiqueta: (fila) => `${fila.monto} ${fila.moneda}`,
      nombreEntidad: "un enlace de pago",
    },
    db,
  );
}

/** Crea un enlace de pago vigente. */
export async function crearEnlacePago(
  db: Db,
  userId: string,
  input: EntradaEnlacePago,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const datos = esquemaEnlacePago.parse(input);
    const fila = await moldeEnlaces(db).crear(userId, datos as unknown as CamposEnlacePago);
    return fila as EnlacePagoVista;
  });
}

/** Edita un enlace de pago. Un cambio de URL puntual va mejor por `reemplazar`. */
export async function editarEnlacePago(
  db: Db,
  userId: string,
  id: string,
  input: EntradaEnlacePago,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaEnlacePago.parse(input);
    const fila = await moldeEnlaces(db).editar(userId, objetivoId, datos as unknown as CamposEnlacePago);
    return fila as EnlacePagoVista;
  });
}

/**
 * Reemplaza la URL de un enlace de pago conservando el historial (ADR 0017). Misma
 * logica que un recurso; vive en `versionar.ts`.
 */
export async function reemplazarEnlacePago(
  db: Db,
  userId: string,
  id: string,
  nuevaUrl: string,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const url = esquemaUrlHttps.parse(nuevaUrl);
    const fila = await reemplazarVersionado({
      db,
      tabla: enlacesPago,
      nombreTabla: "enlaces_pago",
      nombreEntidad: "un enlace de pago",
      etiqueta: (f: FilaVersionada) => `${f.monto} ${f.moneda}`,
      userId,
      id: objetivoId,
      nuevaUrl: url,
    });
    return fila as unknown as EnlacePagoVista;
  });
}

/** Desactiva un enlace de pago (no lo borra). */
export async function desactivarEnlacePago(
  db: Db,
  userId: string,
  id: string,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const fila = await moldeEnlaces(db).desactivar(userId, idValido(id));
    return fila as EnlacePagoVista;
  });
}

/** Reactiva un enlace de pago desactivado. */
export async function reactivarEnlacePago(
  db: Db,
  userId: string,
  id: string,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const fila = await moldeEnlaces(db).reactivar(userId, idValido(id));
    return fila as EnlacePagoVista;
  });
}
