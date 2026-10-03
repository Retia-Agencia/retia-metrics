import { describe, expect, it } from "vitest";
import { hayFiltrosActivos, siguienteQuery } from "@/components/filtros/query";

describe("filtros en la URL", () => {
  it("conserva otros parámetros y aplica los cambios", () => {
    expect(siguienteQuery("programa=uno&closer=viejo", { closer: "nuevo" })).toBe(
      "programa=uno&closer=nuevo",
    );
  });

  it.each([null, ""])("borra un parámetro con %j", (valor) => {
    expect(siguienteQuery("closer=uno&resultado=venta", { closer: valor })).toBe("resultado=venta");
  });

  it("siempre elimina la página", () => {
    expect(siguienteQuery("pagina=4&closer=uno", { resultado: "venta" })).toBe(
      "closer=uno&resultado=venta",
    );
  });

  it("quita varios filtros a la vez", () => {
    expect(siguienteQuery("closer=uno&desde=2026-10-01&orden=reciente&pagina=2", {
      closer: null,
      desde: null,
    })).toBe("orden=reciente");
  });

  it("detecta solo filtros con valor", () => {
    expect(hayFiltrosActivos("closer=&pagina=2&resultado=venta", ["closer", "resultado"])).toBe(true);
    expect(hayFiltrosActivos(new URLSearchParams("closer=&pagina=2"), ["closer", "resultado"])).toBe(false);
  });
});
