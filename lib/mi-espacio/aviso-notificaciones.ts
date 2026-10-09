/**
 * El aviso de "cambió algo sin ver" (ticket 223), en un módulo SIN dependencias de servidor
 * para que lo importe el badge del cliente y, más adelante, los diálogos de Anotar y Mover.
 *
 * El layout no se re-renderiza en una navegación del cliente, así que el circulito pide su
 * número aparte. Cuando una acción del cliente baja el número (anotar un seguimiento vencido,
 * mover un deal), dispara este evento y el badge se vuelve a pedir sin recargar la página.
 */
export const EVENTO_NOTIFICACIONES = "retia:notificaciones";

/** Dispara el evento que hace al circulito volver a pedir su número. No-op en el servidor. */
export function avisarCambioDeNotificaciones(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTO_NOTIFICACIONES));
}
