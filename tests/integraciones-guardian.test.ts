import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

const raiz = fileURLToPath(new URL("../", import.meta.url));
const carpetas = ["lib", "app", "components", "scripts"];
const fuentes = carpetas.flatMap((carpeta) => archivos(path.join(raiz, carpeta)));

describe("límite de secretos de integraciones", () => {
  it("solo lib/integraciones toca integraciones.secretos", () => {
    const infractores = fuentes.filter((archivo) => {
      if (archivo.includes(`${path.sep}lib${path.sep}integraciones${path.sep}`) || archivo.endsWith(`${path.sep}lib${path.sep}db${path.sep}schema.ts`)) return false;
      return /integraciones\.secretos|secretos:\s*integraciones\.secretos/.test(sinComentarios(fs.readFileSync(archivo, "utf8")));
    });
    expect(infractores).toEqual([]);
    expect(/integraciones\.secretos/.test("integraciones.secretos")).toBe(true);
  });

  it("ningún consumidor usa las columnas secretas antiguas", () => {
    const nombres = ["calendlyToken", "calendlySigningKey", "typeformToken", "metaConexiones"];
    const infractores = fuentes.filter((archivo) => {
      if (archivo.endsWith(`${path.sep}lib${path.sep}db${path.sep}schema.ts`)) return false;
      const codigo = sinComentarios(fs.readFileSync(archivo, "utf8"));
      return nombres.some((nombre) => codigo.includes(nombre));
    });
    expect(infractores).toEqual([]);
    expect(nombres.some((nombre) => `programs.calendlyToken`.includes(nombre))).toBe(true);
  });
});
