import { describe, expect, it } from "vitest";
import { queryDePautaDesdeOrigen } from "@/lib/nav";
import { resumenDeFiltrosDePauta, VISTAS_DE_PAUTA, vistaDePauta } from "@/lib/pauta/vista-de-pauta";

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

  it("la línea de resumen dice en palabras lo que se ve, y que los programas no se mezclan", () => {
    const escribirFecha = (dia: string) => dia.slice(5);
    expect(resumenDeFiltrosDePauta({ programa: "ComunicArte", cohorte: "C6", rango: { desde: "2026-10-12", hasta: "2026-11-10" }, comparacion: null, closer: null, escribirFecha }))
      .toBe("Viendo ComunicArte, cohorte C6, 10-12 a 11-10. Un programa a la vez: nunca se mezclan.");
    expect(resumenDeFiltrosDePauta({ programa: "Tactical", cohorte: null, rango: { desde: "2026-11-10", hasta: "2026-11-10" }, comparacion: { desde: "2026-11-03", hasta: "2026-11-03" }, closer: "Maru", escribirFecha }))
      .toBe("Viendo Tactical, todas las cohortes, 11-10, solo Maru, comparado con 11-03. Un programa a la vez: nunca se mezclan.");
  });
});
