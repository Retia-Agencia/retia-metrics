import { describe, expect, it } from "vitest";
import { queryDePautaDesdeOrigen } from "@/lib/nav";
import { VISTAS_DE_PAUTA, vistaDePauta } from "@/lib/pauta/vista-de-pauta";

describe("las dos vistas de Pauta (420)", () => {
  it("Resultados por defecto; un valor raro o repetido también vuelve a Resultados", () => {
    expect(vistaDePauta(undefined)).toBe("resultados");
    expect(vistaDePauta("calidad")).toBe("calidad");
    expect(vistaDePauta("origen")).toBe("resultados");
    expect(vistaDePauta(["calidad", "calidad"])).toBe("resultados");
  });

  it("las dos vistas, en el orden del diseño y con sus nombres visibles", () => {
    expect(VISTAS_DE_PAUTA.map((v) => v.etiqueta)).toEqual(["Resultados", "Origen y calidad"]);
  });

  it("la URL vieja de Origen cae en Origen y calidad, vista Canal, sin pisar lo que traía", () => {
    expect(queryDePautaDesdeOrigen({ seccion: "origen" })).toBe("?seccion=pauta&ver_por=canal&vista=calidad");
    expect(queryDePautaDesdeOrigen({ seccion: "origen", vista: "resultados" })).toBe("?seccion=pauta&vista=resultados&ver_por=canal");
  });
});
