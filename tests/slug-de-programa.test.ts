import { describe, expect, it } from "vitest";
import { slugDesdeNombre } from "@/lib/programas/slug";

describe("slug de programa", () => {
  it.each([
    ["Comunícate con Confianza", "comunicate-con-confianza"],
    ["Niño & Ñandú 2026", "nino-nandu-2026"],
    ["*** Programa nuevo !!!", "programa-nuevo"],
    ["Programa   con---separadores", "programa-con-separadores"],
  ])("convierte %s", (nombre, esperado) => {
    expect(slugDesdeNombre(nombre)).toBe(esperado);
  });

  it("limita a 60 caracteres sin dejar un guion al final", () => {
    const nombreDe80Caracteres = `${"a".repeat(59)}-${"b".repeat(20)}`;
    const slug = slugDesdeNombre(nombreDe80Caracteres);
    expect(nombreDe80Caracteres).toHaveLength(80);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });

  it("produce solo caracteres validos cuando el resultado no esta vacio", () => {
    for (const nombre of ["Árbol 2026", "N_1 + dos", "---", "Programa. Uno"]) {
      const slug = slugDesdeNombre(nombre);
      if (slug) expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
