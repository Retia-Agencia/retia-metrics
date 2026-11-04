import { fecha, num } from "@/lib/format";
import type { CeldaDeMeta } from "@/lib/queries/vamos-a-llegar";

/** Traduce una celda de cupos a la frase que se puede leer de corrido. */
export function fraseDeAvance(celda: CeldaDeMeta, { cierre }: { cierre: string | null }): string {
  if (celda.meta === null) return "Sin meta.";
  const llevamos = Math.round(celda.llevamos);
  const meta = Math.round(celda.meta);
  if (celda.llevamos >= celda.meta) return `Ya llegaste: ${num(llevamos)} de ${num(meta)} cupos.`;
  const inicio = `Llevas ${num(llevamos)} de ${num(meta)} cupos.`;
  if (celda.esperado === null) return inicio;
  const diferencia = llevamos - Math.round(celda.esperado);
  const ritmo = celda.porDiaHabil === null ? "" : ` Necesitas ${num(celda.porDiaHabil, 1)} ventas por día hábil${cierre ? ` hasta el ${fecha(cierre)}` : ""}.`;
  if (diferencia < 0) return `${inicio} Vas ${num(Math.abs(diferencia))} atrás.${ritmo}`;
  if (diferencia > 0) return `${inicio} Vas ${num(diferencia)} adelante.`;
  return `${inicio} Vas al día.`;
}
