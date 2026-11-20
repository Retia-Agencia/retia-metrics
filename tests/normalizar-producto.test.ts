import { describe, expect, it } from "vitest";
import { normalizarProducto } from "@/lib/catalogo/normalizar-producto";

describe("normalizarProducto", () => {
  it.each([
    ["Uno a uno", "uno_a_uno"],
    ["uno  a-uno", "uno_a_uno"],
    ["Ñandú 1:1", "nandu_1_1"],
  ])("normaliza %s", (nombre, esperado) => {
    expect(normalizarProducto(nombre)).toBe(esperado);
  });
});
