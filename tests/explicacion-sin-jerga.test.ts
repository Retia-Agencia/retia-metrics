/**
 * Guardián de DM-9 (ticket 419): la explicación de una cifra la leen Gerencia y Pauta. Ningún texto lleva rutas,
 * `lib/`, "§", "ADR", "ticket", ids M#/D-#/I-#, `utm_`, "macro" ni "periodo A/B". Recorre todo el texto que puede
 * abrir una cifra: las explicaciones de Pauta, los campos de explicación de las fichas y las frases de `armarCifra`.
 */
import { describe, expect, it } from "vitest";
import * as cifra from "@/lib/metricas/cifra";
import { REGISTRO } from "@/lib/metricas/registro";

const JERGA: ReadonlyArray<readonly [string, RegExp]> = [
  ["ruta de archivo", /\b[\w-]+\/[\w./-]+\.(ts|tsx|md|sql)\b/],
  ["lib/", /\blib\//],
  ["§", /§/],
  ["ADR", /\bADR\b/],
  ["ticket", /\bticket\b/i],
  ["id de métrica", /\bM\d+\b/],
  ["id de decisión", /\b[DI]-[A-Z0-9]+\b/],
  ["utm_", /utm_/i],
  ["macro", /\bmacro/i],
  ["periodo A/B", /\bperiodo [AB]\b/i],
  ["función", /\b[a-z]+[A-Z]\w*\(/],
];

function jergaEn(texto: string): string[] {
  return JERGA.filter(([, patron]) => patron.test(texto)).map(([nombre]) => nombre);
}

function textosDe(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textosDe);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textosDe);
  return [];
}

describe("ninguna explicación lleva texto técnico (DM-9)", () => {
  it("el guardián muerde en los dos sentidos", () => {
    expect(jergaEn("§3 M3 · lib/queries/hechos/agenda.ts")).toEqual(expect.arrayContaining(["ruta de archivo", "lib/", "§", "id de métrica"]));
    expect(jergaEn("Ver ADR 0067 y el ticket 419")).toEqual(["ADR", "ticket"]);
    expect(jergaEn("Fórmula sujeta a D-A; ver I-8")).toEqual(["id de decisión"]);
    expect(jergaEn("viene en utm_content, una macro del periodo A")).toEqual(["utm_", "macro", "periodo A/B"]);
    expect(jergaEn("lo calcula agendasDePauta(cohorte)")).toEqual(["función"]);
    // Lo que sí puede decir: palabras de negocio, monedas, la ruta de una pantalla con "›".
    expect(jergaEn("Gasto en campañas de agenda ÷ Agendadas de pauta. Se carga en Programa › Objetivos.")).toEqual([]);
    expect(jergaEn("COP 44.800 · Meta · ROAS 6,1× · Mi espacio")).toEqual([]);
  });

  it("los campos de explicación de todas las fichas del registro", () => {
    for (const [clave, ficha] of Object.entries(REGISTRO)) {
      const { que, formula, variables, aliasExcel } = ficha as { que?: string; formula?: unknown; variables?: unknown; aliasExcel?: string };
      for (const texto of textosDe([que, formula, variables, aliasExcel])) {
        expect(jergaEn(texto), `${clave}: «${texto}»`).toEqual([]);
      }
    }
  });

  it("las frases fijas de la Cifra", () => {
    const frases = Object.entries(cifra).filter(([nombre, v]) => nombre.startsWith("FRASE_") && typeof v === "string");
    expect(frases.length).toBeGreaterThan(0);
    for (const [nombre, frase] of frases) expect(jergaEn(frase as string), nombre).toEqual([]);
    expect(jergaEn(cifra.fraseEnCurso(undefined))).toEqual([]);
  });
});
