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
});
