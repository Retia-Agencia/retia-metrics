import type { ReactNode } from "react";

/**
 * La regla del vacío (ADR 0115 N5): "—" no se puede calcular (el motivo va en el tooltip),
 * "0" es cero, "Sin datos" aún no hay periodo medido. Una sola pieza para que ninguna pantalla lo decida a mano.
 */
export function DatoOVacio({ valor, motivo, sinPeriodo = false, children }: {
  /** `null` = no se puede calcular. */
  valor: number | null;
  motivo?: string;
  /** Aún no hay periodo medido. */
  sinPeriodo?: boolean;
  /** Cómo se escribe el valor cuando existe (`num`, `usd`, `pct`...). */
  children: (valor: number) => ReactNode;
}) {
  if (sinPeriodo) return <span className="text-muted-foreground">Sin datos</span>;
  if (valor === null) return <span title={motivo} aria-label={motivo ? `No se puede calcular: ${motivo}` : "No se puede calcular"}>—</span>;
  return <>{children(valor)}</>;
}
