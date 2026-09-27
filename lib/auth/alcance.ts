import { and, asc, eq } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { miembrosPrograma, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esAdministrador, type Rol } from "./roles";

/**
 * "¿Qué programas ve esta sesión?" — LA respuesta, en un solo módulo (ADR 0048
 * punto 1, ticket 094, y la regla dura de AGENTS.md: si dos lugares responden la
 * misma pregunta, la respuesta vive en un módulo y los dos la importan).
 *
 * La regla: un closer ve SOLO los programas donde tiene una membresía ACTIVA en
 * `miembros_programa`; quien administra (`esAdministrador`: gerente o developer,
 * ADR 0025) ve todos los programas activos. El developer entra por la rama de
 * administrador, no por la de membresía, donde no tiene ninguna y vería cero
 * (ADR 0025 punto 5: no se le restringe nada).
 *
 * `esAdministrador`, NO `rol === "gerente"`: el literal escrito a mano deja al
 * developer afuera, que es justo el bug que este repo ya arregló en
 * `exigirAccesoAlPrograma` y en `buscarPersonas`. El rol que llega aquí es el ROL DE
 * VISTA (`rolDeVista`, ADR 0028), no `session.user.rol` crudo: un developer en vista
 * `closer` ve solo sus membresías, igual que un closer real; estrechar nunca
 * ensancha.
 *
 * El programa es una FRONTERA, no un filtro (AGENTS.md): una ruta o consulta que
 * cruza a un programa fuera del alcance no se desaconseja, se hace imposible. Por
 * eso toda lectura con programa importa este módulo en vez de repetir el join a
 * `miembros_programa` —cada copia es una frontera que alguien puede olvidar cerrar—.
 *
 * La base entra por inyección (por defecto la de la app) para correr los tests sobre
 * PGlite sin red, igual que el resto de `lib/queries/`.
 */

/** Un programa dentro del alcance de la sesión: id, slug y nombre. */
export interface ProgramaVisible {
  id: string;
  slug: string;
  nombre: string;
}

/**
 * Los programas ACTIVOS que ve esta sesión, ordenados por nombre.
 *
 * - Administrador (gerente o developer): todos los activos.
 * - Closer: solo aquellos donde tiene una membresía activa.
 *
 * Es la fuente única del selector de programa (ticket 097), de la guarda de toda
 * ruta con programa y de las consultas de lectura que se limitan al alcance.
 */
export async function programasVisibles(
  userId: string,
  rol: Rol | null,
  db: Db = dbDeLaApp,
): Promise<ProgramaVisible[]> {
  const columnas = { id: programs.id, slug: programs.slug, nombre: programs.nombre };

  if (esAdministrador(rol)) {
    return db
      .select(columnas)
      .from(programs)
      .where(eq(programs.activo, true))
      .orderBy(asc(programs.nombre));
  }

  return db
    .select(columnas)
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

/**
 * Los IDs de los programas que ve esta sesión, como `Set` para filtrar en memoria.
 *
 * A esta escala (~2 programas, ADR 0043) traer los ids y decidir en memoria es
 * gratis y se lee correcto, y evita una subconsulta correlacionada dentro de una
 * plantilla `sql` —que en este repo devuelve 0 sin lanzar error (AGENTS.md)—.
 */
export async function idsDeProgramasVisibles(
  userId: string,
  rol: Rol | null,
  db: Db = dbDeLaApp,
): Promise<Set<string>> {
  const visibles = await programasVisibles(userId, rol, db);
  return new Set(visibles.map((p) => p.id));
}

/**
 * Un programa ACTIVO por su slug, SOLO si está dentro del alcance de la sesión, o
 * `null` en cualquier otro caso: no existe, está inactivo, o existe pero es de otro
 * programa que esta sesión no ve.
 *
 * La ruta traduce el `null` a un 404 con `notFound()`, EXACTAMENTE igual que un slug
 * inexistente (ADR 0048 punto 1): un programa ajeno nunca responde 403, para no
 * filtrar qué slugs existen. Un closer que teclea el slug del otro programa recibe
 * un 404, no una pista de que el programa existe.
 */
export async function programaVisiblePorSlug(
  userId: string,
  rol: Rol | null,
  slug: string,
  db: Db = dbDeLaApp,
): Promise<ProgramaVisible | null> {
  const visibles = await programasVisibles(userId, rol, db);
  return visibles.find((p) => p.slug === slug) ?? null;
}

/**
 * `true` si el programa (por su id) está dentro del alcance de la sesión. Para las
 * fichas que se abren por id de otra entidad (una persona, un deal): se resuelve el
 * `programId` de la fila y se comprueba contra el alcance; si queda fuera, la ruta
 * responde 404 igual que un id inexistente (ticket 094).
 */
export async function programaEnAlcance(
  userId: string,
  rol: Rol | null,
  programId: string,
  db: Db = dbDeLaApp,
): Promise<boolean> {
  const ids = await idsDeProgramasVisibles(userId, rol, db);
  return ids.has(programId);
}
