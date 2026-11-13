import { and, eq } from "drizzle-orm";
import { plataformasPago } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";

/**
 * Exige que la plataforma de pago exista y este activa antes de escribir un abono.
 * Se valida antes de insertar para dar un 400 claro en vez de un fallo de FK opaco,
 * y una plataforma desactivada no vuelve a entrar por la puerta de atras.
 *
 * La llama `registrarAbono`: todo abono operativo declara por donde entro el pago.
 * La columna sigue nullable para el historico y el importador.
 */
export async function exigirPlataformaActiva(
  plataformaId: string,
  db: Db,
): Promise<void> {
  const [plataforma] = await db
    .select({ id: plataformasPago.id })
    .from(plataformasPago)
    .where(and(eq(plataformasPago.id, plataformaId), eq(plataformasPago.activo, true)))
    .limit(1);

  if (!plataforma) {
    throw new ErrorDeApp("La plataforma de pago no existe o no está activa.", 400);
  }
}
