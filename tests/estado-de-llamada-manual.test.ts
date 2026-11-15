import { describe, expect, it } from "vitest";
import { esCitaManual, etiquetaDelEnlace } from "@/lib/deals/estado-de-llamada";

describe("citas manuales", () => {
  it.each([
    ["calendly", false],
    ["crm", true],
    ["sheets", true],
    ["otro", true],
  ])("reconoce el origen %s", (origen, esperado) => {
    expect(esCitaManual(origen)).toBe(esperado);
  });
});

describe("etiqueta del enlace de la llamada", () => {
  it.each([
    ["https://calendly.com/retia/llamada", "Link de Calendly"],
    ["https://meet.google.com/abc-defg-hij", "Link de Meet"],
    ["https://us02web.zoom.us/j/123", "Link de Zoom"],
    ["https://reuniones.example.com/sala", "Link de la reunión"],
    [null, "Link de la reunión"],
    ["esto no es una URL", "Link de la reunión"],
  ])("describe %s", (url, esperado) => {
    expect(etiquetaDelEnlace(url)).toBe(esperado);
  });
});
