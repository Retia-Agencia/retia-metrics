import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { miembrosPrograma, productos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { esAdministrador, type Rol } from "@/lib/auth/roles";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";

/**
 * Productos por programa (ticket 017, ADR 0016, ADR 0012), sobre el molde de catalogo.
 *
 * Un producto es una instancia editable colgada de un programa: el programa
 * completo, la reserva de cupo, la mentoria 1:1... La tabla `productos` tiene `id` y
 * `activo`, asi que el molde maneja crear/editar/desactivar/reactivar + `change_log`
 * por campo que cambia. Lo que el molde NO expresa vive aca:
 *
 *  - **Quien puede tocarlo (ADR 0016).** Gerentes y closers administran productos —
 *    la unica config que un closer edita. Pero un closer solo ve y edita los
 *    productos de programas donde tiene una membresia ACTIVA; tocar el producto de
 *    otro programa es un 403. Un gerente entra a cualquier programa. Esta es una
 *    regla de datos (a que programa pertenece este producto), aparte de la barrera
 *    de rol que ya enforza `requireRole("gerente","closer")` en la ruta.
 *  - **Un solo esquema zod:** `programId` uuid, `nombre` (trim, 1..80), `precioLista`
 *    positivo con hasta dos decimales, `moneda` enum ["USD","COP"] con default "USD".
 *    La moneda vive al lado del numero y nunca se convierte en silencio (restriccion
 *    dura de AGENTS.md).
 *
 * La base se recibe por inyeccion (por defecto la de la app) para correr los tests
 * sobre PGlite sin Neon. Este archivo NO lleva `"use server"`: es logica pura que
 * las server actions envuelven, igual que `lib/catalogo/programas.ts`.
 */

/** Monedas admitidas. Instancia NO: el codigo no crece con monedas, son un tipo fijo. */
export const MONEDAS = ["USD", "COP"] as const;

/** id de un producto o de un programa: uuid o error de validacion (400). */
const esquemaId = z.string().uuid("El identificador no es válido.");

/**
 * El unico esquema zod de un producto. Lo usan la pantalla, las server actions y
 * cualquier codigo: una sola validacion de la misma entidad.
 *
 * El precio se recibe como texto (la columna es `numeric`, que Drizzle mapea a
 * string): debe ser un monto POSITIVO con hasta dos decimales. Cero o negativo se
 * rechaza (no tiene sentido un producto que valga 0).
 */
export const esquemaProducto = z.object({
  programId: z.string().uuid("Programa inválido."),
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(80, "Máximo 80 caracteres."),
  precioLista: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "El precio debe ser un monto (por ejemplo 797 o 797.00).")
    .refine((v) => Number(v) > 0, "El precio debe ser mayor que cero."),
  moneda: z.enum(MONEDAS).default("USD"),
});

/** Entrada validada de un producto (lo que el llamador escribe). */
export type EntradaProducto = z.input<typeof esquemaProducto>;
/** Producto ya validado y normalizado. */
export type ProductoValidado = z.output<typeof esquemaProducto>;

/** Quien realiza la operacion: su id (para `change_log`) y su rol (para el guard de datos). */
export interface Actor {
  id: string;
  rol: Rol;
}

/** Un producto tal como lo ve el llamador (fila del molde con columnas tipadas). */
export interface ProductoVista extends FilaCatalogo {
  programId: string;
  nombre: string;
  precioLista: string;
  moneda: string;
}

/** Valida el id como uuid; un id invalido sale como ErrorDeApp 400, nunca como 500. */
function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

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

/** Columnas de `productos` que el molde administra. */
type CamposProducto = {
  programId: string;
  nombre: string;
  precioLista: string;
  moneda: string;
};

/** Molde sobre `productos`. Recibe la base por inyeccion. */
function moldeProductos(db: Db) {
  return moldeDeCatalogo<CamposProducto>(
    {
      tabla: productos,
      nombreTabla: "productos",
      esquema: esquemaProducto as unknown as z.ZodType<CamposProducto>,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un producto",
    },
    db,
  );
}

/**
 * Enforza la regla de datos del ADR 0016: quien ADMINISTRA entra a cualquier
 * programa; un closer solo a los programas donde tiene una membresia ACTIVA. Un
 * closer que toca el producto de otro programa recibe un 403 (aparte de la barrera
 * de rol de la ruta). No es seguridad de UI: se verifica aqui, en el servidor,
 * contra la base.
 *
 * "Administrar" es `esAdministrador`, no `rol === "gerente"`: el developer tambien
 * administra (ADR 0025) y no es miembro de ningun programa, asi que el chequeo a
 * mano lo mandaba al camino de la membresia y le negaba con un 403 que ademas
 * mentia ("donde no vendes": el developer no vende en ninguno). Misma forma del
 * bug que el ticket 029 arreglo en `/ajustes/usuarios`.
 */
