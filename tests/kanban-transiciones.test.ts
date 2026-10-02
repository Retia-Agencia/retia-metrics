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
  it("una flecha de closer se arrastra (T1: Pendiente Setteo -> En Contacto)", () => {
    expect(sePuedeArrastrar(MAPA, "pendiente_setteo", "en_contacto")).toBe(true);
  });

  it("una flecha del SISTEMA no se arrastra (T13: Atendido -> Abonado, lo pone el abono)", () => {
    expect(sePuedeArrastrar(MAPA, "atendido", "abonado")).toBe(false);
    expect(razonSistema(MAPA, "atendido", "abonado")).not.toBeNull();
  });

  it("una transicion inexistente no se arrastra (Pendiente Setteo -> Completo)", () => {
    expect(sePuedeArrastrar(MAPA, "pendiente_setteo", "completo")).toBe(false);
    expect(razonSistema(MAPA, "pendiente_setteo", "completo")).toBeNull();
  });

  it("`ambos` se arrastra (T2: Pendiente Setteo -> Agendado)", () => {
    expect(sePuedeArrastrar(MAPA, "pendiente_setteo", "agendado")).toBe(true);
  });
});

describe("destinosArrastrables", () => {
  it("desde Atendido solo trae los destinos de PERSONA, nunca Abonado/Completo (sistema)", () => {
    const destinos = destinosArrastrables(MAPA, "atendido");
    // T12 (Compromiso Verbal), T24 (Seguimiento), T20 (Proxima Cohorte), T29 (Re-agenda),
    // P (Cierre Perdido) son de closer/ambos; T13/T14 (Abonado/Completo) son del sistema.
    expect(destinos.has("compromiso_verbal")).toBe(true);
    expect(destinos.has("seguimiento")).toBe(true);
    expect(destinos.has("abonado")).toBe(false);
    expect(destinos.has("completo")).toBe(false);
  });
});

describe("flechasDesde", () => {
  it("no ofrece la flecha que vuelve a la misma etapa (T9, reagenda que sigue en Agendado)", () => {
    const destinos = flechasDesde(MAPA, "agendado").map((f) => f.a);
    expect(destinos).not.toContain("agendado");
    expect(destinos).toContain("cierre_perdido");
  });
});

describe("flechaPideDatos / camposDeDialogo", () => {
  it("T12 (Atendido -> Compromiso Verbal) pide fecha límite y área: abre diálogo", () => {
    const f = flechasDesde(MAPA, "atendido").find((x) => x.a === "compromiso_verbal")!;
    expect(flechaPideDatos(f)).toBe(true);
    expect(camposDeDialogo(f)).toEqual(["fecha_limite_pago", "area_declarada"]);
  });

  it("P (-> Cierre Perdido) exige motivo: abre dialogo con el campo motivo", () => {
    const f = flechasDesde(MAPA, "en_contacto").find((x) => x.a === "cierre_perdido")!;
    expect(flechaPideDatos(f)).toBe(true);
    expect(camposDeDialogo(f)).toContain("motivo");
  });

  it("T1 (Pendiente Setteo -> En Contacto) NO pide datos tecleados (contacto/dueno se miden en la base)", () => {
    const f = flechasDesde(MAPA, "pendiente_setteo").find((x) => x.a === "en_contacto")!;
    expect(flechaPideDatos(f)).toBe(false);
    expect(camposDeDialogo(f)).toEqual([]);
  });

  it("T24 (Atendido -> Seguimiento) pide la fecha de seguimiento", () => {
    const f = flechasDesde(MAPA, "atendido").find((x) => x.a === "seguimiento")!;
    expect(flechaPideDatos(f)).toBe(true);
    expect(camposDeDialogo(f)).toContain("fecha_seguimiento");
  });
});
