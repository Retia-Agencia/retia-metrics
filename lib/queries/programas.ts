import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { programs } from "@/lib/db/schema";

/**
 * Los programas salen de la tabla `programs` (ADR 0012): agregar una fila los hace
 * aparecer en la navegacion y en su ruta, sin tocar codigo. Aqui viven las dos
 * lecturas que necesitan la nav y la ruta `/programas/[slug]`.
 */

/** Programas activos, para pintar la navegacion. Ordenados por nombre. */
export async function programasActivos(): Promise<{ slug: string; nombre: string }[]> {
  return db
    .select({ slug: programs.slug, nombre: programs.nombre })
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
): Promise<{ id: string; slug: string; nombre: string } | null> {
  const [programa] = await db
    .select({ id: programs.id, slug: programs.slug, nombre: programs.nombre })
    .from(programs)
    .where(and(eq(programs.slug, slug), eq(programs.activo, true)))
    .limit(1);

  return programa ?? null;
}
