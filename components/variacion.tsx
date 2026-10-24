import { textoDeVariacion, tituloDeVariacion, variacion } from "@/lib/variacion";
import { descripcionDeComparacion, type PeriodoResuelto } from "@/lib/periodo";

interface VariacionProps {
  actual: number;
  anterior: number;
  decimales?: number;
  comparacion?: string;
  periodo?: PeriodoResuelto;
}

/**
 * Muestra base, resultado y ambos cambios con dígitos comparables (Tinta).
 * Delega cuenta y texto al contrato único para no duplicar el formato en cada KPI.
 * El signo no decide un tono: subir el costo no significa lo mismo que subir ventas.
 */
export function Variacion({ actual, anterior, decimales = 0, comparacion, periodo }: VariacionProps) {
  const cambio = variacion(actual, anterior);
  const contexto = comparacion ?? (periodo ? descripcionDeComparacion(periodo) : "contra el periodo anterior");
  return (
    <span className="cifra" title={tituloDeVariacion(contexto, cambio, decimales)}>
      {textoDeVariacion(cambio, decimales)}
    </span>
  );
}
