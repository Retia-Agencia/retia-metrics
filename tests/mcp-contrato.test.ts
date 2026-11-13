import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { HERRAMIENTAS } from "@/lib/mcp/herramientas";
import { INSTRUCCIONES_MCP } from "@/lib/mcp/instrucciones";
import { IDENTIFICADORES_MCP } from "@/lib/mcp/vocabulario";

/**
 * Contrato de mantenimiento del MCP (`docs/mcp.md` §4). Cada regla de ese documento marcada con 🔒
 * se vigila aquí o en `mcp-guardian.test.ts`. Si una herramienta nueva rompe una, falla con su nombre.
 */
const DOC = fs.readFileSync(fileURLToPath(new URL("../docs/mcp.md", import.meta.url)), "utf8");
const FORMATO_DE_NOMBRE = /^[a-z][a-z0-9_]{0,63}$/;

type Esquema = { type?: string; description?: string; maxLength?: number; pattern?: string; enum?: unknown[]; properties?: Record<string, Esquema>; items?: Esquema; anyOf?: Esquema[] };

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

  it("todas las herramientas publican salida", () => {
    const conSalida = HERRAMIENTAS.filter((herramienta) => herramienta.salida !== undefined)
      .map((herramienta) => herramienta.nombre);
    expect(conSalida).toEqual([
      "programas_visibles",
      "capacidades",
      "resumen_del_hub",
      "consultar_metrica",
      "consultar_hechos",
      "buscar",
      "buscar_leads",
      "ficha_de_lead",
      "ficha_de_deal",
      "tablero_de_deals",
      "opciones_de_filtros",
      "bandeja",
      "cartera_vencida",
      "pauta_roas",
      "origen_del_programa",
      "preparar_accion",
      "confirmar_cambio",
    ]);
  });

  it("usa un vocabulario único para identificadores de entrada y salida", () => {
    const canonicas = new Set<string>(IDENTIFICADORES_MCP);
    // Un `id` suelto es el id del objeto que lo contiene (`dueno.id`, `cohorte.id`): el padre ya nombra el concepto.
    // Lo que el guardián caza es una clave `id_*` fuera del vocabulario, y una entrada canónica que ninguna salida devuelve (L3).
    function identificadores(esquema: Esquema, ruta = ""): string[] {
      const propios = Object.entries(esquema.properties ?? {}).flatMap(([clave, hijo]) => {
        const actual = ruta ? `${ruta}.${clave}` : clave;
        return [...(clave === "id" || clave.startsWith("id_") ? [actual] : []), ...identificadores(hijo, actual)];
      });
      return [...propios, ...(esquema.items ? identificadores(esquema.items, `${ruta}[]`) : []), ...(esquema.anyOf ?? []).flatMap((parte) => identificadores(parte, ruta))];
    }
    const salidas = new Set<string>();
    const fueraDelVocabulario: string[] = [];
    for (const herramienta of HERRAMIENTAS) {
      for (const lado of ["entrada", "salida"] as const) {
        const esquema = z.toJSONSchema(herramienta[lado], { io: lado === "entrada" ? "input" : "output", unrepresentable: "any" }) as Esquema;
        for (const ruta of identificadores(esquema, lado)) {
          const clave = ruta.split(".").at(-1)!.replace("[]", "");
          if (clave !== "id" && !canonicas.has(clave)) fueraDelVocabulario.push(`${herramienta.nombre}:${ruta}`);
          if (lado === "salida") salidas.add(clave);
        }
      }
    }
    expect(fueraDelVocabulario).toEqual([]);
    for (const herramienta of HERRAMIENTAS) {
      const esquema = z.toJSONSchema(herramienta.entrada, { io: "input", unrepresentable: "any" }) as Esquema;
      for (const ruta of identificadores(esquema, "entrada")) {
        const clave = ruta.split(".").at(-1)!;
        if (canonicas.has(clave)) expect(salidas.has(clave), `${herramienta.nombre}:${clave} no aparece en ninguna salida`).toBe(true);
      }
    }

    const sintetico = (clave: string) => ({ type: "object", properties: { [clave]: { type: "string" } } } as Esquema);
    expect(identificadores(sintetico("id_de_lead"))).toEqual(["id_de_lead"]);
    expect(canonicas.has("id_de_lead")).toBe(false);
    expect(canonicas.has(identificadores(sintetico("id_de_la_persona"))[0])).toBe(true);
  });

  it("cada campo de cada salida explica su significado", () => {
    function sinDescripcion(esquema: Esquema, ruta = ""): string[] {
      const propias = Object.entries(esquema.properties ?? {}).flatMap(([clave, hijo]) => {
        const actual = ruta ? `${ruta}.${clave}` : clave;
        return [
          ...(hijo.description?.trim() ? [] : [actual]),
          ...sinDescripcion(hijo, actual),
        ];
      });
      const items = esquema.items ? sinDescripcion(esquema.items, `${ruta}[]`) : [];
      const variantes = (esquema.anyOf ?? []).flatMap((parte) => sinDescripcion(parte, ruta));
      return [...propias, ...items, ...variantes];
    }
    for (const herramienta of HERRAMIENTAS) {
      const esquema = z.toJSONSchema(herramienta.salida, { io: "output", unrepresentable: "any" }) as Esquema;
      expect(sinDescripcion(esquema), herramienta.nombre).toEqual([]);
    }
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
