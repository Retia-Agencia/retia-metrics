export interface Conteo {
  readonly tipo: "conteo";
  readonly valor: number;
}

export interface Dinero<Moneda extends string = string> {
  readonly tipo: "dinero";
  readonly moneda: Moneda;
  readonly valor: number;
}

export interface Tasa {
  readonly tipo: "tasa";
  readonly valor: number | null;
}

export type Sumable = Conteo | Dinero;

export const conteo = (valor: number): Conteo => ({ tipo: "conteo", valor });
export const dinero = <Moneda extends string>(moneda: Moneda, valor: number): Dinero<Moneda> => ({ tipo: "dinero", moneda, valor });
export const tasa = (valor: number | null): Tasa => ({ tipo: "tasa", valor });

/**
 * Suma entre programas solo magnitudes sumables (ADR 0048 punto 2). El molde del
 * ADR 0023 vive en el tipo: ninguna de las dos funciones acepta una `Tasa`, asi que
 * sumar un porcentaje entre programas no compila. Son dos funciones y no una con
 * sobrecargas porque un arreglo vacio no dice si era de conteos o de dinero.
 */
export function sumarConteos(xs: readonly Conteo[]): Conteo {
  return conteo(xs.reduce((total, item) => total + item.valor, 0));
}

/** Contratado y cartera ya vienen en USD: ni una tasa ni otra moneda caben aquí. */
export function sumarUsd(xs: readonly Dinero<"USD">[]): Dinero<"USD"> {
  const total = sumarDinero(xs.map((x) => [x]));
  return dinero("USD", total[0]?.valor ?? 0);
}

/** El dinero se agrupa por moneda y nunca se convierte (AGENTS.md). */
export function sumarDinero(xs: readonly (readonly Dinero[])[]): Dinero[] {
  const porMoneda = new Map<string, number>();
  for (const grupo of xs) {
    for (const item of grupo) {
      porMoneda.set(item.moneda, (porMoneda.get(item.moneda) ?? 0) + item.valor);
    }
  }
  return [...porMoneda]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moneda, valor]) => dinero(moneda, Math.round((valor + Number.EPSILON) * 100) / 100));
}
