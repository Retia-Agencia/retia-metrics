import { z } from "zod";
import { eq } from "drizzle-orm";
import { enlacesPago } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { asociarPrograma } from "./plataformas";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";
import { esquemaUrlHttps } from "./recursos";
import { reemplazarVersionado, type FilaVersionada } from "./versionar";
import { exigirAccesoAlPrograma, type ActorConAcceso } from "./acceso-programa";

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

/** Quien realiza la operacion: su id (para `change_log`) y su rol de vista (ADR 0028). */
export type Actor = ActorConAcceso;

/** Mensaje 403 propio de los enlaces de pago. */
const NEGADO_ENLACE = "No puedes gestionar enlaces de pago de un programa donde no vendes.";

/** Enlaza la regla de acceso compartida con el mensaje propio de los enlaces de pago. */
function exigirAcceso(db: Db, actor: Actor, programId: string): Promise<void> {
  return exigirAccesoAlPrograma(db, actor, programId, NEGADO_ENLACE);
}

/** Lee un enlace de pago por id (sin filtrar por activo), para conocer su programa. */
async function leerEnlace(db: Db, id: string): Promise<EnlacePagoVista | undefined> {
  const [fila] = await db.select().from(enlacesPago).where(eq(enlacesPago.id, id)).limit(1);
  return fila as EnlacePagoVista | undefined;
}

/**
 * Crea un enlace de pago vigente. El actor debe poder gestionar el programa destino
 * (administrador siempre; closer solo en sus programas activos). Un enlace de pago
 * SIEMPRE es de un programa (no hay global), asi que no aplica la asimetria del
 * recurso global.
 */
export async function crearEnlacePago(
  db: Db,
  actor: Actor,
  input: EntradaEnlacePago,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const datos = esquemaEnlacePago.parse(input);
    await exigirAcceso(db, actor, datos.programId);
    const fila = await moldeEnlaces(db).crear(actor.id, datos as unknown as CamposEnlacePago);
    // El vinculo plataforma-programa es dato propio, no derivado de esta tabla
    // (ADR 0034), asi que crear un enlace lo escribe si falta: si no, la plataforma
    // que el closer acaba de usar para cobrar NO le saldria en el selector del abono
    // de ese mismo programa. `asociarPrograma` es idempotente y ya verifico el acceso.
    await asociarPrograma(db, actor, datos.plataformaId, datos.programId);
    return fila as EnlacePagoVista;
  });
}

/**
 * Edita un enlace de pago. Un cambio de URL puntual va mejor por `reemplazar`. Se
 * exige acceso al programa GUARDADO y al de la ENTRADA (un closer no lo saca hacia
 * otro programa donde no vende).
 */
export async function editarEnlacePago(
  db: Db,
  actor: Actor,
  id: string,
  input: EntradaEnlacePago,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaEnlacePago.parse(input);
    const actual = await leerEnlace(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un enlace de pago con ese id.", 404);
    await exigirAcceso(db, actor, actual.programId);
    await exigirAcceso(db, actor, datos.programId);
    const fila = await moldeEnlaces(db).editar(actor.id, objetivoId, datos as unknown as CamposEnlacePago);
    return fila as EnlacePagoVista;
  });
}

/**
 * Reemplaza la URL de un enlace de pago conservando el historial (ADR 0017). Misma
 * logica que un recurso; vive en `versionar.ts`. Requiere acceso al programa.
 */
export async function reemplazarEnlacePago(
  db: Db,
  actor: Actor,
  id: string,
  nuevaUrl: string,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const url = esquemaUrlHttps.parse(nuevaUrl);
    const actual = await leerEnlace(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un enlace de pago con ese id.", 404);
    await exigirAcceso(db, actor, actual.programId);
    const fila = await reemplazarVersionado({
      db,
      tabla: enlacesPago,
      nombreTabla: "enlaces_pago",
      nombreEntidad: "un enlace de pago",
      etiqueta: (f: FilaVersionada) => `${f.monto} ${f.moneda}`,
      userId: actor.id,
      id: objetivoId,
      nuevaUrl: url,
    });
    return fila as unknown as EnlacePagoVista;
  });
}

/** Desactiva un enlace de pago (no lo borra). Requiere acceso al programa. */
export async function desactivarEnlacePago(
  db: Db,
  actor: Actor,
  id: string,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerEnlace(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un enlace de pago con ese id.", 404);
    await exigirAcceso(db, actor, actual.programId);
    const fila = await moldeEnlaces(db).desactivar(actor.id, objetivoId);
    return fila as EnlacePagoVista;
  });
}

/** Reactiva un enlace de pago desactivado. Requiere acceso al programa. */
export async function reactivarEnlacePago(
  db: Db,
  actor: Actor,
  id: string,
): Promise<EnlacePagoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerEnlace(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un enlace de pago con ese id.", 404);
    await exigirAcceso(db, actor, actual.programId);
    const fila = await moldeEnlaces(db).reactivar(actor.id, objetivoId);
    return fila as EnlacePagoVista;
  });
}
