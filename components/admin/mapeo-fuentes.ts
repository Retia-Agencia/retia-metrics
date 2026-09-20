export type MapeoColumnas = Record<string, string | string[]>;

export interface ParMapeo {
  campo: string;
  patron: string;
}

/** Un mapeo guardado (objeto) a pares editables. */
export function aPares(mapeo: MapeoColumnas): ParMapeo[] {
  return Object.entries(mapeo).map(([campo, patron]) => ({
    campo,
    patron: Array.isArray(patron) ? patron.join(" | ") : String(patron),
  }));
}

/** Los pares editables a un mapeo. Un patron con "|" se parte en lista. */
export function aMapeo(pares: ParMapeo[]): MapeoColumnas {
  const mapeo: MapeoColumnas = {};
  for (const { campo, patron } of pares) {
    const c = campo.trim();
    if (!c) continue;
    const partes = patron
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    if (partes.length === 0) continue;
    mapeo[c] = partes.length === 1 ? partes[0] : partes;
  }
  return mapeo;
}
