export interface RazonConCobertura {
  valor: number | null;
  base: number;
  faltan: number;
  motivo: string | null;
}

export type EstadoDeCobertura = "completa" | "parcial" | "no_calculable";

// ponytail: valor por defecto del 351, confirmado por Mani el 30-oct; el umbral por programa (contrato C-1) llega con
// el 353 como columna del programa.
export const UMBRAL_COBERTURA_POR_DEFECTO = 0.8;

export function estadoDeCobertura(
  r: RazonConCobertura,
  umbral = UMBRAL_COBERTURA_POR_DEFECTO,
): EstadoDeCobertura {
  if (r.valor === null) return "no_calculable";
  if (r.faltan === 0) return "completa";
  return r.base / (r.base + r.faltan) < umbral ? "parcial" : "completa";
}

export function razonVacia(motivo: string): RazonConCobertura {
  return { valor: null, base: 0, faltan: 0, motivo };
}

export function textoDeRazon(
  r: RazonConCobertura,
  formato: (valor: number) => string,
): string {
  const estado = estadoDeCobertura(r);
  if (estado === "no_calculable") return "—";
  if (estado === "parcial") return `${formato(r.valor!)} (parcial, ${r.base} de ${r.base + r.faltan})`;
  return formato(r.valor!);
}

export function razon(
  numerador: number,
  denominador: number,
  cobertura: { base: number; faltan: number; motivo: string | null; calculable: boolean },
): RazonConCobertura {
  return {
    valor: !cobertura.calculable || denominador === 0 ? null : numerador / denominador,
    base: cobertura.base,
    faltan: cobertura.faltan,
    motivo: cobertura.motivo,
  };
}
