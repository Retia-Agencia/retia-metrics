import { and, desc, eq, inArray, or } from "drizzle-orm";
import { changeLog, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

export interface CambioDeDueno {
  de: string | null;
  a: string | null;
  cuando: Date;
  por: string | null;
}

/** Lectura canónica de la bitácora asociada a uno o varios deals. */
export async function cambiosDeDeals(db: Db, dealIds: readonly string[], idsRelacionados: readonly string[] = []) {
  const ids = [...new Set(dealIds)];
  if (ids.length === 0) return [];
  return db.select().from(changeLog).where(
    idsRelacionados.length > 0
      ? or(and(eq(changeLog.tabla, "deals"), inArray(changeLog.registroId, ids)), inArray(changeLog.registroId, [...idsRelacionados]))
      : and(eq(changeLog.tabla, "deals"), inArray(changeLog.registroId, ids)),
  ).orderBy(desc(changeLog.detectadoEn));
}

/** Último cambio trazado de dueño por deal, con nombres de negocio y no ids. */
export async function cambiosDeDuenoDeDeals(
  db: Db,
  dealIds: readonly string[],
): Promise<Map<string, CambioDeDueno>> {
  const ids = [...new Set(dealIds)];
  if (ids.length === 0) return new Map();
  const cambios = (await cambiosDeDeals(db, ids)).filter((cambio) => cambio.campo === "ownerUserId" || cambio.campo === "owner_user_id").map((cambio) => ({
    dealId: cambio.registroId,
    anterior: cambio.valorAnterior,
    nuevo: cambio.valorNuevo,
    cuando: cambio.detectadoEn,
    porId: cambio.userId,
  }));

  const idsDeUsuarios = [...new Set(cambios.flatMap((cambio) => [
    cambio.anterior,
    cambio.nuevo,
    cambio.porId,
  ]).filter((id): id is string => id !== null))];
  const filasDeUsuarios = idsDeUsuarios.length > 0
    ? await db.select({ id: users.id, nombre: users.nombre, email: users.email })
      .from(users).where(inArray(users.id, idsDeUsuarios))
    : [];
  const nombres = new Map(filasDeUsuarios.map((usuario) => [usuario.id, usuario.nombre ?? usuario.email]));
  const resultado = new Map<string, CambioDeDueno>();
  for (const cambio of cambios) {
    if (!cambio.dealId || resultado.has(cambio.dealId)) continue;
    resultado.set(cambio.dealId, {
      de: cambio.anterior ? nombres.get(cambio.anterior) ?? null : null,
      a: cambio.nuevo ? nombres.get(cambio.nuevo) ?? null : null,
      cuando: cambio.cuando,
      por: cambio.porId ? nombres.get(cambio.porId) ?? null : null,
    });
  }
  return resultado;
}