async function exigirAccesoAlPrograma(db: Db, actor: Actor, programId: string): Promise<void> {
  if (esAdministrador(actor.rol)) return;
  const [membresia] = await db
    .select({ id: miembrosPrograma.id })
    .from(miembrosPrograma)
    .where(
      and(
        eq(miembrosPrograma.userId, actor.id),
        eq(miembrosPrograma.programId, programId),
        eq(miembrosPrograma.activo, true),
      ),
    )
    .limit(1);
  if (!membresia) {
    throw new ErrorDeApp("No puedes gestionar productos de un programa donde no vendes.", 403);
  }
}

/** Lee una fila de producto por id (sin filtrar por activo). */
async function leerProducto(db: Db, id: string): Promise<ProductoVista | undefined> {
  const [fila] = await db.select().from(productos).where(eq(productos.id, id)).limit(1);
  return fila as ProductoVista | undefined;
}

/**
 * Lista todos los productos de un programa (activos e inactivos), para la pantalla
 * de administracion. Ordenados por nombre.
 */
export async function listarProductos(db: Db, programId: string): Promise<ProductoVista[]> {
  const filas = await db
    .select()
    .from(productos)
    .where(eq(productos.programId, idValido(programId)))
    .orderBy(asc(productos.nombre));
  return filas as ProductoVista[];
}

/**
 * Productos ACTIVOS de un programa, para elegir al registrar una venta. Un producto
 * desactivado no aparece aca; las ventas viejas lo siguen mostrando via `productoPorId`.
 */
export async function productosActivos(db: Db, programId: string): Promise<ProductoVista[]> {
  const filas = await db
    .select()
    .from(productos)
    .where(and(eq(productos.programId, idValido(programId)), eq(productos.activo, true)))
    .orderBy(asc(productos.nombre));
  return filas as ProductoVista[];
}

/**
 * Un producto por id, ACTIVO O NO. Lo usa una venta ya registrada para mostrar el
 * producto que se le vendio aunque despues se haya desactivado. Devuelve `null` si
 * no existe.
 */
export async function productoPorId(db: Db, id: string): Promise<ProductoVista | null> {
  return normalizando(async () => {
    const fila = await leerProducto(db, idValido(id));
    return fila ?? null;
  });
}

/**
 * Crea un producto. El actor debe poder gestionar el programa destino (gerente
 * siempre; closer solo si es miembro activo). La entrada se valida con el esquema
 * compartido y el molde escribe `change_log` con el `userId` del actor.
 */
export async function crearProducto(
  db: Db,
  actor: Actor,
  input: EntradaProducto,
): Promise<ProductoVista> {
  return normalizando(async () => {
    const datos = esquemaProducto.parse(input);
    await exigirAccesoAlPrograma(db, actor, datos.programId);
    const fila = await moldeProductos(db).crear(actor.id, datos);
    return fila as ProductoVista;
  });
}

/**
 * Edita un producto. Valida id (uuid) y entrada. El actor debe poder gestionar
 * tanto el programa guardado como el de la entrada (un closer no puede sacar un
 * producto de su programa hacia otro donde no vende).
 */
export async function editarProducto(
  db: Db,
  actor: Actor,
  id: string,
  input: EntradaProducto,
): Promise<ProductoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaProducto.parse(input);
    const actual = await leerProducto(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un producto con ese id.", 404);
    await exigirAccesoAlPrograma(db, actor, actual.programId);
    await exigirAccesoAlPrograma(db, actor, datos.programId);
    const fila = await moldeProductos(db).editar(actor.id, objetivoId, datos);
    return fila as ProductoVista;
  });
}

/** Desactiva un producto (no lo borra). Requiere acceso al programa del producto. */
export async function desactivarProducto(
  db: Db,
  actor: Actor,
  id: string,
): Promise<ProductoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerProducto(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un producto con ese id.", 404);
    await exigirAccesoAlPrograma(db, actor, actual.programId);
    const fila = await moldeProductos(db).desactivar(actor.id, objetivoId);
    return fila as ProductoVista;
  });
}

/** Reactiva un producto desactivado. Requiere acceso al programa del producto. */
export async function reactivarProducto(
  db: Db,
  actor: Actor,
  id: string,
): Promise<ProductoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerProducto(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un producto con ese id.", 404);
    await exigirAccesoAlPrograma(db, actor, actual.programId);
    const fila = await moldeProductos(db).reactivar(actor.id, objetivoId);
    return fila as ProductoVista;
  });
}
