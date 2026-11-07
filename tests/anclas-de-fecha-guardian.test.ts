import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["lib", "app", "components", "scripts"];
const MODULO_DE_ANCLAS = "lib/queries/hechos/fechas.ts";
const PATRON = new RegExp("AT TIME" + "\\s+ZONE\\s+['\"]America/Bogota['\"]", "i");

function archivosDeCodigo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosDeCodigo(ruta);
    return /\.[cm]?[jt]sx?$/.test(entrada.name) ? [ruta] : [];
  });
}

export function contieneAnclaAdHoc(fuente: string): boolean {
  return PATRON.test(fuente);
}

describe("guardian: los días de negocio tienen un ancla nombrada", () => {
  it("no permite conversiones de Bogotá fuera del módulo de fechas", () => {
    const infracciones = CARPETAS.flatMap((carpeta) => archivosDeCodigo(join(RAIZ, carpeta)))
      .filter((archivo) => relative(RAIZ, archivo) !== MODULO_DE_ANCLAS)
      .filter((archivo) => contieneAnclaAdHoc(readFileSync(archivo, "utf8")))
      .map((archivo) => relative(RAIZ, archivo));

    expect(infracciones).toEqual([]);
  });

  it("muerde el patrón prohibido y permite el helper nombrado", () => {
    expect(contieneAnclaAdHoc("fecha AT TIME" + " ZONE 'America/Bogota'")).toBe(true);
    expect(contieneAnclaAdHoc("diaEnBogota(fecha)")).toBe(false);
  });
});
