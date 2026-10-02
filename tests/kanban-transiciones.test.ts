import { describe, expect, it } from "vitest";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import {
  camposDeDialogo,
  destinosArrastrables,
  flechaPideDatos,
  flechasDesde,
  razonSistema,
  sePuedeArrastrar,
} from "@/components/deals/transiciones";

/**
 * Ticket 069: la logica cliente del arrastre, pura. El mapa que el servidor pasa sale de
 * `mapaDeTransiciones()` (aplanado de la tabla del motor), y estas funciones deciden que
 * se puede arrastrar, que no, y que abre un dialogo. La reja de verdad la vuelve a
 * aplicar el servidor en `moverEtapa()`; esto es solo el resaltado.
 */

const MAPA = mapaDeTransiciones();

describe("mapaDeTransiciones", () => {
  it("aplana la tabla a datos planos sin drizzle", () => {
    expect(MAPA.length).toBeGreaterThan(0);
    for (const f of MAPA) {
      expect(typeof f.de).toBe("string");
      expect(typeof f.a).toBe("string");
      expect(["sistema", "closer", "ambos"]).toContain(f.quien);
      expect(typeof f.exigeMotivo).toBe("boolean");
      expect(Array.isArray(f.requisitos)).toBe(true);
    }
  });
});

describe("sePuedeArrastrar", () => {
  it("una flecha de closer se arrastra (E3: Contactado -> Calificado)", () => {
    expect(sePuedeArrastrar(MAPA, "contactado", "calificado")).toBe(true);
  });

  it("una flecha del SISTEMA no se arrastra (E11: Atendido -> Ganado Pago Parcial)", () => {
    expect(sePuedeArrastrar(MAPA, "atendido", "ganado_parcial")).toBe(false);
    expect(razonSistema(MAPA, "atendido", "ganado_parcial")).not.toBeNull();
  });

  it("una transicion inexistente no se arrastra (Registrado -> Ganado Pagado Completo)", () => {
    expect(sePuedeArrastrar(MAPA, "registrado", "ganado_completo")).toBe(false);
    expect(razonSistema(MAPA, "registrado", "ganado_completo")).toBeNull();
  });

  it("`ambos` se arrastra (E4: Registrado -> Agendado)", () => {
    expect(sePuedeArrastrar(MAPA, "registrado", "agendado")).toBe(true);
  });
});

describe("destinosArrastrables", () => {
  it("desde Atendido solo trae los destinos de PERSONA, nunca Abonado/Completo (sistema)", () => {
    const destinos = destinosArrastrables(MAPA, "atendido");
    // E10 (Compromiso Verbal), los pendientes PS1/PC/PR2 y P son de closer/ambos;
    // E11 hacia Ganado Pago Parcial/Completo es del sistema.
    expect(destinos.has("compromiso_verbal")).toBe(true);
    expect(destinos.has("atendido")).toBe(false);
    expect(destinos.has("ganado_parcial")).toBe(false);
    expect(destinos.has("ganado_completo")).toBe(false);
  });
});

describe("flechasDesde", () => {
  it("no ofrece la flecha que vuelve a la misma etapa (E7, reagenda que sigue en Agendado)", () => {
    const destinos = flechasDesde(MAPA, "agendado").map((f) => f.a);
    expect(destinos).not.toContain("agendado");
    expect(destinos).toContain("cierre_perdido");
  });
});

describe("flechaPideDatos / camposDeDialogo", () => {
  it("E10 (Atendido -> Compromiso Verbal) pide fecha límite y área: abre diálogo", () => {
    const f = flechasDesde(MAPA, "atendido").find((x) => x.a === "compromiso_verbal")!;
    expect(flechaPideDatos(f)).toBe(true);
    expect(camposDeDialogo(f)).toEqual(["fecha_limite_pago", "area_declarada"]);
  });

  it("P (-> Cierre Perdido) exige motivo: abre dialogo con el campo motivo", () => {
    const f = flechasDesde(MAPA, "contactado").find((x) => x.a === "cierre_perdido")!;
    expect(flechaPideDatos(f)).toBe(true);
    expect(camposDeDialogo(f)).toContain("motivo");
  });

  it("E3 (Contactado -> Calificado) NO pide datos tecleados (el contacto se mide en la base)", () => {
    const f = flechasDesde(MAPA, "contactado").find((x) => x.a === "calificado")!;
    expect(flechaPideDatos(f)).toBe(false);
    expect(camposDeDialogo(f)).toEqual([]);
  });

  it("PS1 (Atendido + Seguimiento) pide la fecha de seguimiento", () => {
    const f = MAPA.find((x) => x.tipo === "pendiente" && x.de === "atendido" && x.pendienteA === "seguimiento")!;
    expect(flechaPideDatos(f)).toBe(true);
    expect(camposDeDialogo(f)).toContain("fecha_seguimiento");
  });
});

import "./142-nuevas-kanban-transiciones";
