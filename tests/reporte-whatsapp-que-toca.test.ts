import { describe, expect, it } from "vitest";
import {
  queTocaAhora,
  type ReporteConfig,
} from "@/lib/reporte-whatsapp/que-toca";

const base: ReporteConfig = {
  programId: "programa-a",
  activo: true,
  horas: [8, 11, 14, 17],
  horaCierre: 20,
  metricas: ["costo_por_agenda"],
};

describe("que toca enviar por WhatsApp", () => {
  it("devuelve a las 11 de un martes los programas que tienen esa hora", () => {
    const resultado = queTocaAhora(new Date("2026-10-13T16:00:00Z"), [
      base,
      { ...base, programId: "programa-b", horas: [12] },
    ]);
    expect(resultado).toEqual([{
      programId: "programa-a",
      tipo: "dia",
      hora: "11:00",
      metricas: ["costo_por_agenda"],
    }]);
  });

  it("a las 17 toca el reporte del día configurado", () => {
    expect(queTocaAhora(new Date("2026-10-13T22:00:00Z"), [base]))
      .toMatchObject([{ tipo: "dia", hora: "17:00" }]);
  });

  it("a las 20 toca el cierre configurado", () => {
    expect(queTocaAhora(new Date("2026-10-14T01:00:00Z"), [base]))
      .toMatchObject([{ tipo: "cierre", hora: "20:00" }]);
  });

  it("envia también en sábado dentro de la gracia", () => {
    expect(queTocaAhora(new Date("2026-10-17T13:05:00Z"), [base]))
      .toMatchObject([{ tipo: "dia", hora: "08:00" }]);
  });

  it("a las 00:05 devuelve el cierre configurado", () => {
    expect(queTocaAhora(new Date("2026-10-17T05:05:00Z"), [{ ...base, horaCierre: 0 }]))
      .toMatchObject([{ tipo: "cierre", hora: "00:00" }]);
  });

  it("el cierre gana si coincide con una hora del dia", () => {
    expect(queTocaAhora(new Date("2026-10-13T23:00:00Z"), [
      { ...base, horas: [18], horaCierre: 18 },
    ])).toMatchObject([{ tipo: "cierre", hora: "18:00" }]);
  });

  it("tolera diez minutos de cola pero no veinte", () => {
    expect(queTocaAhora(new Date("2026-10-13T16:10:00Z"), [base])).toHaveLength(1);
    expect(queTocaAhora(new Date("2026-10-13T16:20:00Z"), [base])).toEqual([]);
  });

  it("conserva dos programas en la misma hora", () => {
    const resultado = queTocaAhora(new Date("2026-10-13T16:00:00Z"), [
      base,
      { ...base, programId: "programa-b" },
    ]);
    expect(resultado.map((reporte) => reporte.programId)).toEqual(["programa-a", "programa-b"]);
  });

  it("omite reportes inactivos o sin metricas", () => {
    expect(queTocaAhora(new Date("2026-10-13T16:00:00Z"), [
      { ...base, activo: false },
      { ...base, programId: "programa-b", metricas: [] },
    ])).toEqual([]);
  });

  it("resuelve en Bogota el instante UTC que cae en otro dia", () => {
    expect(queTocaAhora(new Date("2026-10-12T03:00:00Z"), [
      { ...base, horas: [22] },
    ])).toMatchObject([{ tipo: "dia", hora: "22:00" }]);
  });
});
