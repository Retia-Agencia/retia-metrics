import { describe, expect, it } from "vitest";
import { costoPorVenta, MOTIVO_SIN_INVERSION, MOTIVO_SIN_VENTAS } from "@/lib/pauta/costo-por-venta";

describe("costo por venta de Pauta (415)", () => {
  it("divide la inversión entre las ventas de pauta", () => {
    expect(costoPorVenta({ inversionCop: 2_800_000, ventas: 4 })).toEqual({ valor: 700_000, base: 4, faltan: 0, motivo: null });
  });

  it("sin ventas no se puede calcular y lo dice", () => {
    expect(costoPorVenta({ inversionCop: 2_800_000, ventas: 0 })).toMatchObject({ valor: null, motivo: MOTIVO_SIN_VENTAS });
  });

  it("sin inversión calculable conserva el motivo de la Inversión; nunca COP 0", () => {
    expect(costoPorVenta({ inversionCop: null, motivoSinInversion: "Falta TRM para 2026-10-05", ventas: 2 }))
      .toMatchObject({ valor: null, motivo: "Falta TRM para 2026-10-05" });
    expect(costoPorVenta({ inversionCop: null, ventas: 2 })).toMatchObject({ valor: null, motivo: MOTIVO_SIN_INVERSION });
    expect(costoPorVenta({ inversionCop: 0, ventas: 2 })).toMatchObject({ valor: null, motivo: MOTIVO_SIN_INVERSION });
  });
});
