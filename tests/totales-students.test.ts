import { describe, expect, it } from "vitest";
import { totalesDeStudents } from "@/lib/queries/estudiantes-totales";
import type { SaldoDeDeal } from "@/lib/queries/saldo";

function saldo(parcial: Partial<SaldoDeDeal> & Pick<SaldoDeDeal, "abonado" | "saldo">): SaldoDeDeal {
  return {
    precio: 1000,
    moneda: "USD",
    abonosVigentes: 1,
    sinSaldoPorque: null,
    ...parcial,
  };
}

describe("totalesDeStudents", () => {
  it("agrupa monedas, no resta sobrepagos y cuenta deals sin valor vendido", () => {
    const filas = [
      { saldo: saldo({ abonado: 100.126, saldo: 899.894 }) },
      { saldo: saldo({ abonado: 1100, saldo: -100 }) },
      { saldo: saldo({ moneda: "COP", abonado: 200_000, saldo: 300_000 }) },
      {
        saldo: saldo({
          precio: null,
          abonado: 50,
          saldo: null,
          sinSaldoPorque: "sin_valor_vendido",
        }),
      },
    ];

    expect(totalesDeStudents(filas)).toEqual({
      porMoneda: [
        { moneda: "COP", recaudado: 200_000, porCobrar: 300_000 },
        { moneda: "USD", recaudado: 1250.13, porCobrar: 899.89 },
      ],
      sinValorVendido: 1,
    });
  });
});
