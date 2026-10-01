import { expect, it } from "vitest";
import { porcentajeConBase, textoDeVariacion, variacion } from "@/lib/variacion";

it("cambio absoluto y relativo con menos tipográfico", () => {
  expect(variacion(4, 358)).toEqual({ actual: 4, anterior: 358, delta: -354, deltaPct: -354 / 358 });
  expect(textoDeVariacion(variacion(4, 358))).toBe("358 → 4 · −354 · −99%");
  expect(textoDeVariacion(variacion(1500, 1000))).toBe("1.000 → 1.500 · +500 · +50%");
});
it("base cero nunca inventa 0% ni infinito", () => {
  expect(variacion(4, 0).deltaPct).toBeNull();
  expect(textoDeVariacion(variacion(4, 0))).toBe("0 → 4 · +4 · —");
  expect(textoDeVariacion(variacion(0, 0))).toBe("0 → 0 · 0 · —");
  expect(porcentajeConBase(0, 0)).toBe("—");
});
it("porcentaje con su denominador y formato colombiano", () => {
  expect(porcentajeConBase(6, 12)).toBe("50% de 12");
  expect(porcentajeConBase(0, 12)).toBe("0% de 12");
  expect(textoDeVariacion(variacion(1.5, 1), 2)).toBe("1,00 → 1,50 · +0,50 · +50%");
});
