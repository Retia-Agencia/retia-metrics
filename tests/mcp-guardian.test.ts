import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HERRAMIENTAS } from "@/lib/mcp/herramientas";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CON_SQL = new Set(["token.ts", "sesion.ts", "bitacora.ts"]);
const PATRONES_DB = [/\bdb\.select\b/, /\bdb\.insert\b/, /\bdb\.update\b/, /\.from\s*\(/, /\bsql`/];
const PATRONES_ROL = [/\brol\s*={2,3}\s*["']/, /["'][^"']+["']\s*={2,3}\s*\brol\b/, /session\.user\.rol/];

function archivosTs(raiz: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of fs.readdirSync(raiz, { withFileTypes: true })) {
    const ruta = path.join(raiz, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...archivosTs(ruta));
    else if (entrada.name.endsWith(".ts")) encontrados.push(ruta);
  }
  return encontrados;
}

function violaciones(raiz: string): string[] {
  const problemas: string[] = [];
  for (const archivo of archivosTs(raiz)) {
    const fuente = fs.readFileSync(archivo, "utf8");
    const relativo = path.relative(raiz, archivo);
    if (!CON_SQL.has(path.basename(archivo))) {
      for (const patron of PATRONES_DB) {
        if (patron.test(fuente)) problemas.push(`${relativo}: acceso SQL fuera del límite`);
      }
    }
    for (const patron of PATRONES_ROL) {
      if (patron.test(fuente)) problemas.push(`${relativo}: rol decidido a mano`);
    }
  }
  return problemas;
}

const temporales: string[] = [];
afterAll(() => {
  for (const temporal of temporales) fs.rmSync(temporal, { recursive: true, force: true });
});

describe("guardián del dominio MCP", () => {
  it("el árbol real no hace SQL fuera de token, sesión y bitácora ni decide roles a mano", () => {
    expect(violaciones(path.join(RAIZ, "lib", "mcp"))).toEqual([]);
  });

  it("muerde una consulta y una comparación de rol en un árbol controlado", () => {
    const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-guardian-malo-"));
    temporales.push(temporal);
    fs.writeFileSync(path.join(temporal, "herramienta.ts"), [
      "db.select().from(users);",
      "if (rol === 'closer') return session.user.rol;",
    ].join("\n"));
    expect(violaciones(temporal)).toHaveLength(4);
  });

  it("no muerde un módulo limpio ni los tres límites de persistencia", () => {
    const temporal = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-guardian-bueno-"));
    temporales.push(temporal);
    fs.writeFileSync(path.join(temporal, "programas.ts"), "export const leer = () => true;\n");
    fs.writeFileSync(path.join(temporal, "token.ts"), "db.select().from(users);\n");
    expect(violaciones(temporal)).toEqual([]);
  });

  it("cada herramienta registrada declara permiso, entrada estricta y solo lectura", () => {
    for (const herramienta of HERRAMIENTAS) {
      expect(typeof herramienta.puede).toBe("function");
      expect(herramienta.soloLectura).toBe(true);
      expect(herramienta.entrada.safeParse({ campo_ajeno: true }).success).toBe(false);
    }
  });
});
