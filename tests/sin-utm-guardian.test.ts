import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["lib", "app", "components", "scripts"];

const EXCEPCIONES: Record<string, string> = {
  "app/(app)/p/[programa]/hub/lista/page.tsx": "Presenta la categoría ya calculada en la lista del Hub.",
  "components/dashboard/origen.tsx": "Proyecta la categoría ya calculada a la visualización de origen.",
  "components/deals/inbox-perdidos-en-calendly.tsx": "Deuda real: infiere Sin UTM desde tres campos nulos para mostrarlo.",
  "components/deals/inbox-sin-dueno.tsx": "Deuda real: infiere Sin UTM desde tres campos nulos para mostrarlo.",
  "components/embudo-formulario.tsx": "Presenta la categoría ya calculada del embudo.",
  "lib/hub/csv-historia.ts": "Traduce a texto la regla ya devuelta por resolverCanal, igual que la ficha del lead.",
  "lib/queries/embudo-formulario.ts": "Agrupa y ordena usando la categoría devuelta por resolverCanal.",
  "lib/queries/ficha-lead.ts": "Traduce a texto la regla ya devuelta por resolverCanal.",
  "lib/queries/origen.ts": "Agrega filas usando la categoría centralizada que recibe del módulo de atribución.",
  "lib/queries/traza-por-anuncio.ts": "Cuenta la regla ya devuelta por resolverCanal.",
};

export function infraccionesDeSinUtm(fuente: string, ruta: string): string[] {
  if (ruta.startsWith("lib/atribucion/")) return [];
  const codigo = sinComentarios(fuente);
  const infracciones: string[] = [];
  const fuenteNulaOVacia = [
    /\butmSource\b\s*(?:={2,3}|!={1,2})\s*(?:null|["']\s*["'])/i,
    /(?:null|["']\s*["'])\s*(?:={2,3}|!={1,2})\s*\butmSource\b/i,
    /\butm_source\b\s*(?:is\s+(?:not\s+)?null|={1,3}\s*["']\s*["'])/i,
  ];
  if (fuenteNulaOVacia.some((patron) => patron.test(codigo))) {
    infracciones.push("clasificación desde utm_source nulo o vacío");
  }
  const literalDecisorio = [
    /\bcase\s+["']sin_utm["']/,
    /(?:={2,3}|!={1,2})\s*["']sin_utm["']/,
    /["']sin_utm["']\s*(?:={2,3}|!={1,2})/,
  ];
  if (literalDecisorio.some((patron) => patron.test(codigo))) {
    infracciones.push("literal sin_utm usado para decidir");
  }
  return infracciones;
}

describe("guardián N1: la categoría UTM se decide en un solo módulo", () => {
  it("nadie fuera de atribución vuelve a clasificar con campos o literales", () => {
    const encontradas = CARPETAS.flatMap((carpeta) => archivos(join(RAIZ, carpeta)))
      .map((archivo) => {
        const ruta = relative(RAIZ, archivo);
        return { ruta, infracciones: infraccionesDeSinUtm(readFileSync(archivo, "utf8"), ruta) };
      })
      .filter(({ infracciones }) => infracciones.length > 0);

    for (const [ruta, razon] of Object.entries(EXCEPCIONES)) {
      expect(encontradas.find((hallazgo) => hallazgo.ruta === ruta), razon).toBeDefined();
    }
    expect(encontradas.filter(({ ruta }) => !(ruta in EXCEPCIONES)))
      .toEqual([]);
  });

  it("muerde los dos modos de reclasificar y permite los helpers nombrados", () => {
    expect(infraccionesDeSinUtm(
      "if (utmSource === null && utmMedium === null) return 'Sin UTM'",
      "components/x.tsx",
    )).toContain("clasificación desde utm_source nulo o vacío");
    expect(infraccionesDeSinUtm(
      "const grupo = categoria === 'sin_utm' ? vacio : completo",
      "lib/x.ts",
    )).toContain("literal sin_utm usado para decidir");
    expect(infraccionesDeSinUtm(
      "const categoria = categoriaDeUtm(dimensiones); const sql = categoriaUtmSql()",
      "lib/x.ts",
    )).toEqual([]);
    expect(infraccionesDeSinUtm(
      "return source === null ? 'sin_utm' : 'con_utm'",
      "lib/atribucion/canal.ts",
    )).toEqual([]);
  });
});
