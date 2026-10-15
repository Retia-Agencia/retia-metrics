import { describe, expect, it } from "vitest";
import {
  queTocaAhora,
  type ReporteConfig,
} from "@/lib/reporte-whatsapp/que-toca";

const base: ReporteConfig = {
  programId: "programa-a",
  activo: true,
  destino: "grupo@g.us",
  horas: [11],
  horaCierre: 18,
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
      destino: "grupo@g.us",
      tipo: "dia",
      hora: "11:00",
      metricas: ["costo_por_agenda"],
    }]);
  });

  it("no devuelve nada un sabado", () => {
    expect(queTocaAhora(new Date("2026-10-17T16:00:00Z"), [base])).toEqual([]);
  });

  it("el cierre gana si coincide con una hora del dia", () => {
    expect(queTocaAhora(new Date("2026-10-13T23:00:00Z"), [
      { ...base, horas: [18] },
    ])).toMatchObject([{ tipo: "cierre", hora: "18:00" }]);
  });

  it("tolera diez minutos de cola pero no veinte", () => {
    expect(queTocaAhora(new Date("2026-10-13T16:10:00Z"), [base])).toHaveLength(1);
    expect(queTocaAhora(new Date("2026-10-13T16:20:00Z"), [base])).toEqual([]);
  });

  it("conserva dos programas aunque compartan destino", () => {
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
    // En UTC ya es lunes; en Bogota todavía es domingo.
    expect(queTocaAhora(new Date("2026-10-12T03:00:00Z"), [
      { ...base, horas: [22] },
    ])).toEqual([]);
  });
});
