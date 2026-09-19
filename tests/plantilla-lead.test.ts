import { describe, expect, it } from "vitest";
import { combinarMapeo } from "@/lib/sheets/plantilla-lead";
import { MAPEO_FORMULARIO } from "@/lib/sheets/mapeo";

/**
 * Ticket 016 / ADR 0019: el mapeo se combina campo por campo con precedencia
 * fuente → programa → defecto. Funcion PURA, sin base, mismo molde que plan-sync.
 */

describe("combinarMapeo", () => {
  it("un ajuste de fuente gana sobre la plantilla del programa y sobre el defecto", () => {
    const { mapeo, origen } = combinarMapeo(
      { nombre: "encabezado de la hoja" },
      { nombre: "encabezado del programa" },
      { nombre: "encabezado por defecto" },
    );
    expect(mapeo.nombre).toBe("encabezado de la hoja");
    expect(origen.nombre).toBe("fuente");
  });

  it("un campo sin ajuste de fuente hereda de la plantilla del programa", () => {
    const { mapeo, origen } = combinarMapeo(
      { nombre: "de la hoja" },
      { telefono: "del programa" },
      { nombre: "defecto nombre", telefono: "defecto telefono" },
    );
    expect(mapeo.telefono).toBe("del programa");
    expect(origen.telefono).toBe("programa");
    // Y el que la fuente si ajusto sigue siendo de la fuente.
    expect(origen.nombre).toBe("fuente");
  });

  it("un campo que nadie ajusta cae al defecto", () => {
    const { mapeo, origen } = combinarMapeo(null, null, {
      correo: "defecto correo",
    });
    expect(mapeo.correo).toBe("defecto correo");
    expect(origen.correo).toBe("defecto");
  });

  it("origen reporta los tres casos a la vez", () => {
    const { origen } = combinarMapeo(
      { a: "de fuente" },
      { b: "de programa" },
      { a: "def a", b: "def b", c: "def c" },
    );
    expect(origen).toEqual({ a: "fuente", b: "programa", c: "defecto" });
  });

  it("nulos en cualquier nivel no rompen; se usa el defecto de MAPEO_FORMULARIO", () => {
    const { mapeo } = combinarMapeo(null, null);
    // Sin fuente ni programa, el mapeo efectivo ES el defecto del codigo.
    expect(mapeo).toEqual(MAPEO_FORMULARIO);
  });

  it("un patron vacio no ajusta: no pisa al nivel de abajo", () => {
    const { mapeo, origen } = combinarMapeo(
      { nombre: "" },
      { nombre: [] },
      { nombre: "defecto nombre" },
    );
    expect(mapeo.nombre).toBe("defecto nombre");
    expect(origen.nombre).toBe("defecto");
  });

  it("una lista de alternativas se conserva tal cual", () => {
    const { mapeo } = combinarMapeo({ telefono: ["whatsapp", "celular"] }, null, {});
    expect(mapeo.telefono).toEqual(["whatsapp", "celular"]);
  });

  /**
   * No-op medido por la sesion principal: las fuentes de hoy traen los mismos 14
   * campos que MAPEO_FORMULARIO y ningun programa ajusta plantilla. Pasar del
   * ternario todo-o-nada a combinar campo por campo NO cambia el mapeo efectivo.
   */
  describe("no-op para las fuentes de hoy", () => {
    it("fuente con el mapeo completo y sin plantilla da exactamente el mapeo de la fuente", () => {
      const { mapeo } = combinarMapeo(MAPEO_FORMULARIO, null);
      expect(mapeo).toEqual(MAPEO_FORMULARIO);
    });

    it("fuente con mapeo vacio y sin plantilla cae al defecto, igual que el viejo ternario", () => {
      const { mapeo } = combinarMapeo({}, null);
      expect(mapeo).toEqual(MAPEO_FORMULARIO);
    });
  });
});
