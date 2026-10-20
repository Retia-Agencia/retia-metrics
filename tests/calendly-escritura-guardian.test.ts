import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const PERMITIDOS = new Set(["lib/calendly/escritura.ts", "lib/calendly/suscripcion.ts"]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (nombre === "node_modules" || nombre === ".next" || nombre === ".git") return [];
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe("guardián de escrituras de Calendly", () => {
  it("encierra todo fetch no-GET a api.calendly.com en los dos módulos autorizados", () => {
    const infracciones = archivos(RAIZ).flatMap((ruta) => {
      const rel = relative(RAIZ, ruta);
      if (PERMITIDOS.has(rel) || !/\.(ts|tsx)$/.test(rel)) return [];
      const texto = readFileSync(ruta, "utf8");
      const tieneApi = /api\.calendly\.com/.test(texto);
      const tieneEscritura = /method\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/.test(texto);
      const fetchConEscritura = /fetch[\s\S]{0,500}method\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/.test(texto);
      return tieneApi && tieneEscritura && fetchConEscritura ? [rel] : [];
    });
    expect(infracciones).toEqual([]);
  });
});
