import { eq } from "drizzle-orm";
import { miembrosPrograma, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * El dueño de una venta sembrada en un test. Desde la migracion 0120 la base rechaza una venta
 * vigente (Abonado o Completo) sin `owner_user_id` (CHECK `deals_venta_con_dueno`, ADR 0122).
 *
 * Devuelve el id de UN closer del programa, y lo crea la primera vez (con su membresia activa);
 * las siguientes llamadas con el mismo programa devuelven el mismo. Es idempotente sobre la base
 * del test, asi que sobrevive a `vaciar()` (que borra los usuarios y lo vuelve a crear).
 */
export async function duenoDePrueba(db: Db, programId: string): Promise<string> {
  const email = `dueno-${programId}@dueno.test`;
  const [existente] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existente) return existente.id;
  const [closer] = await db.insert(users).values({ email, rol: "closer", closerId: `Dueno ${programId.slice(0, 8)}` }).returning();
  await db.insert(miembrosPrograma).values({ userId: closer.id, programId });
  return closer.id;
}
