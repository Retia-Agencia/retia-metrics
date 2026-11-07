/** Parte sobre total, o `null` si no se puede calcular (total 0). Pura: la importan también componentes de cliente. */
export function proporcionDeOrigen(parte: number, total: number): number | null {
  return total === 0 ? null : parte / total;
}
