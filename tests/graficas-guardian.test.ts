import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..");
const DIRECTORIOS = ["app", "components", "lib"];
const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".jsx"]);

function archivos(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return archivos(completo);
    return EXTENSIONES.has(path.extname(entrada.name)) ? [completo] : [];
  });
}

function importsDirectosDeEcharts(raiz: string): string[] {
  const hallazgos: string[] = [];
  const patron = /(?:from\s*|import\s*\(|require\s*\()["']echarts(?:\/[^"']*)?["']/g;
  for (const directorio of DIRECTORIOS) {
    for (const archivo of archivos(path.join(raiz, directorio))) {
      const relativo = path.relative(raiz, archivo);
      if (relativo.startsWith(`components${path.sep}graficas${path.sep}`)) continue;
      const fuente = fs.readFileSync(archivo, "utf8");
      for (const coincidencia of fuente.matchAll(patron)) {
        const linea = fuente.slice(0, coincidencia.index).split("\n").length;
        hallazgos.push(`${relativo}:${linea}`);
      }
    }
  }
  return hallazgos.sort();
}

describe("el límite de ECharts (ADR 0091)", () => {
  it("ninguna pantalla ni módulo de negocio importa ECharts directo", () => {
    expect(importsDirectosDeEcharts(RAIZ)).toEqual([]);
  });

  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "graficas-guardian-"));
  afterAll(() => fs.rmSync(temporal, { recursive: true, force: true }));

  it("caza un import clandestino y permite el envoltorio", () => {
    fs.mkdirSync(path.join(temporal, "components", "graficas"), { recursive: true });
    fs.mkdirSync(path.join(temporal, "components", "dashboard"), { recursive: true });
    fs.writeFileSync(path.join(temporal, "components", "dashboard", "sucia.tsx"), 'import { init } from "echarts/core";\n');
    fs.writeFileSync(path.join(temporal, "components", "graficas", "lienzo.tsx"), 'import { init } from "echarts/core";\n');
    expect(importsDirectosDeEcharts(temporal)).toEqual([path.join("components", "dashboard", "sucia.tsx:1")]);
  });
});
