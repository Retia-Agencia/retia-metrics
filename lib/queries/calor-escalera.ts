import type { Escalon } from "@/lib/queries/escalera";
import type { FilaDeEscalera } from "@/lib/queries/vista-escalera";

// ponytail: constante de presentación (tamaño de muestra); si gerencia la quiere editable, moverla a una columna de Programa.
export const MINIMO_DE_DEALS_PARA_CALOR = 10;

export type TonoDeCalor = 0 | 1 | 2 | 3;

export function tonoDePorcentaje(porcentaje: number): TonoDeCalor {
  if (porcentaje < 5) return 0;
  if (porcentaje < 20) return 1;
  if (porcentaje < 50) return 2;
  return 3;
}

export function tonosDeFila(fila: FilaDeEscalera): Record<Escalon, TonoDeCalor | null> {
  return Object.fromEntries(
    (Object.keys(fila.celdas) as Escalon[]).map((escalon) => {
      const porcentaje = fila.celdas[escalon].porcentaje.valor;
      const tono = fila.esSinDueno || fila.total < MINIMO_DE_DEALS_PARA_CALOR || porcentaje === null
        ? null
        : tonoDePorcentaje(porcentaje);
      return [escalon, tono];
    }),
  ) as Record<Escalon, TonoDeCalor | null>;
}
