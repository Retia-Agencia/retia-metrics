import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["lib", "app", "components", "scripts"];
const MODULOS_DUENOS = new Set([
  "lib/queries/hechos/envio.ts",
  "lib/queries/hechos/fechas.ts",
  "lib/queries/metricas-filtros.ts",
]);

const EXCEPCIONES: Record<string, string> = {
  "lib/atribucion/envios-por-canal.ts": "Consulta heredada de atribución: limita el conteo a envíos completos.",
  "lib/queries/inbox.ts": "La bandeja operativa distingue envíos parciales y completos y su antigüedad.",
  "lib/queries/kanban.ts": "La fecha de entrada del deal a su etapa actual (coalesce con deals.created_at), no el ancla del lead.",
  "lib/queries/salud-fuentes.ts": "Salud de fuentes mide por separado los envíos completos.",
  "lib/queries/traza-por-anuncio.ts": "La traza histórica cuenta únicamente envíos completos.",
};

export function infraccionesDeLeadYRegistro(fuente: string, ruta: string): string[] {
  if (MODULOS_DUENOS.has(ruta) || ruta.startsWith("lib/ingesta/")) return [];
  const codigo = sinComentarios(fuente);
  const infracciones: string[] = [];
  if (/\bcoalesce\s*\([^)]{0,500}(?:fecha_?envio|created_?at|primeraAplicacion)/i.test(codigo)) {
    infracciones.push("ancla de fecha del lead escrita a mano");
  }
  if (/\.where\s*\([^;]{0,1200}?(?:eq|gte|lte|between|isNull)\s*\(\s*submissions\.(?:esParcial|fechaEnvio)\b/.test(codigo)) {
    infracciones.push("universo de registros escrito a mano");
  }
  return infracciones;
}

describe("guardián N1: lead y registro se deciden en sus módulos", () => {
  it("nadie vuelve a escribir el ancla del lead ni el universo de registros", () => {
    const encontradas = CARPETAS.flatMap((carpeta) => archivos(join(RAIZ, carpeta)))
      .map((archivo) => {
        const ruta = relative(RAIZ, archivo);
        return { ruta, infracciones: infraccionesDeLeadYRegistro(readFileSync(archivo, "utf8"), ruta) };
      })
      .filter(({ infracciones }) => infracciones.length > 0);

    for (const [ruta, razon] of Object.entries(EXCEPCIONES)) {
      expect(encontradas.find((hallazgo) => hallazgo.ruta === ruta), razon).toBeDefined();
    }
    expect(encontradas.filter(({ ruta }) => !(ruta in EXCEPCIONES)))
      .toEqual([]);
  });

  it("muerde ambos patrones prohibidos y permite los conceptos nombrados", () => {
    expect(infraccionesDeLeadYRegistro(
      "const fecha = coalesce(fecha_envio, created_at, primeraAplicacion)",
      "lib/x.ts",
    )).toContain("ancla de fecha del lead escrita a mano");
    expect(infraccionesDeLeadYRegistro(
      ".where(and(eq(submissions.esParcial, false), gte(submissions.fechaEnvio, desde)))",
      "lib/x.ts",
    )).toContain("universo de registros escrito a mano");
    expect(infraccionesDeLeadYRegistro(
      "const fecha = fechaAnclaLead(lead); consulta.where(filtroDeEnvios(opciones))",
      "lib/x.ts",
    )).toEqual([]);
    expect(infraccionesDeLeadYRegistro(
      ".where(eq(submissions.esParcial, false))",
      "lib/queries/hechos/envio.ts",
    )).toEqual([]);
  });
});
