"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { TonoEtapa } from "./etapa-tono";

/**
 * El boton de una etapa destino (ticket 162): una pildora rellena con el tono de la etapa
 * con el tamaño estándar de Tinta. El peligro conserva su tono semántico.
 */

export function BotonDeEtapa({
  tono,
  onClick,
  children,
}: {
  tono: TonoEtapa;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      className="w-full"
      variant={tono === "peligro" ? "destructive" : "secondary"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
