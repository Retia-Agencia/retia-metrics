import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const ENLACE = join("components", "enlace.tsx");
const IMPORTA_NEXT_LINK = /from\s+["']next\/link["']/;

function recorrer(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) =>
    entrada.isDirectory() ? recorrer(join(dir, entrada.name)) : [join(dir, entrada.name)],
  );
}

function fuentesConNextLink(fuentes: ReadonlyArray<{ ruta: string; fuente: string }>): string[] {
  return fuentes.filter(({ fuente }) => IMPORTA_NEXT_LINK.test(fuente)).map(({ ruta }) => ruta);
}

describe("guardian de Enlace", () => {
  it("solo components/enlace.tsx importa next/link", () => {
    const archivos = [
      ...recorrer(join(RAIZ, "app")).filter((ruta) => /\.tsx?$/.test(ruta)),
      ...recorrer(join(RAIZ, "components")).filter((ruta) => /\.tsx?$/.test(ruta)),
      ...recorrer(join(RAIZ, "lib")).filter((ruta) => ruta.endsWith(".tsx")),
    ]
      .map((ruta) => relative(RAIZ, ruta))
      .filter((ruta) => ruta !== ENLACE)
      .map((ruta) => ({ ruta, fuente: readFileSync(join(RAIZ, ruta), "utf8") }));

    expect(fuentesConNextLink(archivos)).toEqual([]);
  });

  it("muerde: detecta una fuente mala y deja pasar una limpia", () => {
    expect(fuentesConNextLink([{ ruta: "malo.tsx", fuente: 'import Link from "next/link";' }])).toEqual([
      "malo.tsx",
    ]);
    expect(fuentesConNextLink([{ ruta: "limpio.tsx", fuente: 'import { Enlace } from "@/components/enlace";' }])).toEqual([]);
  });
});
