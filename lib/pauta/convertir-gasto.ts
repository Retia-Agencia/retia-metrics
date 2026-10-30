import { ErrorDeApp } from "@/lib/errors";

export type MonedaGasto = "COP" | "USD";

export function convertirMonto(
  monto: number,
  moneda: string,
  dia: string,
  pesosPorDolar: ReadonlyMap<string, number>,
  destino: MonedaGasto,
): number | null {
  if (moneda !== "COP" && moneda !== "USD") {
    throw new ErrorDeApp(`La moneda ${moneda} no es soportada.`, 422);
  }
  if (moneda === destino) return monto;
  const tasa = pesosPorDolar.get(dia);
  if (tasa === undefined) return null;
  return moneda === "COP" ? monto / tasa : monto * tasa;
}

export function convertirGasto(
  filas: ReadonlyArray<{ dia: string; monto: number | string; moneda: string }>,
  pesosPorDolar: ReadonlyMap<string, number>,
  destino: MonedaGasto,
): { total: number; montos: (number | null)[]; diasSinTrm: string[]; filasSinTrm: number } {
  const montos = filas.map((fila) => convertirMonto(Number(fila.monto), fila.moneda, fila.dia, pesosPorDolar, destino));
  return {
    total: montos.reduce<number>((total, monto) => total + (monto ?? 0), 0),
    montos,
    diasSinTrm: [...new Set(filas.flatMap((fila, i) => montos[i] === null ? [fila.dia] : []))].sort(),
    filasSinTrm: montos.filter((monto) => monto === null).length,
  };
}
