export interface RazonConCobertura {
  valor: number | null;
  base: number;
  faltan: number;
  motivo: string | null;
  /**
   * Madurez (355, AJUSTE 3-nov): citas por venir de deals abiertos que aún pueden mover la razón. Con alguna, la razón
   * es parcial aunque la base cubra todo. Ausente o 0 = sin aviso; las razones que no maduran no lo traen.
   */
  agendasPendientes?: number;
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
  if ((r.agendasPendientes ?? 0) > 0) return "parcial";
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
  if (estado === "parcial") {
    if (r.faltan === 0 || r.base / (r.base + r.faltan) >= UMBRAL_COBERTURA_POR_DEFECTO) {
      return `${formato(r.valor!)} (parcial: ${r.agendasPendientes} ${r.agendasPendientes === 1 ? "agenda pendiente" : "agendas pendientes"})`;
    }
    return `${formato(r.valor!)} (parcial, ${r.base} de ${r.base + r.faltan})`;
  }
  return formato(r.valor!);
}

/** Solo el número de una razón (o "—"): la cobertura se dice aparte, nunca dentro de la cifra grande (A-176). */
export function valorDeRazon(
  r: RazonConCobertura,
  formato: (valor: number) => string,
): string {
  return r.valor === null ? "—" : formato(r.valor);
}

export function razon(
  numerador: number,
  denominador: number,
  cobertura: { base: number; faltan: number; motivo: string | null; calculable: boolean; agendasPendientes?: number },
): RazonConCobertura {
  return {
    valor: !cobertura.calculable || denominador === 0 ? null : numerador / denominador,
    base: cobertura.base,
    faltan: cobertura.faltan,
    motivo: cobertura.motivo,
    ...(cobertura.agendasPendientes ? { agendasPendientes: cobertura.agendasPendientes } : {}),
  };
}
