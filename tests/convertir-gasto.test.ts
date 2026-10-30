import { describe, expect, it } from "vitest";
import { convertirGasto, convertirMonto } from "@/lib/pauta/convertir-gasto";
import { ErrorDeApp } from "@/lib/errors";

const tasas = new Map([["2026-10-01", 4000]]);

describe("convertir gasto", () => {
  it("convierte COP y USD en ambos sentidos", () => {
    expect(convertirMonto(8000, "COP", "2026-10-01", tasas, "USD")).toBe(2);
    expect(convertirMonto(2, "USD", "2026-10-01", tasas, "COP")).toBe(8000);
    expect(convertirMonto(2, "USD", "2026-10-01", tasas, "USD")).toBe(2);
  });

  it("expone la TRM que falta", () => {
    const resultado = convertirGasto([
      { dia: "2026-10-02", monto: 8000, moneda: "COP" },
      { dia: "2026-10-02", monto: 2, moneda: "USD" },
    ], tasas, "USD");
    expect(resultado).toEqual({ total: 2, montos: [null, 2], diasSinTrm: ["2026-10-02"], filasSinTrm: 1 });
  });

  it("rechaza una moneda no soportada", () => {
    expect(() => convertirMonto(1, "EUR", "2026-10-01", tasas, "USD")).toThrow(ErrorDeApp);
  });
});
