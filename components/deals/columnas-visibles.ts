import type { ColumnaKanban } from "@/lib/queries/kanban";

function redondearUsd(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Recalcula los totales de cada columna sobre las tarjetas visibles por la búsqueda. */
export function columnasVisibles(
  columnas: readonly ColumnaKanban[],
  idsVisibles: ReadonlySet<string> | null,
): ColumnaKanban[] {
  if (idsVisibles === null) return columnas.map((columna) => ({ ...columna, tarjetas: [...columna.tarjetas] }));

  return columnas.map((columna) => {
    const tarjetas = columna.tarjetas.filter((tarjeta) => idsVisibles.has(tarjeta.dealId));
    return {
      ...columna,
      tarjetas,
      potencialUsd: redondearUsd(tarjetas.reduce((total, tarjeta) => total + tarjeta.potencialUsd, 0)),
      confirmadoUsd:
        columna.confirmadoUsd === null
          ? null
          : redondearUsd(tarjetas.reduce((total, tarjeta) => total + tarjeta.confirmadoUsd, 0)),
    };
  });
}
