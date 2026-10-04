"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Disclosedor accesible de la ficha del lead (ticket 184). El boton ocupa todo el
 * encabezado de la tarjeta: Enter y Espacio son nativos, y `aria-expanded` refleja
 * el estado real. El contenido llega como slot de servidor y no entra al bundle.
 */
export function EnvioDesplegable({ cabecera, children }: { cabecera: ReactNode; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <div className="overflow-hidden rounded-lg border border-transparent bg-card transition-colors duration-150 hover:border-border hover:bg-muted/50">
        <button
          type="button"
          aria-expanded={abierto}
          onClick={() => setAbierto((actual) => !actual)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="min-w-0 flex-1">{cabecera}</span>
          <ChevronDown
            aria-hidden
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-150", abierto && "rotate-180")}
          />
        </button>
        <div hidden={!abierto} className="space-y-3 border-t border-border px-3 pb-3 pt-3">
          {children}
        </div>
      </div>
    </li>
  );
}
