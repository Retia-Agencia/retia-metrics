import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Rol } from "@/lib/auth/roles";
import { idsDeProgramasVisibles } from "@/lib/auth/alcance";

/**
 * Lecturas sobre una persona (ADR 0021, 0023, 0011, 0013, 0015). Solo SELECT: lo
 * que escribe ya vive en `lib/mutations/*`. La base entra por inyeccion (por
 * defecto la de la app) para correr los tests sobre PGlite sin Neon, igual que
 * `lib/queries/programas.ts`.
 *
 Lo usa el buscador de Personas (y el de "Nuevo deal"): `buscarPersonas`. El
 * historial que vivia aqui (`historialDePersona`, ticket 006) se fue con el 073: la
 * ficha del Lead es `fichaDeLead` (`lib/queries/ficha-lead.ts`), dentro de su programa.
 *
 * El buscador se limita a los programas que ESA sesión ve, y esa pregunta la
 * contesta `programasVisibles` en `lib/auth/alcance.ts` (ADR 0048, ticket 094): un
 * closer solo sus membresías activas, quien administra todos los activos. Antes este
 * módulo tenía su PROPIO join a `miembros_programa` con su propia rama por rol; era
 * una frontera copiada, y una frontera copiada es una que alguien puede olvidar
 * cerrar. Ahora importa el alcance como todo lo demás.
 */

/** Una persona como la ve el buscador de `/mi-dia`. */
export interface PersonaEncontrada {
  id: string;
  nombre: string | null;
  emailNormalizado: string;
  telefono: string | null;
  programId: string;
  programaNombre: string;
  /** Por donde entro la persona (formulario o crm). */
  entrada: string;
}

/** Cuantas caracteres minimos exige el buscador antes de tocar la base. */
const MINIMO_TEXTO = 2;
/** Tope de filas: el buscador es para elegir a una persona, no para listar la base. */
const MAXIMO_FILAS = 20;

/**
 * Busca personas por nombre O por correo, insensible a mayusculas (ILIKE), dentro de
 * los programas que ESA sesión ve.
 *
 * Y "que ve" depende del rol, que es lo que este buscador no preguntaba (18-sep):
 * quien ADMINISTRA busca en todos los programas activos, un closer solo donde tiene
 * membresia activa. Antes el filtro era siempre la membresia, sin mirar el rol, y como
 * un gerente no necesita membresias, **un gerente no encontraba a nadie, nunca**. No
 * era un buscador vacio y ya: `/personas/[id]` solo se alcanza desde aqui, asi que un
 * gerente no tenia NINGUNA forma de abrir el historial de un lead. Misma familia que el
 * bug histórico de los catálogos: la pregunta era del rol y se contestó con la membresía. Desde el
 * 094 esa pregunta la contesta una sola funcion, `programasVisibles`, y este buscador
 * ya no la re-implementa: pide los ids del alcance y filtra por ellos.
 *
 * Con texto vacio o de menos de 2 caracteres devuelve un arreglo vacio sin tocar la
 * base: un buscador que ante "a" devuelve la base entera no sirve y filtra datos
 * personales de gente que nadie busco.
 */
export async function buscarPersonas(
  userId: string,
  rol: Rol | null,
  texto: string,
  db: Db = dbDeLaApp,
): Promise<PersonaEncontrada[]> {
  const termino = texto.trim();
  if (termino.length < MINIMO_TEXTO) return [];

  // El alcance —qué programas ve esta sesión— sale de la única función que lo
  // contesta (ADR 0048). Sin programas visibles no hay a quién buscar: se corta antes
  // de tocar la base.
  const idsVisibles = await idsDeProgramasVisibles(userId, rol, db);
  if (idsVisibles.size === 0) return [];

  // El `%` se escapa antes de meterlo en el patron para que un texto con `%` o `_`
  // no se lea como comodin de LIKE.
  const patron = `%${termino.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const columnas = {
    id: leads.id,
    nombre: leads.nombre,
    emailNormalizado: leads.emailNormalizado,
    telefono: leads.telefono,
    programId: leads.programId,
    programaNombre: programs.nombre,
    entrada: leads.entrada,
  };
  const coincide = or(ilike(leads.nombre, patron), ilike(leads.emailNormalizado, patron));
  const orden = [asc(leads.nombre), asc(leads.emailNormalizado)] as const;

  // Se filtra por los ids del alcance en memoria: a esta escala (~2 programas) traer
  // el alcance y usar `inArray` es gratis y evita repetir el join a `miembros_programa`
  // —cada copia de ese join es una frontera que puede quedar desincronizada—. El join
  // a `programs` sigue: proyecta el nombre del programa y no cruza nada, porque los
  // ids ya vienen acotados al alcance.
  return db
    .select(columnas)
    .from(leads)
    .innerJoin(programs, eq(programs.id, leads.programId))
    .where(and(inArray(leads.programId, [...idsVisibles]), coincide))
    .orderBy(...orden)
    .limit(MAXIMO_FILAS);
}
