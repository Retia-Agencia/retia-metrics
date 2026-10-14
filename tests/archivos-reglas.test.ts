import { describe, expect, it } from "vitest";
import { tipoPorBytesMagicos } from "@/lib/archivos/reglas";

describe("tipoPorBytesMagicos", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0x00]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]],
  ] as const)("reconoce %s", (tipo, bytes) => {
    expect(tipoPorBytesMagicos(Uint8Array.from(bytes))).toBe(tipo);
  });

  it.each(["<svg></svg>", "<html></html>", ""])("rechaza contenido no permitido: %s", (texto) => {
    expect(tipoPorBytesMagicos(new TextEncoder().encode(texto))).toBeNull();
  });
});
