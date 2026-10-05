import { describe, expect, it } from "vitest";
import { elegirPrograma, slugParaRecordar } from "@/lib/programa-preferido";

describe("slugParaRecordar", () => {
  it("recuerda una ruta de programa con tab", () => {
    expect(slugParaRecordar("/p/comunicarte/deals", new URLSearchParams())).toBe("comunicarte");
  });

  it("recuerda una ruta de programa sin tab", () => {
    expect(slugParaRecordar("/p/tactical-investor", new URLSearchParams())).toBe("tactical-investor");
  });

  it("recuerda el programa de Mi espacio", () => {
    expect(slugParaRecordar("/mi-espacio", new URLSearchParams("programa=comunicarte"))).toBe("comunicarte");
  });

  it("no recuerda todos en Mi espacio", () => {
    expect(slugParaRecordar("/mi-espacio", new URLSearchParams("programa=todos"))).toBeNull();
  });

  it("no recuerda rutas de API", () => {
    expect(slugParaRecordar("/api/p/comunicarte", new URLSearchParams())).toBeNull();
  });

  it("no recuerda otras rutas", () => {
    expect(slugParaRecordar("/ajustes", new URLSearchParams("programa=comunicarte"))).toBeNull();
  });
});

describe("elegirPrograma", () => {
  const visibles = [{ slug: "comunicarte" }, { slug: "tactical-investor" }] as const;

  it("elige el preferido visible", () => {
    expect(elegirPrograma(visibles, "tactical-investor")).toBe(visibles[1]);
  });

  it("usa el primero cuando el preferido no es visible", () => {
    expect(elegirPrograma(visibles, "ajeno")).toBe(visibles[0]);
  });

  it("usa el primero cuando no hay preferido", () => {
    expect(elegirPrograma(visibles, null)).toBe(visibles[0]);
  });

  it("devuelve null cuando no hay visibles", () => {
    expect(elegirPrograma([], "comunicarte")).toBeNull();
  });
});
