import { and, eq } from "drizzle-orm";
import { plataformasPago } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";

/**
 * Exige que la plataforma de pago exista y este activa antes de escribir un abono.
 * Se valida antes de insertar para dar un 400 claro en vez de un fallo de FK opaco,
 * y una plataforma desactivada no vuelve a entrar por la puerta de atras.
 *
 * Sin `plataformaId` no hay nada que validar: la columna es opcional (un abono puede
 * registrarse sin saber todavia por donde entro).
 *
 * La comparten el primer abono de una venta (ticket 002) y los abonos posteriores
 * (ticket 019).
 */
export async function exigirPlataformaActiva(
  plataformaId: string | undefined,
  db: Db,
): Promise<void> {
  if (!plataformaId) return;

  const [plataforma] = await db
    .select({ id: plataformasPago.id })
    .from(plataformasPago)
    .where(and(eq(plataformasPago.id, plataformaId), eq(plataformasPago.activo, true)))
    .limit(1);

  if (!plataforma) {
    throw new ErrorDeApp("La plataforma de pago no existe o no está activa.", 400);
  }
}
