import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ACCIONES } from "@/lib/mcp/acciones";
import {
  ACCIONES_SIN_PAR_EN_LA_APP,
  COBERTURA_MCP,
  TOPE_DE_PENDIENTES_DEL_MCP,
  type CoberturaDeServerAction,
} from "@/lib/mcp/cobertura";
import { consultarMetricaMcp } from "@/lib/mcp/herramientas/metricas";
import { METRICAS_DE_LISTA } from "@/lib/queries/filtros-de-lista";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["app", "components", "lib"] as const;

export function funcionesServerExportadas(texto: string): string[] {
  return [...texto.matchAll(/^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\b)/gm)]
    .map((coincidencia) => coincidencia[1] ?? coincidencia[2]);
}

function archivosDeCodigo(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) return archivosDeCodigo(ruta);
    return /\.(?:ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

function inventarioReal(): string[] {
  return CARPETAS.flatMap((carpeta) => archivosDeCodigo(join(RAIZ, carpeta)))
    .flatMap((ruta) => {
      const texto = readFileSync(ruta, "utf8");
      if (!/^"use server";/.test(texto)) return [];
      const archivo = relative(RAIZ, ruta).split("\\").join("/");
      return funcionesServerExportadas(texto).map((funcion) => `${archivo}#${funcion}`);
    })
    .sort();
}

function auditar(inventario: readonly string[], registro: Readonly<Record<string, CoberturaDeServerAction>>) {
  const registradas = Object.keys(registro);
  return {
    sinClasificar: inventario.filter((clave) => !(clave in registro)).sort(),
    inexistentes: registradas.filter((clave) => !inventario.includes(clave)).sort(),
  };
}

describe("guardián de cobertura del MCP", () => {
  it("clasifica cada server action y no conserva filas inexistentes", () => {
    expect(auditar(inventarioReal(), COBERTURA_MCP)).toEqual({ sinClasificar: [], inexistentes: [] });
  });

  it("está mordido en los dos sentidos con una fuente sintética", () => {
    const texto = '"use server";\nexport async function existente() {}\nexport const nueva = async () => {};\n';
    const inventario = funcionesServerExportadas(texto).map((funcion) => `sintetico.ts#${funcion}`);
    const base = {
      "sintetico.ts#existente": { clase: "lectura", herramienta: null, razon: "Sintética." },
    } satisfies Record<string, CoberturaDeServerAction>;
    expect(auditar(inventario, base)).toEqual({
      sinClasificar: ["sintetico.ts#nueva"],
      inexistentes: [],
    });

    const completa = {
      ...base,
      "sintetico.ts#nueva": { clase: "pendiente", grupo: "operacion", capacidad: "Capacidad sintética." },
    } satisfies Record<string, CoberturaDeServerAction>;
    expect(auditar(inventario, completa)).toEqual({ sinClasificar: [], inexistentes: [] });
    expect(auditar([inventario[0]], completa)).toEqual({
      sinClasificar: [],
      inexistentes: ["sintetico.ts#nueva"],
    });
  });

  it("cada acción del MCP cubre al menos una server action de la app", () => {
    const expuestas = new Set<string>(Object.values(COBERTURA_MCP)
      .filter((fila) => fila.clase === "expuesta")
      .map((fila) => fila.accion));
    const sinPar = Object.keys(ACCIONES_SIN_PAR_EN_LA_APP);
    for (const clave of sinPar) expect(expuestas.has(clave)).toBe(false);
    expect([...expuestas, ...sinPar].sort()).toEqual(ACCIONES.map((accion) => accion.clave).sort());
  });

  it("los pendientes no superan el trinquete", () => {
    const pendientes = Object.values(COBERTURA_MCP).filter((fila) => fila.clase === "pendiente");
    expect(pendientes.length).toBeLessThanOrEqual(TOPE_DE_PENDIENTES_DEL_MCP);
  });

  it("consultar_metrica acepta cada métrica de la lista canónica", () => {
    for (const metrica of METRICAS_DE_LISTA) {
      expect(consultarMetricaMcp.entrada.safeParse({ programa: "programa", metrica, periodo: "hoy" }).success, metrica).toBe(true);
    }
  });

  it("la app y el MCP importan la misma función de permiso de métricas", () => {
    const importacion = /import\s*\{[^}]*\bcapacidadParaMetrica\b[^}]*\}\s*from\s*["']@\/lib\/queries\/metricas-con-filas["']/;
    const pagina = readFileSync(join(RAIZ, "app/(app)/p/[programa]/hub/lista/page.tsx"), "utf8");
    const mcp = readFileSync(join(RAIZ, "lib/mcp/herramientas/metricas.ts"), "utf8");
    expect(pagina).toMatch(importacion);
    expect(mcp).toMatch(importacion);
  });
});
