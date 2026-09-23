/**
 * Las monedas que el CRM acepta en un precio o un enlace de pago. Nunca se convierten en
 * silencio (AGENTS.md): la moneda viaja al lado del numero.
 *
 * Vive sola, sin importar nada, por dos razones:
 * - **Una pregunta, un modulo.** Estaba escrita dos veces, en `lib/catalogo/productos.ts` y
 *   en `lib/catalogo/enlaces-pago.ts`, y una moneda nueva en uno solo habria dejado un
 *   producto que no se puede cobrar con un enlace.
 * - **Los componentes de cliente la importan.** Si viviera en un modulo que toca la base,
 *   el driver (`postgres`, que necesita sockets de Node) terminaria en el bundle del
 *   navegador. Asi rompio el build al mudarse a Supabase (ADR 0047).
 */
export const MONEDAS = ["USD", "COP"] as const;

export type Moneda = (typeof MONEDAS)[number];
