import { describe, expect, it } from "vitest";
import {
  diasHabilesDespuesDe,
  escalonDeDeal,
  medianaDe,
  resumirEscalera,
  type HechosDeEscalera,
} from "@/lib/queries/escalera";

/** ADR 0109, ticket 319: la regla pura. 2026-10-05 es lunes: sábado 3 y domingo 4 no cuentan. */

const base: HechosDeEscalera = { vendido: false, primerAbono: null, citasAtendidas: [], citaVencidaSinAtender: false };

describe("escalonDeDeal: la regla y su precedencia", () => {
  it("pagó el mismo día de la cita atendida: en la llamada", () => {
    expect(escalonDeDeal({ ...base, vendido: true, primerAbono: "2026-10-05", citasAtendidas: ["2026-10-05"] }, 3))
      .toEqual({ escalon: "pago_en_llamada", diasCitaAPago: 0 });
  });
  it("hasta el corte en hábiles es rápido; un día más es después", () => {
    const h = { ...base, vendido: true, citasAtendidas: ["2026-10-05"] };
    expect(escalonDeDeal({ ...h, primerAbono: "2026-10-08" }, 3).escalon).toBe("pago_rapido"); // jue: 3 hábiles
    expect(escalonDeDeal({ ...h, primerAbono: "2026-10-09" }, 3)).toMatchObject({ escalon: "pago_despues", diasCitaAPago: 4 });
  });
  it("el fin de semana no cuenta: viernes a lunes es 1 hábil", () => {
    expect(diasHabilesDespuesDe("2026-10-02", "2026-10-05")).toBe(1);
    expect(diasHabilesDespuesDe("2026-10-03", "2026-10-05")).toBe(1); // cita en sábado
    expect(diasHabilesDespuesDe("2026-10-05", "2026-10-05")).toBe(0);
    expect(escalonDeDeal({ ...base, vendido: true, primerAbono: "2026-10-05", citasAtendidas: ["2026-10-02"] }, 1).escalon).toBe("pago_rapido");
  });
  it("corte nulo junta 2 y 3 en 'pagó después'", () => {
    expect(escalonDeDeal({ ...base, vendido: true, primerAbono: "2026-10-06", citasAtendidas: ["2026-10-05"] }, null))
      .toMatchObject({ escalon: "pago_despues", diasCitaAPago: 1 });
  });
  it("la cita atendida que cuenta es la última anterior al abono, no una posterior", () => {
    const h = { ...base, vendido: true, primerAbono: "2026-10-06", citasAtendidas: ["2026-09-28", "2026-10-06", "2026-10-09"] };
    expect(escalonDeDeal(h, 3).escalon).toBe("pago_en_llamada");
    expect(escalonDeDeal({ ...h, citasAtendidas: ["2026-09-28", "2026-10-09"] }, 3)).toMatchObject({ escalon: "pago_despues", diasCitaAPago: 6 });
  });
  it("pagó sin cita atendida anterior: escalón aparte, sin días", () => {
    expect(escalonDeDeal({ ...base, vendido: true, primerAbono: "2026-10-06", citasAtendidas: ["2026-10-09"] }, 3))
      .toEqual({ escalon: "pago_sin_llamada", diasCitaAPago: null });
    expect(escalonDeDeal({ ...base, vendido: true }, 3).escalon).toBe("pago_sin_llamada");
  });
  it("sin venta: atendió, agendó o dejó datos, en ese orden", () => {
    expect(escalonDeDeal({ ...base, citasAtendidas: ["2026-10-05"] }, 3).escalon).toBe("atendio_no_compro");
    expect(escalonDeDeal({ ...base, citaVencidaSinAtender: true }, 3).escalon).toBe("agendo_no_se_presento");
    expect(escalonDeDeal(base, 3).escalon).toBe("dejo_datos");
  });
  it("mediana y base cero", () => {
    expect(medianaDe([])).toBeNull();
    expect(medianaDe([5, 1, 3])).toBe(3);
    expect(medianaDe([1, 2, 3, 4])).toBe(2.5);
    expect(resumirEscalera([], 3).lineas.every((l) => l.porcentaje === null && l.deals === 0)).toBe(true);
  });
});
