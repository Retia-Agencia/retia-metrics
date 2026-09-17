import type { Session } from "next-auth";
import { ErrorDeApp } from "@/lib/errors";

/**
 * El `closerId` de la sesion, o un 400 amable si la cuenta no lo tiene cargado.
 *
 * Toda escritura nativa copia este valor del closer logueado; el closer nunca lo
 * escribe ni lo elige (ADR 0011). Sin el, sus registros no se cruzan con su usuario:
 * es un error de onboarding con arreglo conocido, no un 500.
 *
 * Vive aca y no dentro de una mutacion porque lo necesitan todas las que escribe un
 * closer (registro de llamadas, abonos, y las que vengan).
 *
 * @param accion que estaba intentando hacer, para cerrar el mensaje ("registrar
 *   llamadas", "registrar abonos").
 */
export function closerDeLaSesion(session: Session, accion: string): string {
  const closerId = session.user.closerId;
  if (!closerId) {
    throw new ErrorDeApp(
      `Tu cuenta no tiene cargado el identificador de closer. Pídele a un gerente que te lo asigne antes de ${accion}.`,
      400,
    );
  }
  return closerId;
}
