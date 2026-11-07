import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["lib", "app", "components", "scripts"];
const MODULO_DE_CALENDARIO = "lib/dias-habiles.ts";
const PATRON = new RegExp("getUTC" + "Day\\s*\\(|function\\s+(?:sumarDias|lunesDe)\\s*\\(");

function archivosDeCodigo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosDeCodigo(ruta);
    return /\.[cm]?[jt]sx?$/.test(entrada.name) ? [ruta] : [];
  });
}

export function contieneMatematicaDeCalendario(fuente: string): boolean {
  return PATRON.test(fuente);
}

describe("guardian: la aritmetica de calendario vive en un solo modulo", () => {
  it("no permite getUTCDay ni helpers duplicados fuera del modulo", () => {
    const infracciones = CARPETAS.flatMap((carpeta) => archivosDeCodigo(join(RAIZ, carpeta)))
      .filter((archivo) => relative(RAIZ, archivo) !== MODULO_DE_CALENDARIO)
      .filter((archivo) => contieneMatematicaDeCalendario(readFileSync(archivo, "utf8")))
      .map((archivo) => relative(RAIZ, archivo));

    expect(infracciones).toEqual([]);
  });

  it("muerde los patrones prohibidos y permite usar los helpers", () => {
    expect(contieneMatematicaDeCalendario("fecha.getUTC" + "Day()")).toBe(true);
    expect(contieneMatematicaDeCalendario("function " + "sumarDias(fecha, dias) {}")).toBe(true);
    expect(contieneMatematicaDeCalendario("function " + "lunesDe(fecha) {}")).toBe(true);
    expect(contieneMatematicaDeCalendario("sumarDias(fecha, 1); lunesDe(fecha)")).toBe(false);
  });
});
