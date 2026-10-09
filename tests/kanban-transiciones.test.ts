import { describe, expect, it } from "vitest";
import { mapaDeTransiciones } from "@/lib/deals/mapa-transiciones";
import { camposDeDialogo, type FlechaCliente } from "@/components/deals/transiciones";

/**
 * Ticket 069 y 142: el mapa que el servidor le pasa al cliente sale de
 * `mapaDeTransiciones()` (aplanado de la tabla del motor), y `camposDeDialogo` dice qué
 * pide el dialogo de una flecha. Qué se puede soltar en cada columna ya no sale del mapa
 * sino de la pregunta de la etapa (`tests/pregunta-de-etapa.test.ts`). La reja de
 * verdad la vuelve a aplicar el servidor en `moverEtapa()`.
 */

const MAPA = mapaDeTransiciones();
const etapa = (de: string, a: string): FlechaCliente => MAPA.find((f) => f.tipo === "etapa" && f.de === de && f.a === a)!;

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
    expect(() => JSON.stringify(MAPA)).not.toThrow();
  });

  it("incluye flechas de etapa y de pendiente; RET no, porque es automática", () => {
    expect(new Set(MAPA.map((f) => f.tipo))).toEqual(new Set(["etapa", "pendiente"]));
    expect(new Set(MAPA.filter((f) => f.tipo === "pendiente").map((f) => f.id))).toEqual(
      new Set(["PR1", "PR2", "PS1", "PS2", "PS3", "PC"]),
    );
  });
});

describe("camposDeDialogo", () => {
  it("E10 (Atendido -> Compromiso Verbal) pide fecha límite y área", () => {
    expect(camposDeDialogo(etapa("atendido", "compromiso_verbal"))).toEqual(["fecha_limite_pago"]);
  });

  it("P (-> Cierre Perdido) pide solo el motivo", () => {
    expect(camposDeDialogo(etapa("contactado", "cierre_perdido"))).toEqual(["motivo"]);
  });

  it("E3 (Contactado -> Calificado) no pide datos tecleados: el contacto se mide en la base", () => {
    expect(camposDeDialogo(etapa("contactado", "calificado"))).toEqual([]);
  });

  it("PS1 (Atendido + Seguimiento) pide la fecha de seguimiento", () => {
    const f = MAPA.find((x) => x.tipo === "pendiente" && x.de === "atendido" && x.pendienteA === "seguimiento")!;
    expect(camposDeDialogo(f)).toContain("fecha_seguimiento");
  });
});
