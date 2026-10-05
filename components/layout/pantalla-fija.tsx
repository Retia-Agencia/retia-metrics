import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PantallaFija({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>{children}</div>;
}

/**
 * Las clases de la zona que hace scroll dentro de una pantalla fija (ticket 198), para cuando la zona
 * no es un `div` (una lista, un `CardContent`). `relative` no es adorno: sin él, un hijo absoluto (los
 * `sr-only` de las gráficas) se sale del contenedor y estira la página entera, sin un error (197).
 */
export function clasesDeZonaConScroll(className?: string): string {
  return cn("md:relative md:min-h-0 md:flex-1 md:overflow-y-auto", className);
}

/** La zona con scroll de una pantalla fija: lo que crece se desplaza aquí y la página no se mueve. */
export function ZonaConScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clasesDeZonaConScroll(className)}>{children}</div>;
}
