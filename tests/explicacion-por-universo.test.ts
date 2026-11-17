import { describe, expect, it } from "vitest";
import { explicacionDe } from "@/lib/metricas/explicacion";
import { fichaDe } from "@/lib/metricas/registro";

const CLAVES = ["agendadas", "cierre_de_ventas", "ventas", "vendido"] as const;
const AMBITO = "vengan de pauta, orgánico, referidos o sin origen";
const texto = (e: ReturnType<typeof explicacionDe>) => JSON.stringify([e.que, e.formula, e.variables]).replace(AMBITO, "");

describe("la ficha dice «de pauta» solo cuando la vista es de pauta", () => {
  it.each(CLAVES)("%s: en todas las áreas no menciona pauta", (clave) => {
    expect(texto(explicacionDe(clave, { universo: "todas" }))).not.toMatch(/pauta|anuncio/i);
  });

  it.each(["agendadas", "cierre_de_ventas", "ventas"] as const)("%s: en Pauta conserva su ficha", (clave) => {
    expect(explicacionDe(clave).que).toBe(fichaDe(clave).que);
    expect(explicacionDe(clave).que).toMatch(/pauta|anuncio/i);
  });

  it("vendido en Pauta conserva su fórmula", () => {
    expect(explicacionDe("vendido").formula).toEqual(fichaDe("vendido").formula);
  });

  it("una variante explícita manda sobre la frase neutra", () => {
    expect(explicacionDe("ventas", { universo: "todas", que: "x" }).que).toBe("x");
  });
});
