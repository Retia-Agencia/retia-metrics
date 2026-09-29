import { and, eq } from "drizzle-orm";
import { miembrosPrograma, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { trabajaLeads } from "@/lib/auth/roles";

/**
 * **¿Quién puede ser dueño de un deal de ESTE programa?** (ticket 074, ADR 0043). Una sola
 * respuesta para las dos preguntas que la hacen: la lista que ofrece la pantalla para
 * reasignar y la reja de `editarDeal` que la escribe. Si vivieran separadas, la pantalla
 * podría ofrecer a alguien que el servidor rechaza, o peor, el servidor aceptar a alguien
 * que la pantalla nunca ofreció.
 *
 * Un dueño posible es un usuario ACTIVO que `trabajaLeads` (closer o developer, ADR 0003 y
 * 0025) con membresía ACTIVA en el programa. 🩸 Sin la membresía, un administrador podía
 * darle el deal a un closer de OTRO programa: un deal cuyo dueño no ve su programa (ADR
 * 0048), que no le sale en ningún Inbox y que cruza la frontera del programa sin error.
 *
 * No acota una lectura a una sesión (eso es `lib/auth/alcance.ts`): decide de quién puede
 * ser una fila. Por eso es excepción nombrada en `tests/alcance-de-sesion.test.ts`.
 */
export interface DuenoPosible {
  id: string;
  nombre: string;
}

export async function duenosPosibles(db: Db, programId: string): Promise<DuenoPosible[]> {
  const filas = await db
    .select({ id: users.id, nombre: users.nombre, email: users.email, rol: users.rol })
    .from(miembrosPrograma)
    .innerJoin(users, eq(users.id, miembrosPrograma.userId))
    .where(and(eq(miembrosPrograma.programId, programId), eq(miembrosPrograma.activo, true), eq(users.activo, true)));
  return filas
    .filter((f) => trabajaLeads(f.rol))
    .map((f) => ({ id: f.id, nombre: f.nombre ?? f.email }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function esDuenoPosible(db: Db, programId: string, userId: string): Promise<boolean> {
  return (await duenosPosibles(db, programId)).some((d) => d.id === userId);
}
