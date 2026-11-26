import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { HERRAMIENTAS } from "@/lib/mcp/herramientas";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/**
 * Contrato de las herramientas del MCP hacia el cliente (otra máquina): permiso, entrada estricta y anotaciones seguras.
 * Que el MCP no haga SQL propio ni decida roles a mano lo vigila ESLint (`eslint.config.mjs`, regla de `lib/mcp/`).
 */
describe("contrato de seguridad del dominio MCP", () => {
  it("cada herramienta registrada declara permiso, entrada estricta y solo confirmar cambia datos", () => {
    for (const herramienta of HERRAMIENTAS) {
      expect(typeof herramienta.puede).toBe("function");
      expect(herramienta.soloLectura).toBe(herramienta.nombre !== "confirmar_cambio");
      expect(herramienta.titulo.trim()).not.toBe("");
      expect(herramienta.entrada.safeParse({ campo_ajeno: true }).success).toBe(false);
    }
  });

  it("el servidor publica las cuatro anotaciones seguras y valida el esquema de salida", () => {
    const fuente = fs.readFileSync(path.join(RAIZ, "lib", "mcp", "servidor.ts"), "utf8");
    expect(fuente).toContain("readOnlyHint: herramienta.soloLectura");
    expect(fuente).toContain("idempotentHint: herramienta.soloLectura");
    expect(fuente).toContain("openWorldHint: false");
    expect(fuente).toContain("destructiveHint: herramienta.destructiva ?? false");
    expect(fuente).toContain("outputSchema: herramienta.salida");
    expect(fuente).toContain("herramienta.salida.safeParse(estructurado)");
  });
});
