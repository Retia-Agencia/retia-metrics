/**
 * Las monedas que el CRM acepta en un precio o un enlace de pago. Nunca se convierten en
 * silencio (AGENTS.md): la moneda viaja al lado del numero.
 *
 * Vive sola, sin importar nada, por dos razones:
 * - **Una pregunta, un módulo.** La validación de enlaces y sus componentes cliente
 *   comparten esta lista y no pueden divergir.
 * - **Los componentes de cliente la importan.** Si viviera en un modulo que toca la base,
 *   el driver (`postgres`, que necesita sockets de Node) terminaria en el bundle del
 *   navegador. Asi rompio el build al mudarse a Supabase (ADR 0047).
 *
 * **Solo USD desde el 30-sep (ticket 114 C6).** Los abonos ya se registran solo en USD
 * (081, Mani 28-sep: *"solo usamos USD aquí"*), así que un enlace en COP era
 * una trampa: se creaba y después no se podía cobrar. La pauta en COP NO pasa por aquí: su
 * gasto lleva la moneda en cada fila (ticket 120) y `monto` de `lib/format.ts` la sigue
 * sabiendo escribir. Filas viejas en COP siguen legibles: la columna es texto.
 */
export const MONEDAS = ["USD"] as const;

export type Moneda = (typeof MONEDAS)[number];
