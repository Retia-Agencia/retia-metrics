export interface CohorteConInicioDeVentas {
  id: string;
  fechaInicioVentas: string | null;
}

/**
 * Devuelve la cohorte inmediatamente anterior dentro de una lista ya acotada a un programa.
 * Una cohorte futura nunca puede ser "anterior" aunque aparezca antes en la lista.
 */
export function cohorteAnterior<T extends CohorteConInicioDeVentas>(
  cohortes: readonly T[],
  cohortId: string,
): T | null {
  const actual = cohortes.find((cohorte) => cohorte.id === cohortId);
  if (!actual?.fechaInicioVentas) return null;

  return cohortes.reduce<T | null>((anterior, cohorte) => {
    if (
      cohorte.id === cohortId ||
      !cohorte.fechaInicioVentas ||
      cohorte.fechaInicioVentas >= actual.fechaInicioVentas!
    ) {
      return anterior;
    }
    return !anterior || cohorte.fechaInicioVentas > anterior.fechaInicioVentas! ? cohorte : anterior;
  }, null);
}
