import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { estadoDesdeTexto } from "@/lib/ingesta/estado";

/**
 * `estadoDesdeTexto` (ticket 051): TRADUCE el texto del Estado al valor del enum, no lo
 * calcula. Acepta el valor del codigo tal cual (lo del webhook) y la etiqueta exacta de
 * la hoja (lo del traslado). Todo lo demas es `null` con motivo, sin adivinar.
 */
describe("estadoDesdeTexto", () => {
  it.each([
    // El valor del codigo tal cual (webhook, ticket 106).
    ["descartado", "descartado"],
    ["setteo_no_calificado", "setteo_no_calificado"],
    ["con_calendly", "con_calendly"],
    // La etiqueta exacta de la hoja (traslado desde Sheets).
    ["🗑️ Descartado", "descartado"],
    ["📞 Setteo No Calificado", "setteo_no_calificado"],
    ["📅 Con Calendly", "con_calendly"],
    ["📅 Con Calendly (Juanito)", "con_calendly"],
    // Con blancos alrededor: solo trim, nada mas.
    ["  con_calendly  ", "con_calendly"],
    ["  🗑️ Descartado ", "descartado"],
  ])("traduce %j a %s", (crudo, valor) => {
    expect(estadoDesdeTexto(crudo)).toEqual({ calificacion: valor });
  });

  it("un vacio, un nulo o solo blancos es 'sin estado', no un error de texto ajeno", () => {
    expect(estadoDesdeTexto("")).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto("   ")).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto(null)).toEqual({ calificacion: null, motivo: "sin estado" });
    expect(estadoDesdeTexto(undefined)).toEqual({ calificacion: null, motivo: "sin estado" });
  });

  it.each([
    "con calendly!",
    "Descartado", // sin emoji: no es la etiqueta exacta ni el valor del codigo
    "CON_CALENDLY", // mayusculas: no se baja a minusculas, no se adivina
    "setteo",
    "📅 con calendly",
  ])("no adivina: %j queda sin reconocer con su motivo", (crudo) => {
    expect(estadoDesdeTexto(crudo)).toEqual({
      calificacion: null,
      motivo: `estado no reconocido: ${crudo.trim()}`,
    });
  });
});

/**
 * La ingesta ya NO califica (ADR 0054, enmienda): guarda el Estado del formulario. Si
 * `ingerirEntradas` volviera a llamar a `calificarEnvio`, el CRM estaria calculando de
 * nuevo sin que nada fallara. Igual que los otros guardianes del repo, un `grep` lo caza.
 */
describe("ingerir.ts no llama a calificarEnvio", () => {
  it("no hay ni una referencia a calificarEnvio en la ingesta", () => {
    const ruta = fileURLToPath(new URL("../lib/ingesta/ingerir.ts", import.meta.url));
    const fuente = fs.readFileSync(ruta, "utf8");
    expect(fuente).not.toContain("calificarEnvio");
  });
});
