import { num, pct } from "@/lib/format";

export interface VariacionDeNumero {
  actual: number;
  anterior: number;
  delta: number;
  deltaPct: number | null;
}

/**
 * Calcula juntos el cambio absoluto y el relativo para que la pantalla no obligue
 * a hacer la cuenta mentalmente (ADR 0067). Una base cero no admite porcentaje:
 * null conserva esa ausencia sin inventar un 0% ni producir infinito.
 */
export function variacion(actual: number, anterior: number): VariacionDeNumero {
  const delta = actual - anterior;
  return {
    actual,
    anterior,
    delta,
    deltaPct: anterior === 0 ? null : delta / Math.abs(anterior),
  };
}

function conSigno(valor: number, formato: (n: number) => string) {
  return `${valor < 0 ? "−" : valor > 0 ? "+" : ""}${formato(Math.abs(valor))}`;
}

/**
 * Escribe la variación completa con el formato único del CRM. Mantiene la base
 * visible y distingue el porcentaje ausente con una raya, para que cada pantalla
 * no elija una representación distinta del mismo cambio.
 */
export function textoDeVariacion(v: VariacionDeNumero, decimales = 0): string {
  const cambio = conSigno(v.delta, (n) => num(n, decimales));
  const porcentaje = v.deltaPct === null
    ? "—"
    : conSigno(v.deltaPct, (n) => pct(n, 0));

  return `${num(v.anterior, decimales)} → ${num(v.actual, decimales)} · ${cambio} · ${porcentaje}`;
}

/**
 * Incluye el denominador porque un porcentaje solo no dice cuántas personas o
 * registros representa. Recibe cantidad y base, no un porcentaje ya calculado,
 * para conservar una sola regla sobre la división por cero y su formato.
 */
export function porcentajeConBase(cantidad: number, base: number): string {
  return base === 0 ? "—" : `${pct(cantidad / base, 0)} de ${num(base)}`;
}
