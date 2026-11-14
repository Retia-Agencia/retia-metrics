import { avisosPendientesCloserEnvios } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { hoyEnBogota } from "@/lib/format";
import type { VentanaPendientes } from "./contrato";
import { avisosPendientesDeClosers } from "./armar";

interface ConfirmacionPendientes {
  userId: string;
  ventana: VentanaPendientes;
  telefono: string;
}

export async function confirmarAvisosPendientes(
  db: Db,
  avisos: readonly ConfirmacionPendientes[],
  ahora = new Date(),
): Promise<number> {
  if (avisos.length === 0) return 0;
  const ventanas = [...new Set(avisos.map((aviso) => aviso.ventana))];
  const elegibles = (await Promise.all(ventanas.map((ventana) =>
    avisosPendientesDeClosers(db, { ventana, origen: "", ahora }),
  ))).flatMap((respuesta) => respuesta.avisos);
  const permitidos = new Set(elegibles.map((aviso) => `${aviso.userId}:${aviso.ventana}:${aviso.telefono}`));
  const unicos = [...new Map(avisos
    .filter((aviso) => permitidos.has(`${aviso.userId}:${aviso.ventana}:${aviso.telefono}`))
    .map((aviso) => [`${aviso.userId}:${aviso.ventana}`, aviso])).values()];
  if (unicos.length === 0) return 0;
  const dia = hoyEnBogota();
  const insertados = await db.insert(avisosPendientesCloserEnvios)
    .values(unicos.map((aviso) => ({ ...aviso, dia, enviadoEn: ahora })))
    .onConflictDoNothing({
      target: [avisosPendientesCloserEnvios.userId, avisosPendientesCloserEnvios.dia, avisosPendientesCloserEnvios.ventana],
    })
    .returning();
  return insertados.length;
}
