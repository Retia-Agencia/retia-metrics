import { and, asc, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { miembrosPrograma, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Los programas salen de la tabla `programs` (ADR 0012): agregar una fila los hace
 * aparecer en la navegacion y en su ruta, sin tocar codigo. Aqui viven las lecturas
 * que necesitan la nav, la ruta `/programas/[slug]` y la administracion (ticket 014).
 *
 * La base se recibe por inyeccion (por defecto la de la app) para poder correr los
 * tests sobre PGlite sin Neon, igual que el molde de catalogo.
 */

/**
 * LA definicion de "programa activo" del proyecto: activo = true, ordenados por
 * nombre (ADR 0024). Devuelve id, slug y nombre, y cada pantalla toma lo que
 * necesita: el slug para la navegacion y las URLs (id opaco), el uuid para los
 * formularios que escriben.
 *
 * Estuvo partida en tres funciones que solo se diferenciaban en las columnas que
 * proyectaban (`programasActivos`, `programasActivosParaAsignar`,
 * `programasParaRecursos`). Ninguna cifra derivada corria peligro, pero cambiar que
 * cuenta como "activo" obligaba a acordarse de las tres, y la cuarta pantalla
 * habria agregado una cuarta. Una sola consulta, varias proyecciones en el
 * llamador.
 *
 * `programasGestionablesPorUsuario` NO se fusiono aca: no responde "cuales estan
 * activos" sino "cuales puede tocar esta persona", que es una regla de negocio
 * distinta (la membresia activa) y no una proyeccion.
 */
export async function programasActivos(
  db: Db = dbDeLaApp,
): Promise<{ id: string; slug: string; nombre: string }[]> {
  return db
    .select({ id: programs.id, slug: programs.slug, nombre: programs.nombre })
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

/**
 * Programas activos que un usuario puede gestionar en `/productos` (ticket 017,
 * ADR 0016). Un gerente los ve todos; un closer solo aquellos donde tiene una
 * membresia ACTIVA. Devuelve id + nombre (la pantalla agrupa los productos por
 * programa y necesita el id para crear). Los programas salen de la base: ningun
 * literal en el codigo.
 */
export async function programasGestionablesPorUsuario(
  userId: string,
  rol: "gerente" | "closer",
  db: Db = dbDeLaApp,
): Promise<{ id: string; nombre: string }[]> {
  if (rol === "gerente") {
    return db
      .select({ id: programs.id, nombre: programs.nombre })
      .from(programs)
      .where(eq(programs.activo, true))
      .orderBy(asc(programs.nombre));
  }
  return db
    .select({ id: programs.id, nombre: programs.nombre })
    .from(programs)
    .innerJoin(miembrosPrograma, eq(miembrosPrograma.programId, programs.id))
    .where(
      and(
        eq(programs.activo, true),
        eq(miembrosPrograma.userId, userId),
        eq(miembrosPrograma.activo, true),
      ),
    )
    .orderBy(asc(programs.nombre));
}
