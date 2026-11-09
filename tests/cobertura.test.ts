import { describe, expect, it } from "vitest";
import { estadoDeCobertura, razon, razonVacia, textoDeRazon } from "@/lib/cobertura";

describe("cobertura de razones", () => {
  it("distingue completa, parcial y no calculable", () => {
    expect(estadoDeCobertura({ valor: 2, base: 10, faltan: 0, motivo: null })).toBe("completa");
    expect(estadoDeCobertura({ valor: 2, base: 3, faltan: 7, motivo: "Faltan datos" })).toBe("parcial");
    expect(estadoDeCobertura({ valor: null, base: 3, faltan: 7, motivo: "Faltan datos" })).toBe("no_calculable");
  });

  it("no calcula sin denominador o cuando la cobertura no permite calcular", () => {
    expect(razon(10, 0, { base: 1, faltan: 0, motivo: null, calculable: true }).valor).toBeNull();
    expect(razon(10, 2, { base: 1, faltan: 1, motivo: "Falta un día", calculable: false }).valor).toBeNull();
  });

  it("convierte una razón a texto sin esconder su cobertura", () => {
    const formato = (n: number) => `${Math.round(n * 100)} %`;
    expect(textoDeRazon({ valor: null, base: 0, faltan: 0, motivo: "Sin citas" }, formato)).toBe("—");
    expect(textoDeRazon({ valor: 0.41, base: 3, faltan: 7, motivo: "Faltan resultados" }, formato))
      .toBe("41 % (parcial, 3 de 10)");
    expect(textoDeRazon({ valor: 0.41, base: 10, faltan: 0, motivo: null }, formato)).toBe("41 %");
  });

  it("construye una razón vacía con su motivo", () => {
    expect(razonVacia("Sin citas en el periodo")).toEqual({
      valor: null,
      base: 0,
      faltan: 0,
      motivo: "Sin citas en el periodo",
    });
  });
});
