import Link from "next/link";
import { destinoDeVolver } from "@/lib/navegacion/volver";

/**
 * El enlace "← {lista}" de la cabecera de una ficha (ticket 174, A-57). El origen viaja en
 * `desde` (ruta validada por `destinoDeVolver`); sin un `desde` valido, cae a `porDefecto`
 * (la lista natural del objeto). Server component: no necesita estado ni el cliente.
 *
 * El estilo es el mismo que tenian los "← Volver a los deals/leads" de las dos fichas.
 */
export function Volver({
  desde,
  porDefecto,
}: {
  desde?: string;
  porDefecto: { href: string; etiqueta: string };
}) {
  const destino = destinoDeVolver(desde, porDefecto);
  return (
    <Link
      href={destino.href}
      className="inline-block text-sm text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      ← {destino.etiqueta}
    </Link>
  );
}
