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
 * La ingesta NO calcula el Estado desde las respuestas (ADR 0054, enmienda del 28-sep):
 * guarda el que manda el formulario. El calculo (`calificarEnvio` y su configuracion por
 * fuente) se retiro ese dia. Este guardian falla si vuelve a aparecer en `lib/ingesta/`:
 * igual que los otros guardianes del repo, un `grep` sobre el codigo lo caza. Si un dia
 * el Estado lo calcula el CRM por programa (decision A8), este test se reescribe entonces.
 */
describe("nada en lib/ingesta calcula el Estado desde las respuestas", () => {
  it("no hay ni una referencia a calificarEnvio en lib/ingesta", () => {
    const dir = fileURLToPath(new URL("../lib/ingesta/", import.meta.url));
    const archivos = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".ts"))
      .map((n) => fs.readFileSync(fileURLToPath(new URL(`../lib/ingesta/${n}`, import.meta.url)), "utf8"));
    expect(archivos.some((fuente) => fuente.includes("calificarEnvio"))).toBe(false);
  });
});
