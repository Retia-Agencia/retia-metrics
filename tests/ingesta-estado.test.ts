import { describe, expect, it } from "vitest";
import { estadoDesdeTexto } from "@/lib/ingesta/estado";

/**
 * `estadoDesdeTexto` (ticket 051, reescrito en el 117): LIMPIA el texto del Estado, no lo
 * califica ni lo valida. El valor del formulario se guarda tal cual (recortado) y la
 * etiqueta exacta de la hoja se traduce a su valor. Desde el ADR 0069 el valor ya no decide
 * nada: la etapa de entrada sale de la agenda y la calidad (`etapa-de-entrada.ts`).
 */
describe("estadoDesdeTexto", () => {
  it.each([
    // El valor del formulario tal cual (webhook), el de hoy o uno nuevo.
    ["descartado", "descartado"],
    ["setteo_no_calificado", "setteo_no_calificado"],
    ["con_calendly", "con_calendly"],
    ["con_calendly_sin_agenda", "con_calendly_sin_agenda"],
    ["un_valor_nuevo", "un_valor_nuevo"],
    // La etiqueta exacta de la hoja (traslado desde Sheets).
    ["🗑️ Descartado", "descartado"],
    ["📞 Setteo No Calificado", "setteo_no_calificado"],
    ["📅 Con Calendly", "con_calendly"],
    ["📅 Con Calendly (Juanito)", "con_calendly"],
    // Con blancos alrededor: solo trim, nada mas.
    ["  con_calendly  ", "con_calendly"],
    ["  🗑️ Descartado ", "descartado"],
    // Nada de emparejamiento difuso: un texto que no es etiqueta exacta se guarda como llego.
    ["📅 con calendly", "📅 con calendly"],
    ["CON_CALENDLY", "CON_CALENDLY"],
  ])("guarda %j como %j", (crudo, valor) => {
    expect(estadoDesdeTexto(crudo)).toEqual({ calificacion: valor });
  });

  it("un vacio, un nulo o solo blancos es 'sin estado'", () => {
    expect(estadoDesdeTexto("")).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto("   ")).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto(null)).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto(undefined)).toEqual({ calificacion: null, motivo: "sin estado" });
  });
});
