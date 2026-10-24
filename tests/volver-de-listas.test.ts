import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { urlDeLista } from "@/lib/queries/vista-metrica";

const ARMA_UNA_LISTA = /hub\/lista\?|["'`]\/hub\/lista["'`]\s*\+\s*["'`]\?/;
const MODULOS_PERMITIDOS = new Set([
  "lib/queries/vista-metrica.ts",
  "lib/queries/vista-todos.ts",
]);

function esPermitido(ruta: string): boolean {
  return MODULOS_PERMITIDOS.has(ruta.replaceAll("\\", "/"));
}

describe("el guardián de las listas muerde", () => {
  it.each([
    ["`/p/${slug}/hub/lista?${q}`", true],
    ['"/hub/lista" + "?metrica=caja"', true],
    ['urlDeLista({ slug, metrica: "caja" })', false],
  ])("%s → %s", (codigo, caza) => {
    expect(ARMA_UNA_LISTA.test(codigo)).toBe(caza);
  });

  it("excluye exactamente los dos constructores autorizados", () => {
    expect(esPermitido("lib/queries/vista-metrica.ts")).toBe(true);
    expect(esPermitido("lib/queries/vista-todos.ts")).toBe(true);
    expect(esPermitido("components/dashboard/origen.tsx")).toBe(false);
  });
});

describe("toda lista nace con su vuelta", () => {
  it("nadie fuera de los dos constructores arma un href a hub/lista", () => {
    const culpables: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.tsx?$/.test(nombre) && !esPermitido(ruta) && ARMA_UNA_LISTA.test(readFileSync(ruta, "utf8"))) culpables.push(ruta);
      }
    };
    for (const raiz of ["lib", "app", "components"]) recorrer(raiz);
    expect(culpables).toEqual([]);
  });

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
