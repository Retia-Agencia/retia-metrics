import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ARCHIVO_API = "lib/form30x/api.ts";
const NOMBRES_PRIVADOS = /FORM_30X_API_KEY|form\.30x\.com\/api/;
const ESCRITURA = /["'`](?:PATCH|PUT|POST|DELETE)["'`]|method\s*:\s*(?!["'`]GET["'`])/;

/** Devuelve las reglas privadas o de solo lectura que viola un archivo. */
export function detectarViolacionesForm30x(ruta: string, texto: string): string[] {
  const normalizada = ruta.replaceAll("\\", "/");
  const violaciones: string[] = [];
  if (!normalizada.endsWith(ARCHIVO_API) && NOMBRES_PRIVADOS.test(texto)) {
    violaciones.push("nombre privado fuera del cliente");
  }
  if (normalizada.endsWith(ARCHIVO_API) && ESCRITURA.test(texto)) {
    violaciones.push("cliente con escritura");
  }
  return violaciones;
}

describe("el guardian de Form30x muerde", () => {
  it.each([
    ["lib/otro.ts", "process.env.FORM_30X_API_KEY", ["nombre privado fuera del cliente"]],
    ["app/otro.ts", "https://form.30x.com/api/v1/forms", ["nombre privado fuera del cliente"]],
    [ARCHIVO_API, 'method: "POST"', ["cliente con escritura"]],
    [ARCHIVO_API, 'method: "GET"', []],
    [ARCHIVO_API, "Authorization: bearer", []],
    ["lib/otro.ts", "form30x", []],
  ])("%s: %s", (ruta, texto, esperadas) => {
    expect(detectarViolacionesForm30x(ruta, texto)).toEqual(esperadas);
  });
});

describe("el cliente de Form30x es uno solo y de solo lectura (ADR 0093)", () => {
  it("no filtra credenciales ni endpoints y no escribe en la API", () => {
    const raices = ["lib", "app", "components", "scripts", ".github"];
    const culpables: Array<{ ruta: string; violaciones: string[] }> = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else {
          const violaciones = detectarViolacionesForm30x(ruta, readFileSync(ruta, "utf8"));
          if (violaciones.length > 0) culpables.push({ ruta, violaciones });
        }
      }
    };
    raices.forEach(recorrer);
    expect(culpables).toEqual([]);
  });
});
