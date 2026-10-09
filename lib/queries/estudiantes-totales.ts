import { redondearUsd } from "@/lib/dinero";
import type { SaldoDeDeal } from "@/lib/queries/saldo";

interface FilaConSaldo {
  saldo: SaldoDeDeal | null;
}

export interface TotalDeStudentsPorMoneda {
  moneda: string;
  recaudado: number;
  porCobrar: number;
}

export interface TotalesDeStudents {
  porMoneda: TotalDeStudentsPorMoneda[];
  sinValorVendido: number;
}

/** Totales de las mismas filas ya filtradas que muestra Students; no consulta ni recalcula saldos. */
export function totalesDeStudents(filas: readonly FilaConSaldo[]): TotalesDeStudents {
  const porMoneda = new Map<string, { recaudado: number; porCobrar: number }>();
  let sinValorVendido = 0;

  for (const fila of filas) {
    const moneda = fila.saldo?.moneda ?? "USD";
    const actual = porMoneda.get(moneda) ?? { recaudado: 0, porCobrar: 0 };
    actual.recaudado += fila.saldo?.abonado ?? 0;
    if (fila.saldo?.saldo != null && fila.saldo.saldo > 0) actual.porCobrar += fila.saldo.saldo;
    porMoneda.set(moneda, actual);
    if (fila.saldo?.sinSaldoPorque === "sin_valor_vendido") sinValorVendido += 1;
  }

  return {
    porMoneda: [...porMoneda.entries()]
      .sort(([monedaA], [monedaB]) => monedaA.localeCompare(monedaB))
      .map(([moneda, total]) => ({
        moneda,
        recaudado: redondearUsd(total.recaudado),
        porCobrar: redondearUsd(total.porCobrar),
      })),
    sinValorVendido,
  };
}
