import { describe, expect, it } from "vitest";
import { siguienteCodigoDeCohorte } from "@/lib/catalogo/codigo-de-cohorte";

describe("siguienteCodigoDeCohorte", () => {
  it("continua despues del mayor codigo consecutivo", () => {
    expect(siguienteCodigoDeCohorte(["C1", "C2", "C3"])).toBe("C4");
  });

  it("empieza en C1 cuando no hay codigos", () => {
    expect(siguienteCodigoDeCohorte([])).toBe("C1");
  });

  it("admite codigos de mas de un digito", () => {
    expect(siguienteCodigoDeCohorte(["C9", "C10"])).toBe("C11");
  });

  it("ignora codigos que no siguen el formato", () => {
    expect(siguienteCodigoDeCohorte(["2026-A", "C3b"])).toBe("C1");
  });
});
