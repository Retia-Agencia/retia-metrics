"use client";

import type { ReactNode } from "react";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TonoEtapa } from "./etapa-tono";

/**
 * El boton de una etapa destino (ticket 162): una pildora rellena con el tono de la etapa
 * (`badgeVariants`, Tinta §9: ningun color a mano). `anchoCh` es el largo de la etiqueta
 * mas larga de la fila, asi todos los botones miden lo mismo.
 */

export function BotonDeEtapa({
  tono,
  anchoCh,
  onClick,
  children,
}: {
  tono: TonoEtapa;
  anchoCh: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        badgeVariants({ variant: tono }),
        "h-8 rounded-full px-4 text-sm max-w-full justify-center hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none cursor-pointer",
      )}
      style={{ width: `calc(${anchoCh}ch + 2rem)` }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
