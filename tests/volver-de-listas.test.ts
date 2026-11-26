import { describe, expect, it } from "vitest";
import { urlDeLista } from "@/lib/queries/vista-metrica";

describe("toda lista nace con su vuelta", () => {
  it("urlDeLista conserva el origen codificado, sin fragmento crudo", () => {
    const origen = "/p/programa-a/hub?seccion=comercial&rango=semana#equipo";
    const href = urlDeLista({
      slug: "programa-a",
      metrica: "cierres",
      periodo: { preset: "custom", a: { desde: "2026-10-19", hasta: "2026-10-23" }, b: null },
      origen,
    });
    expect(href).toContain(`desde=${encodeURIComponent(origen)}`);
    expect(href).not.toContain("#");
  });

  it("un origen externo no produce desde", () => {
    const href = urlDeLista({
      slug: "programa-a",
      metrica: "cierres",
      periodo: { preset: "custom", a: { desde: "2026-10-19", hasta: "2026-10-23" }, b: null },
      origen: "https://x",
    });
    expect(new URL(href, "https://retia.test").searchParams.has("desde")).toBe(false);
  });
});
