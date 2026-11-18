import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VOCABULARIO, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";
import { REGISTRO } from "@/lib/metricas/registro";
import { HECHOS_CONSULTABLES } from "@/lib/queries/hechos/registro";

/**
 * 429 (Mani, 18-nov): ninguna cifra de envíos queda ambigua. Todo rótulo que diga «Envíos» o «Registros» declara su
 * universo: «completos» (lo que cuentan Meta y el Excel, y por tanto Pauta) o «completos y parciales» (la cifra Envíos).
 * Y toda consulta del hecho de envíos DECLARA su universo (`universo` es obligatorio en el tipo; aquí se vigila que
 * nadie lo tape con un valor por omisión).
 */
const DECLARA_UNIVERSO = /completos|parciales/i;
const NOMBRA_ENVIOS = /\b(Env[ií]os|Registros)\b/;

describe("guardián: cada cifra de envíos declara su universo (429)", () => {
  it("el vocabulario no tiene un «Envíos» o «Registros» sin universo", () => {
    const sueltos = Object.entries(VOCABULARIO)
      .flatMap(([clave, v]) => [["corto", v.corto], ["largo", v.largo]].map(([campo, texto]) => ({ clave, campo, texto })))
      .filter(({ texto }) => NOMBRA_ENVIOS.test(texto) && !DECLARA_UNIVERSO.test(texto))
      .map(({ clave, campo, texto }) => `${clave}.${campo}: ${texto}`);
    expect(sueltos).toEqual([]);
  });

  it("los rótulos de la tabla semanal de Pauta que nombran registros dicen «completos»", () => {
    const sueltos = Object.entries(VOCABULARIO_PAUTA_SEMANAL)
      .filter(([, texto]) => NOMBRA_ENVIOS.test(texto) && !DECLARA_UNIVERSO.test(texto)).map(([c]) => c);
    expect(sueltos).toEqual([]);
    expect(VOCABULARIO_PAUTA_SEMANAL.envios).toBe("Registros completos");
  });

  it("la fila del diccionario de cada ficha de envíos declara su universo", () => {
    const sueltas = Object.entries(REGISTRO)
      .filter(([, ficha]) => NOMBRA_ENVIOS.test(ficha.filaDelDiccionario) && !DECLARA_UNIVERSO.test(ficha.filaDelDiccionario))
      .map(([clave, ficha]) => `${clave}: ${ficha.filaDelDiccionario}`);
    expect(sueltas).toEqual([]);
  });

  it("el hecho de envíos del MCP trae la dimensión tipo", () => {
    expect(HECHOS_CONSULTABLES.envio.dimensiones).toContain("tipo");
  });

  it("ningún llamador del hecho de envíos omite el universo", () => {
    const archivos = ["lib/queries/reporte-diario.ts", "lib/queries/proyeccion.ts", "lib/queries/vista-hoy.ts", "lib/queries/origen.ts",
      "lib/queries/hechos/pauta-semanal.ts", "lib/queries/metricas-con-filas.ts"];
    for (const archivo of archivos) {
      const fuente = fs.readFileSync(path.join(process.cwd(), archivo), "utf8");
      expect(fuente, archivo).toMatch(/universo: "completos(_y_parciales)?"/);
    }
  });
});
