import { and, eq, ilike, or, sql } from "drizzle-orm";
import { leadContactos, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * El texto mínimo para que una búsqueda cuente: por debajo de esto no se filtra NADA
 * (una sola letra devolvería medio programa y no ayuda a nadie).
 */
export const MINIMO_TEXTO_BUSQUEDA = 2;

/**
 * Los ids de los leads de UN programa cuyo nombre, correo normalizado, un contacto correo
 * o un teléfono (`leads.telefono` o un contacto teléfono, por dígitos) casan con el texto.
 *
 * - **El programa es frontera** (ADR 0043): recibe UN `programId` y jamás cruza a otro; el
 *   `leadContactos.programId` denormalizado deja hacerlo en el mismo `where`.
 * - **Una sola respuesta a "¿quién casa con este texto?"** (AGENTS.md): la usan la búsqueda
 *   de Deals (`buscarDealsDelPrograma`), Calls, Students y las Notificaciones de Mi espacio,
 *   para que todas las pantallas filtren igual.
 * - Devuelve `null` cuando el texto es más corto que `MINIMO_TEXTO_BUSQUEDA`: eso significa
 *   "no hay búsqueda, no filtres", distinto de un `Set` vacío ("nadie casa").
 *
 * El escape de `like` (`\`, `%`, `_`) y el emparejamiento por dígitos del teléfono (solo con
 * 4 o más dígitos) son los mismos que traía `buscarDealsDelPrograma`.
 */
export async function leadsQueCasan(
  db: Db,
  programId: string,
  texto: string,
): Promise<Set<string> | null> {
  const termino = texto.trim();
  if (termino.length < MINIMO_TEXTO_BUSQUEDA) return null;

  const patron = `%${termino.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)}%`;
  const digitos = termino.replace(/[^0-9]/g, "");
  const patronTelefono = `%${digitos}%`;
  const coincidenciaTelefono =
    digitos.length >= 4
      ? or(
          sql`regexp_replace(${leads.telefono}, '[^0-9]', '', 'g') like ${patronTelefono}`,
          and(
            eq(leadContactos.tipo, "telefono"),
            sql`regexp_replace(${leadContactos.valor}, '[^0-9]', '', 'g') like ${patronTelefono}`,
          ),
        )
      : undefined;

  const filas = await db
    .selectDistinct({ leadId: leads.id })
    .from(leads)
    .leftJoin(
      leadContactos,
      and(eq(leadContactos.leadId, leads.id), eq(leadContactos.programId, programId)),
    )
    .where(
      and(
        eq(leads.programId, programId),
        or(
          ilike(leads.nombre, patron),
          ilike(leads.emailNormalizado, patron),
          and(eq(leadContactos.tipo, "correo"), ilike(leadContactos.valor, patron)),
          coincidenciaTelefono,
        ),
      ),
    );

  return new Set(filas.map((fila) => fila.leadId));
}
