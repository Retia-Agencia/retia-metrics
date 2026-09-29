import { and, eq } from "drizzle-orm";
import { miembrosPrograma, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esAccesoTotal, trabajaLeads } from "@/lib/auth/roles";

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
 * **El developer es dueño posible en TODO programa, con o sin membresía** (ADR 0025 punto 5:
 * al developer no se le restringe nada). Exigirle membresía seria el `rol === "..."` que lo
 * deja afuera, escrito de otra forma.
 *
 * No acota una lectura a una sesión (eso es `lib/auth/alcance.ts`): decide de quién puede
 * ser una fila. Por eso es excepción nombrada en `tests/alcance-de-sesion.test.ts`.
 */
export interface DuenoPosible {
  id: string;
  nombre: string;
}

export async function duenosPosibles(db: Db, programId: string): Promise<DuenoPosible[]> {
  const [miembros, activos] = await Promise.all([
    db
      .select({ id: users.id })
      .from(miembrosPrograma)
      .innerJoin(users, eq(users.id, miembrosPrograma.userId))
      .where(and(eq(miembrosPrograma.programId, programId), eq(miembrosPrograma.activo, true))),
    db.select({ id: users.id, nombre: users.nombre, email: users.email, rol: users.rol }).from(users).where(eq(users.activo, true)),
  ]);
  const conMembresia = new Set(miembros.map((m) => m.id));
  return activos
    .filter((u) => trabajaLeads(u.rol) && (conMembresia.has(u.id) || esAccesoTotal(u.rol)))
    .map((u) => ({ id: u.id, nombre: u.nombre ?? u.email }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function esDuenoPosible(db: Db, programId: string, userId: string): Promise<boolean> {
  return (await duenosPosibles(db, programId)).some((d) => d.id === userId);
}
