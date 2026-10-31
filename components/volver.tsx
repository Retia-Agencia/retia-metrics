"use client";

import Link from "next/link";
import { accionDeVolver, destinoDeVolver } from "@/lib/navegacion/volver";

/**
 * El enlace "← {lista}" de la cabecera de una ficha (ticket 174, A-57). El origen viaja en
 * `desde` (ruta validada por `destinoDeVolver`); sin un `desde` valido, cae a `porDefecto`
 * (la lista natural del objeto). Un clic normal consume el historial cuando la entrada
 * anterior es de esta app; el `href` sigue disponible para abrir en otra pestaña o sin JS.
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

  function urlAnterior(): string | null {
    const navegacion = (window as Window & {
      navigation?: {
        currentEntry?: { index: number };
        entries(): { index: number; url: string }[];
      };
    }).navigation;
    const indice = navegacion?.currentEntry?.index;
    const anterior = indice === undefined
      ? undefined
      : navegacion?.entries().find((entrada) => entrada.index === indice - 1)?.url;
    if (anterior) return anterior;
    // Una pestaña nueva puede conservar `referrer`, pero no tiene una entrada que consumir.
    return window.history.length > 1 ? document.referrer || null : null;
  }

  return (
    <Link
      href={destino.href}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const accion = accionDeVolver(urlAnterior(), window.location.origin, destino.href);
        // Sin entrada previa de la app, el Link navega solo a su href (destino de respaldo).
        if (accion.tipo !== "atras") return;
        event.preventDefault();
        window.history.back();
      }}
      className="inline-block text-sm text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      ← {destino.etiqueta}
    </Link>
  );
}
