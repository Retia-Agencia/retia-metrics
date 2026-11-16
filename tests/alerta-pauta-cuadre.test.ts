import { describe, expect, it } from "vitest";
import { alertasDelContexto } from "@/lib/alertas/registro";

const AHORA = new Date("2026-11-13T10:00:00-05:00");
const base = {
  cuentaId: "cuenta-1",
  idMeta: "567726836094755",
  programaNombre: "Comunícate con Confianza",
  fecha: "2026-10-15",
  moneda: "COP",
  gastoMeta: "184167",
  gastoCrm: "26797",
};

describe("alerta de pauta descuadrada", () => {
  it("alerta por más de un peso y no por una diferencia de un peso", () => {
    const tolerado = alertasDelContexto({
      fuentes: [],
      hostsSinCloser: [],
      descuadres: [{ ...base, gastoMeta: "100", gastoCrm: "99" }],
    }, AHORA);
    expect(tolerado).toEqual([]);

    const alertas = alertasDelContexto({ fuentes: [], hostsSinCloser: [], descuadres: [base] }, AHORA);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      clave: "pauta_descuadrada:cuenta-1",
      tipo: "pauta_descuadrada",
      severidad: "critica",
    });
    expect(alertas[0].texto).toContain("faltan COP 157.370");
    expect(alertas[0].texto).toContain("en 1 día (15-oct)");
  });

  it("agrega varios días por cuenta, conserva USD y dice sobran", () => {
    const descuadres = [
      { ...base, moneda: "USD", gastoMeta: "10", gastoCrm: "13", fecha: "2026-10-14" },
      { ...base, moneda: "USD", gastoMeta: "20", gastoCrm: "22", fecha: "2026-10-15" },
    ];
    const alertas = alertasDelContexto({ fuentes: [], hostsSinCloser: [], descuadres }, AHORA);

    expect(alertas).toHaveLength(1);
    expect(alertas[0].texto).toContain("Meta reporta USD 30,00 y el CRM USD 35,00");
    expect(alertas[0].texto).toContain("sobran USD 5,00");
    expect(alertas[0].texto).toContain("en 2 días (14-oct a 15-oct)");
  });

  it("no compensa faltantes y sobrantes aunque el neto sea cero", () => {
    const descuadres = [
      { ...base, gastoMeta: "200", gastoCrm: "100", fecha: "2026-11-13" },
      { ...base, gastoMeta: "300", gastoCrm: "250", fecha: "2026-11-15" },
      { ...base, gastoMeta: "100", gastoCrm: "250", fecha: "2026-10-20" },
    ];

    const alertas = alertasDelContexto({ fuentes: [], hostsSinCloser: [], descuadres }, AHORA);

    expect(alertas).toHaveLength(1);
    expect(alertas[0].texto).toContain("Meta reporta COP 600 y el CRM COP 600");
    expect(alertas[0].texto).toContain("faltan COP 150 en 2 días (13-nov a 15-nov)");
    expect(alertas[0].texto).toContain("sobran COP 150 en 1 día (20-oct)");
  });
});
