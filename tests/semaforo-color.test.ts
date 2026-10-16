import { describe, expect, it } from "vitest";
import type { CostoPorAgenda } from "@/lib/semaforo/costo-por-agenda";
import { colorDelCosto, porcentajeDelUmbral } from "@/lib/semaforo/color";

const umbral = { meta: 70, aceptable: 93 };

function datos(gasto: number, agendasMeta: number | null, agendasCrm = 0): CostoPorAgenda {
  return {
    gasto,
    agendasMeta,
    agendasCrm,
    costo: agendasMeta !== null && agendasMeta > 0 ? gasto / agendasMeta : null,
    notas: [],
  };
}

describe("color del costo por agenda", () => {
  it("distingue la falta de cohorte, umbral y pauta", () => {
    expect(colorDelCosto({ datos: datos(70, 1), tieneCohorte: false, umbral })).toEqual({
      color: "sin_dato", motivo: "sin_cohorte",
    });
    expect(colorDelCosto({ datos: datos(70, 1), tieneCohorte: true, umbral: null })).toEqual({
      color: "sin_dato", motivo: "sin_umbral",
    });
    expect(colorDelCosto({ datos: datos(0, 0), tieneCohorte: true, umbral })).toEqual({
      color: "sin_dato", motivo: "sin_pauta",
    });
  });

  it("trata cero agendas con gasto como costo infinito", () => {
    expect(colorDelCosto({ datos: datos(1, 0), tieneCohorte: true, umbral })).toEqual({
      color: "peligro", motivo: null,
    });
  });

  it("cubre ambos lados de meta y aceptable", () => {
    expect(colorDelCosto({ datos: datos(69, 1), tieneCohorte: true, umbral }).color).toBe("exito");
    expect(colorDelCosto({ datos: datos(70, 1), tieneCohorte: true, umbral }).color).toBe("exito");
    expect(colorDelCosto({ datos: datos(71, 1), tieneCohorte: true, umbral }).color).toBe("alerta");
    expect(colorDelCosto({ datos: datos(93, 1), tieneCohorte: true, umbral }).color).toBe("alerta");
    expect(colorDelCosto({ datos: datos(94, 1), tieneCohorte: true, umbral }).color).toBe("peligro");
  });

  it("distingue agendas de Meta ausentes de cero agendas", () => {
    expect(colorDelCosto({ datos: datos(10, null), tieneCohorte: true, umbral })).toEqual({
      color: "sin_dato", motivo: "sin_agendas_meta",
    });
    expect(colorDelCosto({ datos: datos(10, 0), tieneCohorte: true, umbral })).toEqual({
      color: "peligro", motivo: null,
    });
  });

  it("el caso real del 16-oct se pinta contra la meta de la cohorte", () => {
    expect(colorDelCosto({
      datos: datos(218653, 1, 1),
      tieneCohorte: true,
      umbral: { meta: 85000, aceptable: 105000 },
    })).toEqual({ color: "peligro", motivo: null });
  });

  it("calcula el porcentaje contra el umbral solo cuando existe", () => {
    expect(porcentajeDelUmbral(140, umbral)).toBe(200);
    expect(porcentajeDelUmbral(null, umbral)).toBeNull();
    expect(porcentajeDelUmbral(140, null)).toBeNull();
  });
});
