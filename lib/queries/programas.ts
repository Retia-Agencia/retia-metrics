import { and, asc, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Los programas salen de la tabla `programs` (ADR 0012): agregar una fila los hace
 * aparecer en la navegacion y en su ruta, sin tocar codigo. Aqui viven las lecturas
 * que necesitan la nav, la ruta `/programas/[slug]` y la administracion (ticket 014).
 *
 * La base se recibe por inyeccion (por defecto la de la app) para poder correr los
 * tests sobre PGlite sin Neon, igual que el molde de catalogo.
 */

/** Programas activos, para pintar la navegacion. Ordenados por nombre. */
export async function programasActivos(
  db: Db = dbDeLaApp,
): Promise<{ slug: string; nombre: string }[]> {
  return db
    .select({ slug: programs.slug, nombre: programs.nombre })
    .from(programs)
    .where(eq(programs.activo, true))
    .orderBy(asc(programs.nombre));
}

/**
 * Programas activos con su id, para asignar closers a programas (ticket 015). La
 * membresia guarda el `programId` (uuid), asi que la pantalla necesita el id, no el
 * slug. Los programas salen de la base (ADR 0012): ningun literal en el codigo.
 */
export async function programasActivosParaAsignar(
  db: Db = dbDeLaApp,
): Promise<{ id: string; nombre: string }[]> {
  return db
    .select({ id: programs.id, nombre: programs.nombre })
    .from(programs)
    .where(eq(programs.activo, true))
    .orderBy(asc(programs.nombre));
}

/**
 * Un programa por su slug, solo si esta activo. Devuelve `null` si no existe o
 * esta inactivo: la ruta lo traduce a un 404 y no filtra que slugs existen.
 */
export async function programaActivoPorSlug(
  slug: string,
  db: Db = dbDeLaApp,
): Promise<{ id: string; slug: string; nombre: string } | null> {
  const [programa] = await db
    .select({ id: programs.id, slug: programs.slug, nombre: programs.nombre })
    .from(programs)
    .where(and(eq(programs.slug, slug), eq(programs.activo, true)))
    .limit(1);

  return programa ?? null;
}

/**
 * Un programa por su slug SIN filtrar por activo, para la administracion de sus
 * cohortes (ticket 014): un gerente puede querer cerrar o revisar las cohortes de un
 * programa que ya desactivo. Devuelve `null` si el slug no existe.
 */
export async function programaPorSlug(
  slug: string,
  db: Db = dbDeLaApp,
): Promise<{ id: string; slug: string; nombre: string; activo: boolean } | null> {
  const [programa] = await db
    .select({
      id: programs.id,
      slug: programs.slug,
      nombre: programs.nombre,
      activo: programs.activo,
    })
    .from(programs)
    .where(eq(programs.slug, slug))
    .limit(1);

  return programa ?? null;
}
