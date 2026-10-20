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

  it("solo lib/meta-capi habla con el endpoint de eventos de Meta", () => {
    const infractores = fuentes.filter((archivo) => {
      if (archivo.includes(`${path.sep}lib${path.sep}meta-capi${path.sep}`)) return false;
      return /graph\.facebook\.com[^\n]*\/events/.test(sinComentarios(fs.readFileSync(archivo, "utf8")));
    });
    expect(infractores).toEqual([]);
  });

  it("solo lib/meta-capi importa credencialesMetaCapi", () => {
    const infractores = fuentes.filter((archivo) => {
      if (archivo.includes(`${path.sep}lib${path.sep}meta-capi${path.sep}`)
        || archivo.endsWith(`${path.sep}lib${path.sep}integraciones${path.sep}index.ts`)) return false;
      return /\bcredencialesMetaCapi\b/.test(sinComentarios(fs.readFileSync(archivo, "utf8")));
    });
    expect(infractores).toEqual([]);
  });

  // Desde la 0096 las columnas no existen ni en el esquema (paso 2 del ADR 0095).
  it("nadie, ni el esquema, nombra las columnas secretas antiguas", () => {
    const nombres = ["calendlyToken", "calendlySigningKey", "typeformToken", "metaConexiones"];
    const infractores = fuentes.filter((archivo) => {
      const codigo = sinComentarios(fs.readFileSync(archivo, "utf8"));
      return nombres.some((nombre) => codigo.includes(nombre));
    });
    expect(infractores).toEqual([]);
    expect(nombres.some((nombre) => `programs.calendlyToken`.includes(nombre))).toBe(true);
  });
});
