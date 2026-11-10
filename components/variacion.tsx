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

/**
 * El cambio de una Cifra (ticket 419, DM-2): siempre en gris, porque subir no siempre es bueno y el color solo lo pone
 * el estado. La cuenta y el texto los escribió `armarCifra` (cantidad y %, o puntos en una tasa, en el mismo formato
 * que el valor). En la tarjeta va con su referencia; en una celda, solo el cambio en 11 px.
 */
export function CambioDeCifra({ comparacion, enCelda = false }: {
  comparacion: { texto: string; cifra: string; cambio: string };
  enCelda?: boolean;
}) {
  if (enCelda) return <span className="cifra text-[11px] text-muted-foreground">{comparacion.cambio}</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {comparacion.texto}: <b className="cifra font-medium text-foreground">{comparacion.cifra}</b> · {comparacion.cambio}
    </span>
  );
}
