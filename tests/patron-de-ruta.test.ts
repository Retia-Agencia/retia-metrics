import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { patronDeRuta, SEGMENTOS_DE_RUTA } from "@/lib/db/medidor";

describe("patrón privado de rutas", () => {
  it.each([
    ["/leads/persona@ejemplo.com", "persona@ejemplo.com"],
    ["/leads/3001234567", "3001234567"],
    ["/leads/maria", "maria"],
    ["/leads/abcdefghijk", "abcdefghijk"],
    ["/leads/maria%40ejemplo.com", "maria%40ejemplo.com"],
    ["/leads/maria?correo=persona@ejemplo.com", "persona@ejemplo.com"],
    ["/leads/maria#persona@ejemplo.com", "persona@ejemplo.com"],
    ["/leads/maria/", "maria"],
  ])("oculta el dato de %s", (ruta, datoPrivado) => {
    expect(patronDeRuta(ruta)).not.toContain(datoPrivado);
  });

  it("conserva únicamente carpetas estáticas reales", () => {
    const pendientes = new Set<string>();
    const recorrer = (directorio: string): void => {
      for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
        if (!entrada.isDirectory()) continue;
        if (!entrada.name.startsWith("[") && !entrada.name.startsWith("(")) {
          pendientes.add(entrada.name);
        }
        recorrer(path.join(directorio, entrada.name));
      }
    };
    recorrer(path.join(process.cwd(), "app"));

    expect([...pendientes].filter((segmento) => !SEGMENTOS_DE_RUTA.has(segmento))).toEqual([]);
  });
});
