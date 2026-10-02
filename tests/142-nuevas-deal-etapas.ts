import { describe, expect, it } from "vitest";
import {
  ETAPAS,
  ETAPAS_DE_SETTEO,
  ETAPAS_EN_ORDEN,
  NOMBRE_DE_ETAPA,
  NOMBRE_DE_PENDIENTE,
  TRANSICIONES,
  TRANSICIONES_PENDIENTE,
  transicion,
  transicionPendiente,
  transicionRetomar,
  unaCitaMueveAAgendado,
  type PendienteDeal,
} from "@/lib/deals/etapas";

describe("etapas 30X", () => {
  it("expone las once etapas, sus nombres y el orden del Kanban", () => {
    expect(ETAPAS).toHaveLength(11);
    expect(ETAPAS_EN_ORDEN).toEqual([
      "potencial", "registrado", "en_gestion", "contactado", "calificado", "agendado",
      "atendido", "compromiso_verbal", "ganado_parcial", "ganado_completo", "cierre_perdido",
    ]);
    expect(ETAPAS_DE_SETTEO).toEqual(["potencial", "registrado", "en_gestion", "contactado", "calificado"]);
    expect(NOMBRE_DE_ETAPA.ganado_completo).toBe("Ganado Pagado Completo");
    expect(NOMBRE_DE_PENDIENTE).toEqual({ reagenda: "Re-agenda", seguimiento: "Seguimiento", proxima_cohorte: "Próxima Cohorte" });
  });

  it("contiene exactamente las flechas de etapa decididas", () => {
    expect(new Set(TRANSICIONES.map((t) => t.id))).toEqual(new Set([
      "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13",
      "RETRO", "P", "R", "A1", "A2",
    ]));
    for (const t of TRANSICIONES) expect(transicion(t.de, t.a), `${t.id}: ${t.de} → ${t.a}`).toEqual(t);
    expect(new Set(TRANSICIONES.map((t) => `${t.de}>${t.a}`)).size).toBe(TRANSICIONES.length);
    expect(transicion("potencial", "ganado_completo")).toBeNull();
  });

  it("contiene todas las flechas que ponen pendiente y RET solo quita Próxima Cohorte", () => {
    expect(new Set(TRANSICIONES_PENDIENTE.map((t) => t.id))).toEqual(new Set(["PR1", "PR2", "PS1", "PS2", "PS3", "PC"]));
    for (const t of TRANSICIONES_PENDIENTE) expect(transicionPendiente(t.etapa, t.pone!)).toEqual(t);
    expect(new Set(TRANSICIONES_PENDIENTE.map((t) => `${t.etapa}>${t.pone}`)).size).toBe(TRANSICIONES_PENDIENTE.length);
    expect(transicionPendiente("potencial", "reagenda")).toBeNull();
    expect(transicionRetomar("calificado", "proxima_cohorte")).toMatchObject({ id: "RET", pone: null });
    expect(transicionRetomar("calificado", "seguimiento")).toBeNull();
  });
});

describe("una cita nueva", () => {
  const pendientes: readonly (PendienteDeal | null)[] = [null, "reagenda", "seguimiento", "proxima_cohorte"];
  for (const etapa of ETAPAS) {
    for (const pendiente of pendientes) {
      const esperado = ETAPAS_DE_SETTEO.includes(etapa) || ((etapa === "agendado" || etapa === "atendido") && pendiente != null);
      it(`${etapa} con ${pendiente ?? "ningún pendiente"}: ${esperado ? "mueve" : "no mueve"}`, () => {
        expect(unaCitaMueveAAgendado(etapa, pendiente)).toBe(esperado);
      });
    }
  }
});

