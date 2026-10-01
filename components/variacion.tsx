import { textoDeVariacion, variacion } from "@/lib/variacion";

interface VariacionProps {
  actual: number;
  anterior: number;
  decimales?: number;
}

/**
 * Muestra base, resultado y ambos cambios con dígitos comparables (Tinta).
 * Delega cuenta y texto al contrato único para no duplicar el formato en cada KPI.
 * El signo no decide un tono: subir el costo no significa lo mismo que subir ventas.
 */
export function Variacion({ actual, anterior, decimales = 0 }: VariacionProps) {
  return <span className="cifra">{textoDeVariacion(variacion(actual, anterior), decimales)}</span>;
}
