import { describe, expect, it } from "vitest";
import { colorDeCupos, colorDeObjetivo } from "@/lib/objetivos/semaforo";

describe("colorDeObjetivo", () => {
  it("evalúa mayor es mejor, incluidos los bordes", () => {
    expect(colorDeObjetivo({ metrica: "roas", meta: 3, aceptable: 2, valor: 3 })).toBe("exito");
    expect(colorDeObjetivo({ metrica: "roas", meta: 3, aceptable: 2, valor: 2 })).toBe("alerta");
    expect(colorDeObjetivo({ metrica: "roas", meta: 3, aceptable: 2, valor: 1.99 })).toBe("peligro");
  });

  it("evalúa menor es mejor, incluidos los bordes", () => {
    expect(colorDeObjetivo({ metrica: "costo_por_lead", meta: 10, aceptable: 15, valor: 10 })).toBe("exito");
    expect(colorDeObjetivo({ metrica: "costo_por_lead", meta: 10, aceptable: 15, valor: 15 })).toBe("alerta");
    expect(colorDeObjetivo({ metrica: "costo_por_lead", meta: 10, aceptable: 15, valor: 15.01 })).toBe("peligro");
  });

  it("marca peligro al incumplir una meta sin aceptable", () => {
    expect(colorDeObjetivo({ metrica: "agendas_por_dia", meta: 4, aceptable: null, valor: 3.99 })).toBe("peligro");
  });
});

describe("colorDeCupos", () => {
  it("escala meta y aceptable por la fracción transcurrida", () => {
    expect(colorDeCupos({ meta: 100, aceptable: 80, vendidos: 50, fraccionTranscurrida: 0.5 })).toBe("exito");
    expect(colorDeCupos({ meta: 100, aceptable: 80, vendidos: 40, fraccionTranscurrida: 0.5 })).toBe("alerta");
    expect(colorDeCupos({ meta: 100, aceptable: 80, vendidos: 39, fraccionTranscurrida: 0.5 })).toBe("peligro");
  });
});
