import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { HERRAMIENTAS } from "@/lib/mcp/herramientas";
import { INSTRUCCIONES_MCP } from "@/lib/mcp/instrucciones";

/**
 * Contrato de mantenimiento del MCP (`docs/mcp.md` §4). Cada regla de ese documento marcada con 🔒
 * se vigila aquí o en `mcp-guardian.test.ts`. Si una herramienta nueva rompe una, falla con su nombre.
 */
const DOC = fs.readFileSync(fileURLToPath(new URL("../docs/mcp.md", import.meta.url)), "utf8");
const FORMATO_DE_NOMBRE = /^[a-z][a-z0-9_]{0,63}$/;

type Esquema = { type?: string; maxLength?: number; pattern?: string; enum?: unknown[]; properties?: Record<string, Esquema>; items?: Esquema; anyOf?: Esquema[] };

/** Las rutas de cada cadena libre (sin enum) y su tope, recorriendo el JSON Schema de la entrada. */
function cadenasLibres(esquema: Esquema, ruta = ""): { ruta: string; acotada: boolean }[] {
  if (esquema.anyOf) return esquema.anyOf.flatMap((parte) => cadenasLibres(parte, ruta));
  if (esquema.type === "string" && !esquema.enum) {
    // Acotada por un tope o por un formato de largo fijo (fecha, hex, uuid); `*`, `+` y `{n,}` no acotan.
    const porPatron = esquema.pattern !== undefined && !/[*+]|\{\d+,\}/.test(esquema.pattern);
    return [{ ruta, acotada: esquema.maxLength !== undefined || porPatron }];
  }
  if (esquema.type === "array" && esquema.items) return cadenasLibres(esquema.items, `${ruta}[]`);
  return Object.entries(esquema.properties ?? {}).flatMap(([clave, hijo]) =>
    cadenasLibres(hijo, ruta ? `${ruta}.${clave}` : clave));
}

/**
 * Deuda nombrada (ticket 385/386): cadenas que aún no tienen tope porque su esquema se comparte con una pantalla.
 * Lista congelada: no crece, y una que ya tenga tope sale de aquí (si sobra, el test falla).
 */
const SIN_TOPE_AUN: Record<string, string[]> = {};

describe("contrato de herramientas del MCP", () => {
  it("nombres en snake_case ASCII, únicos, con título y descripción orientada al uso", () => {
    const nombres = HERRAMIENTAS.map((herramienta) => herramienta.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const herramienta of HERRAMIENTAS) {
      expect(herramienta.nombre, herramienta.nombre).toMatch(FORMATO_DE_NOMBRE);
      expect(herramienta.titulo.trim().length, `${herramienta.nombre}: título`).toBeGreaterThan(3);
      expect(herramienta.descripcion.trim().length, `${herramienta.nombre}: descripción`).toBeGreaterThan(40);
      expect(herramienta.descripcion, `${herramienta.nombre}: cuándo usarla`).toMatch(/^Úsala cuando/);
    }
  });

  it("las siete herramientas migradas publican salida y las demás esperan la fase B2", () => {
    const conSalida = HERRAMIENTAS.filter((herramienta) => herramienta.salida !== undefined)
      .map((herramienta) => herramienta.nombre);
    expect(conSalida).toEqual([
      "programas_visibles",
      "resumen_del_hub",
      "consultar_metrica",
      "buscar_leads",
      "cartera_vencida",
      "pauta_roas",
      "origen_del_programa",
    ]);
  });

  it("toda herramienta está en las instrucciones del servidor y en la tabla de docs/mcp.md", () => {
    for (const herramienta of HERRAMIENTAS) {
      expect(INSTRUCCIONES_MCP, `${herramienta.nombre}: falta en INSTRUCCIONES_MCP`).toContain(herramienta.nombre);
      expect(DOC, `${herramienta.nombre}: falta en docs/mcp.md`).toContain(`\`${herramienta.nombre}\``);
    }
  });

  it("las instrucciones no nombran herramientas que no existen", () => {
    const nombres = new Set(HERRAMIENTAS.map((herramienta) => herramienta.nombre));
    const citadas = INSTRUCCIONES_MCP.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? [];
    for (const nombre of citadas) expect(nombres.has(nombre), `instrucciones citan ${nombre}`).toBe(true);
  });

  it("toda cadena libre de la entrada tiene tope de longitud, salvo la deuda nombrada", () => {
    const sinTope: Record<string, string[]> = {};
    for (const herramienta of HERRAMIENTAS) {
      const esquema = z.toJSONSchema(herramienta.entrada, { io: "input", unrepresentable: "any" }) as Esquema;
      const faltan = cadenasLibres(esquema).filter((cadena) => !cadena.acotada).map((cadena) => cadena.ruta);
      if (faltan.length) sinTope[herramienta.nombre] = faltan.sort();
    }
    expect(sinTope).toEqual(SIN_TOPE_AUN);
  });
});
