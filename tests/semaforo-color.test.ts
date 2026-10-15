import { describe, expect, it } from "vitest";
import type { CostoPorAgenda } from "@/lib/semaforo/costo-por-agenda";
import { colorDeCierre, colorDeDia, porcentajeDelUmbral } from "@/lib/semaforo/color";

const umbral = { meta: 70, aceptable: 93 };

function datos(gasto: number, agendas: number): CostoPorAgenda {
  return {
    gasto,
    agendas,
    costo: agendas > 0 ? gasto / agendas : null,
    agendasMeta: null,
    notas: [],
  };
}

describe("color de cierre", () => {
  it("distingue la falta de cohorte, umbral y pauta", () => {
    expect(colorDeCierre({ datos: datos(70, 1), tieneCohorte: false, umbral })).toEqual({
      color: "sin_dato", motivo: "sin_cohorte",
    });
    expect(colorDeCierre({ datos: datos(70, 1), tieneCohorte: true, umbral: null })).toEqual({
      color: "sin_dato", motivo: "sin_umbral",
    });
    expect(colorDeCierre({ datos: datos(0, 0), tieneCohorte: true, umbral })).toEqual({
      color: "sin_dato", motivo: "sin_pauta",
    });
  });

  it("trata cero agendas con gasto como costo infinito", () => {
    expect(colorDeCierre({ datos: datos(1, 0), tieneCohorte: true, umbral })).toEqual({
      color: "peligro", motivo: null,
    });
  });

  it("cubre ambos lados de meta y aceptable", () => {
    expect(colorDeCierre({ datos: datos(69, 1), tieneCohorte: true, umbral }).color).toBe("exito");
    expect(colorDeCierre({ datos: datos(70, 1), tieneCohorte: true, umbral }).color).toBe("exito");
    expect(colorDeCierre({ datos: datos(71, 1), tieneCohorte: true, umbral }).color).toBe("alerta");
    expect(colorDeCierre({ datos: datos(93, 1), tieneCohorte: true, umbral }).color).toBe("alerta");
    expect(colorDeCierre({ datos: datos(94, 1), tieneCohorte: true, umbral }).color).toBe("peligro");
  });
});

describe("color durante el día", () => {
  it("distingue sin pauta, sin referencia y las dos direcciones de cero agendas", () => {
    expect(colorDeDia({ hoy: datos(0, 0), ayer: datos(10, 1), umbral })).toEqual({
      color: "sin_dato", motivo: "sin_pauta",
    });
    expect(colorDeDia({ hoy: datos(10, 1), ayer: datos(0, 0), umbral })).toEqual({
      color: "exito", motivo: null,
    });
    expect(colorDeDia({ hoy: datos(10, 0), ayer: datos(10, 1), umbral })).toEqual({
      color: "peligro", motivo: null,
    });
    expect(colorDeDia({ hoy: datos(10, 0), ayer: datos(10, 0), umbral })).toEqual({
      color: "sin_dato", motivo: "sin_referencia",
    });
  });

  it("compara con ayer, incluido el aceptable proporcional", () => {
    expect(colorDeDia({ hoy: datos(99, 1), ayer: datos(100, 1), umbral }).color).toBe("exito");
    expect(colorDeDia({ hoy: datos(100, 1), ayer: datos(100, 1), umbral }).color).toBe("exito");
    expect(colorDeDia({ hoy: datos(101, 1), ayer: datos(100, 1), umbral }).color).toBe("alerta");
    expect(colorDeDia({ hoy: datos(133, 1), ayer: datos(100, 1), umbral }).color).toBe("peligro");
    expect(colorDeDia({ hoy: datos(101, 1), ayer: datos(100, 1), umbral: null }).color).toBe("peligro");
  });

  it("calcula el porcentaje contra el umbral solo cuando existe", () => {
    expect(porcentajeDelUmbral(140, umbral)).toBe(200);
    expect(porcentajeDelUmbral(null, umbral)).toBeNull();
    expect(porcentajeDelUmbral(140, null)).toBeNull();
  });
});
