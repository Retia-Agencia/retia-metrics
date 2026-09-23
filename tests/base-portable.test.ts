import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * ADR 0047 punto 8: el driver de la base y los SDK del proveedor viven en UN lugar.
 *
 * La base se mudo de Neon a Supabase en una tarde porque la conexion vivia en un solo
 * archivo (`lib/db/index.ts`). Este guardian mantiene esa propiedad: si un modulo
 * importa `postgres`, un driver de drizzle o un SDK de Supabase/Neon por su cuenta, la
 * proxima mudanza deja de ser cambiar una variable y pasa a ser buscar por todo el repo.
 */

const RAIZ = join(__dirname, "..");
const CARPETAS = ["lib", "app", "components", "scripts"];

/** Donde SI se permite, y por que. */
const PERMITIDOS = [
  "lib/db/", // la conexion y sus tipos
  "lib/archivos/", // el storage, cuando llegue el ticket 035
];

const PROHIBIDOS = [
  /from\s+["']postgres["']/,
  /from\s+["']drizzle-orm\/(postgres-js|neon-http|neon-serverless|node-postgres)["']/,
  /from\s+["']@supabase\//,
  /from\s+["']@neondatabase\//,
];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx|mts)$/.test(nombre) ? [ruta] : [];
  });
}

describe("la base es portable (ADR 0047)", () => {
  it("ningun modulo fuera de lib/db/ y lib/archivos/ importa el driver o un SDK del proveedor", () => {
    const infractores: string[] = [];
    for (const carpeta of CARPETAS) {
      for (const ruta of archivos(join(RAIZ, carpeta))) {
        const rel = relative(RAIZ, ruta).split(sep).join("/");
        if (PERMITIDOS.some((p) => rel.startsWith(p))) continue;
        const texto = readFileSync(ruta, "utf8");
        if (PROHIBIDOS.some((re) => re.test(texto))) infractores.push(rel);
      }
    }
    expect(infractores).toEqual([]);
  });

  it("el guardian muerde: reconoce los imports que prohibe", () => {
    expect(PROHIBIDOS.some((re) => re.test(`import postgres from "postgres";`))).toBe(true);
    expect(PROHIBIDOS.some((re) => re.test(`import { drizzle } from "drizzle-orm/postgres-js";`))).toBe(true);
    expect(PROHIBIDOS.some((re) => re.test(`import { createClient } from "@supabase/supabase-js";`))).toBe(true);
    // Y no marca lo legitimo: drizzle-orm a secas es el ORM, no el driver.
    expect(PROHIBIDOS.some((re) => re.test(`import { eq } from "drizzle-orm";`))).toBe(false);
  });
});
