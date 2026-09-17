import { describe, expect, it } from "vitest";
import { REGISTRO_CATALOGOS, catalogoPorSlug } from "@/lib/catalogo/registro";

/**
 * Ticket 013: la pantalla de catalogos se arma sobre UN registro de definiciones.
 * Agregar un catalogo nuevo a la pantalla debe ser una sola linea de configuracion
 * (ADR 0012, criterio "Done cuando" del ticket). Este test fija ese contrato: el
 * registro incluye los tres catalogos del molde y ni uno mas escrito a mano.
 */
describe("registro de catalogos (ticket 013)", () => {
  it("incluye exactamente plataformas, motivos y origenes", () => {
    const slugs = REGISTRO_CATALOGOS.map((c) => c.slug).sort();
    expect(slugs).toEqual(["motivos", "origenes", "plataformas"]);
  });

  it("cada definicion trae nombre visible, esquema y fabrica del catalogo", () => {
    for (const def of REGISTRO_CATALOGOS) {
      expect(typeof def.nombre).toBe("string");
      expect(def.nombre.length).toBeGreaterThan(0);
      expect(def.esquema).toBeDefined();
      expect(typeof def.fabrica).toBe("function");
    }
  });

  it("catalogoPorSlug resuelve un slug conocido y rechaza uno desconocido", () => {
    expect(catalogoPorSlug("plataformas")?.slug).toBe("plataformas");
    expect(catalogoPorSlug("no-existe")).toBeUndefined();
  });
});
