import { describe, expect, it } from "vitest";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { camposDeDialogo, destinosArrastrables, flechaPideDatos, flechasDesde, razonSistema, sePuedeArrastrar } from "@/components/deals/transiciones";

const MAPA = mapaDeTransiciones();
describe("mapa serializable del Kanban", () => {
  it("incluye flechas de etapa y de pendiente como JSON plano", () => {
    expect(new Set(MAPA.map((f) => f.tipo))).toEqual(new Set(["etapa", "pendiente"]));
    expect(new Set(MAPA.filter((f) => f.tipo === "pendiente").map((f) => f.id))).toEqual(new Set(["PR1", "PR2", "PS1", "PS2", "PS3", "PC"]));
    expect(() => JSON.stringify(MAPA)).not.toThrow();
  });

  it("solo las flechas de etapa de persona son arrastrables", () => {
    expect(sePuedeArrastrar(MAPA, "contactado", "calificado")).toBe(true);
    expect(sePuedeArrastrar(MAPA, "atendido", "ganado_parcial")).toBe(false);
    expect(razonSistema(MAPA, "atendido", "ganado_parcial")).not.toBeNull();
    expect(destinosArrastrables(MAPA, "atendido")).toEqual(new Set(["agendado", "compromiso_verbal", "cierre_perdido"]));
  });

  it("no mezcla pendientes en los destinos de columnas", () => {
    expect(flechasDesde(MAPA, "atendido").every((f) => f.tipo === "etapa")).toBe(true);
  });

  it("expone los datos que pide una flecha", () => {
    const compromiso = flechasDesde(MAPA, "atendido").find((f) => f.a === "compromiso_verbal")!;
    expect(flechaPideDatos(compromiso)).toBe(true);
    expect(camposDeDialogo(compromiso)).toEqual(["fecha_limite_pago", "area_declarada"]);
    const perdido = flechasDesde(MAPA, "contactado").find((f) => f.a === "cierre_perdido")!;
    expect(camposDeDialogo(perdido)).toEqual(["motivo"]);
  });
});

