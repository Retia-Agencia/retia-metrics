import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { sinComentarios } from "./helpers/codigo-fuente";

/**
 * Una PGlite nueva costaba ~0,6 s por test en CI; la suite llego a 462 s y el corte era 480 s el 14-oct.
 * Cada archivo debe reutilizar una base y vaciarla entre casos.
 * Una excepcion solo se agrega aqui cuando sea imprescindible y siempre con una razon concreta.
 */
const RAIZ_TESTS = fileURLToPath(new URL("./", import.meta.url));
const IDENTIFICADOR = "crearBase" + "DePrueba(";

const EXCEPCIONES: Record<string, string> = {
  "base-reutilizable.test.ts": "Compara la base reutilizable contra una base fresca por diseño.",
  "contrato-proveedores.test.ts": "Cada caso abre y cierra bases aisladas dentro de su propio flujo.",
  "deal-etapas.test.ts": "Abre una base local dentro del caso que verifica el enum migrado.",
  "metricas-con-filas.test.ts": "Mantiene varias bases simultaneas para universos de datos independientes.",
  "migracion-developer.test.ts": "Prueba directamente una migracion de esquema.",
  "webhook-formularios.test.ts": "Su base por caso alimenta el holder mutable del mock del webhook.",
};

function usaBaseFresca(fuente: string): boolean {
  return sinComentarios(fuente).includes(IDENTIFICADOR);
}

function detectarUsoNoPermitido(nombre: string, fuente: string): boolean {
  return usaBaseFresca(fuente) && !(nombre in EXCEPCIONES);
}

describe("guardian: una base PGlite por archivo", () => {
  it("solo las excepciones justificadas crean una base fresca", () => {
    const archivos = fs.readdirSync(RAIZ_TESTS).filter((nombre) => nombre.endsWith(".test.ts"));
    const fuentes = new Map(archivos.map((nombre) => [
      nombre,
      fs.readFileSync(path.join(RAIZ_TESTS, nombre), "utf8"),
    ]));
    const noPermitidos = archivos.filter((nombre) => detectarUsoNoPermitido(nombre, fuentes.get(nombre)!));
    const obsoletas = Object.keys(EXCEPCIONES).filter((nombre) => {
      const fuente = fuentes.get(nombre);
      return fuente == null || !usaBaseFresca(fuente);
    });

    expect(noPermitidos, "archivos que deben usar crearBaseReutilizable").toEqual([]);
    expect(obsoletas, "excepciones obsoletas que deben retirarse").toEqual([]);
  });

  it("muerde una llamada fresca y permite la base reutilizable", () => {
    expect(detectarUsoNoPermitido("muestra.test.ts", "await crearBase" + "DePrueba();")).toBe(true);
    expect(detectarUsoNoPermitido("muestra.test.ts", "await crearBaseReutilizable();")).toBe(false);
  });
});
