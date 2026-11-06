import { readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Toda pantalla dinámica tiene un estado de carga (ticket de rendimiento, docs/structure.md §9): una ruta
 * dinámica sin `loading.tsx` no se precarga y cada clic deja la pantalla congelada hasta que el servidor
 * termina. Cada `page.tsx` debe quedar cubierto por un `loading.tsx` en su carpeta o en un ancestro.
 */
const RAIZ = join(process.cwd(), "app");

/** Excepciones nombradas: páginas fuera del shell de la app que no cargan datos (redirect y login). */
export const SIN_LOADING = new Set(["page.tsx", join("login", "page.tsx")]);

function recorrer(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? recorrer(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Páginas (relativas a `app/`) sin `loading.tsx` propio ni en un ancestro, descontadas las excepciones. */
export function paginasSinLoading(archivos: string[], excepciones: Set<string> = SIN_LOADING): string[] {
  const loadings = new Set(archivos.filter((a) => a.endsWith("loading.tsx")).map((a) => dirname(a)));
  return archivos
    .filter((a) => a.endsWith(`${sep}page.tsx`) || a === "page.tsx")
    .filter((a) => !excepciones.has(a))
    .filter((a) => {
      for (let d = dirname(a); ; d = dirname(d)) {
        if (loadings.has(d)) return false;
        if (d === ".") return true;
      }
    });
}

describe("guardián de loading.tsx", () => {
  it("toda página de app/ está cubierta por un loading.tsx", () => {
    const archivos = recorrer(RAIZ).map((a) => relative(RAIZ, a));
    expect(paginasSinLoading(archivos)).toEqual([]);
  });

  it("muerde: caza una página sin loading y deja pasar la cubierta por un ancestro", () => {
    const base = [join("(app)", "loading.tsx"), join("(app)", "hub", "page.tsx")];
    expect(paginasSinLoading(base)).toEqual([]);
    expect(paginasSinLoading([join("(app)", "hub", "page.tsx")])).toEqual([join("(app)", "hub", "page.tsx")]);
    // un loading en una rama hermana no cubre
    expect(
      paginasSinLoading([join("(app)", "a", "loading.tsx"), join("(app)", "b", "page.tsx")]),
    ).toEqual([join("(app)", "b", "page.tsx")]);
    // las excepciones nombradas pasan
    expect(paginasSinLoading(["page.tsx", join("login", "page.tsx")])).toEqual([]);
  });
});
