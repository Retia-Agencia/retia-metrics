import { NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { fecha, fechaHoraEnBogota, monto } from "@/lib/format";

/**
 * Lo que el motor dejó escrito, en los términos del negocio: la etapa en la que quedó
 * el deal, el pendiente que se puso o se quitó con su fecha, la llamada que se creó y
 * el abono que se registró. Se arma en el servidor desde `MovimientoHecho` (lo que el
 * motor hizo), nunca desde lo que se pidió, y de ahí sale el texto del aviso (ticket 220).
 */
export interface CambioHecho {
  etapaAntes: EtapaDeal;
  etapaDespues: EtapaDeal;
  pendienteAntes: PendienteDeal | null;
  pendienteDespues: PendienteDeal | null;
  /** Día de calendario en Bogotá, `YYYY-MM-DD`, del pendiente puesto. */
  fechaPendiente?: string | null;
  llamadaCreada?: { fecha: Date } | null;
  abonoRegistrado?: { monto: number; moneda: string } | null;
}

/**
 * El cambio en palabras del negocio: una línea por cosa que pasó, en orden fijo
 * (etapa, pendiente, llamada, abono). Pura: no toca la base ni el reloj. Si nada
 * visible cambió —solo un comentario— devuelve "Anotación guardada." para que el
 * aviso igual confirme que se guardó.
 */
export function resumenDelCambio(c: CambioHecho): string[] {
  const lineas: string[] = [];

  if (c.etapaDespues !== c.etapaAntes) {
    lineas.push(`El deal pasó a ${NOMBRE_DE_ETAPA[c.etapaDespues]}.`);
  }

  if (c.pendienteDespues !== null && c.pendienteDespues !== c.pendienteAntes) {
    const nombre = NOMBRE_DE_PENDIENTE[c.pendienteDespues];
    lineas.push(
      c.fechaPendiente
        ? `Quedó en ${nombre} hasta el ${fecha(c.fechaPendiente)}.`
        : `Quedó en ${nombre}.`,
    );
  } else if (
    c.pendienteAntes !== null &&
    c.pendienteDespues === null &&
    c.etapaDespues === c.etapaAntes
  ) {
    lineas.push(`Ya no está en ${NOMBRE_DE_PENDIENTE[c.pendienteAntes]}.`);
  }

  if (c.llamadaCreada) {
    lineas.push(`Se creó la llamada del ${fechaHoraEnBogota(c.llamadaCreada.fecha)}.`);
  }

  if (c.abonoRegistrado) {
    lineas.push(
      `Se registró un abono de ${monto(c.abonoRegistrado.monto, c.abonoRegistrado.moneda)}.`,
    );
  }

  return lineas.length > 0 ? lineas : ["Anotación guardada."];
}
