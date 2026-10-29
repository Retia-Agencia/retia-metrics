import type { Escalon } from "@/lib/queries/escalera";
import type { FilaDeEscalera } from "@/lib/queries/vista-escalera";

/**
 * Intensidad de calor de cada celda de una fila de la escalera, de 0 a 1: el porcentaje de la celda sobre los
 * deals de SU fila (ya viene normalizado por fila, así que un closer se compara con otro). Es continua: no hay
 * cortes ni mínimos escritos aquí. Nula donde no hay nada que comparar: la fila de deals sin dueño (un cubo, no
 * una persona) y la base cero.
 */
export function intensidadesDeFila(fila: FilaDeEscalera): Record<Escalon, number | null> {
  return Object.fromEntries(
    (Object.keys(fila.celdas) as Escalon[]).map((escalon) => {
      const porcentaje = fila.celdas[escalon].porcentaje.valor;
      return [escalon, fila.esSinDueno || porcentaje === null ? null : Math.min(Math.max(porcentaje / 100, 0), 1)];
    }),
  ) as Record<Escalon, number | null>;
}
