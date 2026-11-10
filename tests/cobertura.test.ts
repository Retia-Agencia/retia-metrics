import { describe, expect, it } from "vitest";
import { diaCubierto, motivoDeGasto } from "@/lib/pauta/cobertura-de-gasto";
import { estadoDeCobertura, MOTIVO_SIN_GASTO_DE_AGENDA, razon, razonDeCosto, razonVacia, textoDeRazon, valorDeRazon } from "@/lib/cobertura";

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

  it("valorDeRazon deja solo el número: la cobertura no va dentro de la cifra grande (A-176)", () => {
    const formato = (n: number) => `${Math.round(n * 100)} %`;
    expect(valorDeRazon({ valor: 0.289, base: 38, faltan: 400, motivo: "Faltan resultados" }, formato)).toBe("29 %");
    expect(valorDeRazon({ valor: null, base: 0, faltan: 0, motivo: "Sin citas" }, formato)).toBe("—");
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

describe("razonDeCosto: sin gasto no hay costo (412 F)", () => {
  const completa = { base: 7, faltan: 0, motivo: null, calculable: true };
  it("gasto 0 con cantidad es '—' con motivo, no 0", () => {
    const r = razonDeCosto(0, 28, completa);
    expect(r.valor).toBeNull();
    expect(r.motivo).toBe(MOTIVO_SIN_GASTO_DE_AGENDA);
  });
  it("con gasto se comporta como razon; si la cobertura no permite calcular conserva su motivo", () => {
    expect(razonDeCosto(100, 4, completa).valor).toBe(25);
    const parcial = razonDeCosto(0, 4, { base: 3, faltan: 4, motivo: "Gasto de Meta desde el 15 sep", calculable: false });
    expect(parcial.valor).toBeNull();
    expect(parcial.motivo).toBe("Gasto de Meta desde el 15 sep");
  });
});

describe("diaCubierto: un hueco en medio no es un cero (412 F)", () => {
  const cobertura = { primerDia: "2026-11-02", ultimoDia: "2026-11-06", diasSinFila: ["2026-11-04"] };
  it("el día sin fila entre el primero y el último no está cubierto", () => {
    expect(diaCubierto("2026-11-03", cobertura)).toBe(true);
    expect(diaCubierto("2026-11-04", cobertura)).toBe(false);
    expect(diaCubierto("2026-11-01", cobertura)).toBe(false);
    expect(diaCubierto("2026-11-07", cobertura)).toBe(false);
  });
  it("el motivo nombra el hueco en vez de decir 'desde el primer día'", () => {
    expect(motivoDeGasto(cobertura)).toMatch(/Sin gasto de Meta cargado el/);
  });
});
