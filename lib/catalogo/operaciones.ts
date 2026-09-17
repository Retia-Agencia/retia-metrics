import { z, ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { ErrorDeApp } from "@/lib/errors";
import type { Db } from "@/lib/db/tipos";
import type { FilaCatalogo } from "./molde";
import { catalogoPorSlug, type EntradaCatalogo } from "./registro";

/**
 * Operaciones detras de la pantalla de catalogos (ticket 013, ADR 0012).
 *
 * Cada operacion:
 *  1. Pasa por `requireRole("gerente")` en el servidor (ADR 0003: el closer nunca
 *     entra, sin importar la ruta). La barrera es de servidor, no de UI.
 *  2. Resuelve el catalogo por su slug contra el registro (slug desconocido = 400).
 *  3. Valida el `id` como uuid antes de tocar la base: un id que no es uuid es un
 *     error de validacion (400), no un 500 del driver de Postgres. Esto salda la
 *     deuda que dejo el ticket 011, sin tocar el molde.
 *  4. Delega en el molde, que valida la entrada con el esquema zod de la entidad y
 *     escribe `change_log` con el `userId` de quien hizo el cambio.
 *
 * La base se recibe por inyeccion (por defecto la de la app) para poder correr los
 * tests sobre PGlite sin Neon. El archivo NO lleva `"use server"`: es logica pura
 * que las server actions (`app/(app)/ajustes/catalogos/acciones.ts`) envuelven.
 */

/** id de una fila de catalogo: uuid o error de validacion (400). */
const esquemaId = z
  .string()
  .uuid("El identificador no es válido.");

function catalogoODescartar(slug: string) {
  const def = catalogoPorSlug(slug);
  if (!def) throw new ErrorDeApp("Catálogo desconocido.", 400);
  return def;
}

/** Valida el id como uuid; un id invalido sale como ErrorDeApp 400, nunca como 500. */
function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

/**
 * Corre una operacion del molde normalizando sus errores al contrato de lib/errors:
 * el molde lanza `ZodError` cuando la entrada no valida, que aca se traduce a un
 * `ErrorDeApp` 400. Asi el llamador (la server action y su cliente) recibe siempre
 * un `ErrorDeApp` con `status`, y nunca se filtra un error interno del driver.
 */
async function normalizando<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ErrorDeApp) throw error;
    if (error instanceof ZodError) {
      throw new ErrorDeApp(error.issues[0]?.message ?? "Petición inválida.", 400);
    }
    throw error;
  }
}

/** Lista los items de un catalogo (activos e inactivos). Solo gerente. */
export async function listarItems(db: Db, slug: string): Promise<FilaCatalogo[]> {
  await requireRole("gerente");
  const def = catalogoODescartar(slug);
  return def.fabrica(db).listar();
}

/** Crea un item. Solo gerente. La entrada se valida con el esquema del catalogo. */
export async function crearItem(
  db: Db,
  slug: string,
  input: EntradaCatalogo,
): Promise<FilaCatalogo> {
  const session = await requireRole("gerente");
  const def = catalogoODescartar(slug);
  return normalizando(() => def.fabrica(db).crear(session.user.id, input));
}

/** Renombra un item. Solo gerente. Valida id (uuid) y entrada. */
export async function renombrarItem(
  db: Db,
  slug: string,
  id: string,
  input: EntradaCatalogo,
): Promise<FilaCatalogo> {
  const session = await requireRole("gerente");
  const def = catalogoODescartar(slug);
  return normalizando(() => def.fabrica(db).editar(session.user.id, idValido(id), input));
}

/** Desactiva un item (no lo borra). Solo gerente. Valida id (uuid). */
export async function desactivarItem(db: Db, slug: string, id: string): Promise<FilaCatalogo> {
  const session = await requireRole("gerente");
  const def = catalogoODescartar(slug);
  return normalizando(() => def.fabrica(db).desactivar(session.user.id, idValido(id)));
}

/** Reactiva un item desactivado. Solo gerente. Valida id (uuid). */
export async function reactivarItem(db: Db, slug: string, id: string): Promise<FilaCatalogo> {
  const session = await requireRole("gerente");
  const def = catalogoODescartar(slug);
  return normalizando(() => def.fabrica(db).reactivar(session.user.id, idValido(id)));
}
