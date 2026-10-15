import { describe, expect, it } from "vitest";
import { cohorteAnterior } from "@/lib/objetivos/cohorte-anterior";

const cohortes = [
  { id: "temprana", fechaInicioVentas: "2026-08-01" },
  { id: "anterior", fechaInicioVentas: "2026-09-01" },
  { id: "actual", fechaInicioVentas: "2026-10-01" },
  { id: "futura", fechaInicioVentas: "2026-11-01" },
  { id: "sin-fecha", fechaInicioVentas: null },
];

describe("cohorteAnterior", () => {
  it("elige la anterior más reciente y nunca una posterior", () => {
    expect(cohorteAnterior(cohortes, "actual")?.id).toBe("anterior");
  });

  it("devuelve null cuando la cohorte no tiene fecha de inicio de ventas", () => {
    expect(cohorteAnterior(cohortes, "sin-fecha")).toBeNull();
  });

  it("devuelve null cuando no hay una cohorte anterior", () => {
    expect(cohorteAnterior(cohortes, "temprana")).toBeNull();
  });
});
