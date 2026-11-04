import { fecha } from "@/lib/format";

/**
 * El contexto que cada cifra de Comercial lleva en su subtítulo (ticket 372, G-8): cohorte, periodo
 * y closer, con la misma redacción en todas las tarjetas ("C3 · 1 oct 2026 a hoy · todos los closers").
 * Una función pura: la pantalla no arma la frase a mano en ningún otro sitio.
 */
export function contextoDeCifra({ cohorte, rango, hoy, closer }: {
  /** El código de la cohorte elegida (`C3`), o `null` con "Todas". */
  cohorte: string | null;
  rango: { desde: string; hasta: string };
  hoy: string;
  /** El nombre del closer filtrado, o `null` con todos. */
  closer: string | null;
}): string {
  const dia = (d: string) => (d === hoy ? "hoy" : fecha(d));
  const periodo = rango.desde === rango.hasta ? dia(rango.desde) : `${fecha(rango.desde)} a ${dia(rango.hasta)}`;
  return [cohorte ?? "Todas las cohortes", periodo, closer ?? "todos los closers"].join(" · ");
}
