import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JERGA_PROHIBIDA_EN_EL_HUB, VOCABULARIO, rotuloDeImporte } from "@/lib/vocabulario-metricas";

/**
 * Ticket 374 (ADR 0115 N4/N5): ninguna cadena VISIBLE del Hub trae jerga. Una cadena visible es un texto
 * de JSX o un literal que no es un código de una sola palabra en minúsculas (`"macro"`, `"con_utm"` son
 * valores del código, no pantalla). Mordido en los dos sentidos abajo.
 */
const CARPETAS = ["app/(app)/hub", "app/(app)/p/[programa]/hub", "components/dashboard"];

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

export function cadenasVisibles(fuente: string): string[] {
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const literales = [...sinComentarios.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, ""));
  const jsx = [...sinComentarios.matchAll(/>([^<>{}]*[A-Za-zÁ-ú][^<>{}]*)</g)].map((m) => m[1]);
  return [...literales, ...jsx].filter((t) => !/^[a-z0-9_\-:./]+$/.test(t));
}

export function jergaEn(fuente: string): string[] {
  const encontrada: string[] = [];
  for (const texto of cadenasVisibles(fuente)) {
    for (const palabra of JERGA_PROHIBIDA_EN_EL_HUB) {
      const caso = palabra === "macro" ? new RegExp("\\bmacros?\\b", "i") : new RegExp(palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (caso.test(texto)) encontrada.push(`${palabra}: ${texto.slice(0, 80)}`);
    }
  }
  return encontrada;
}

describe("el Hub habla un solo idioma (374)", () => {
  it("ninguna cadena visible trae jerga", () => {
    const malas = CARPETAS.flatMap((c) => archivos(c)).flatMap((ruta) => jergaEn(readFileSync(ruta, "utf8")).map((m) => `${ruta} → ${m}`));
    expect(malas).toEqual([]);
  });

  it("muerde: caza la jerga en texto visible", () => {
    expect(jergaEn(`<th>Monto</th>`)).not.toEqual([]);
    expect(jergaEn(`const t = "Total contratado: Contratado";`)).not.toEqual([]);
    expect(jergaEn(`<p>No depende del periodo A</p>`)).not.toEqual([]);
    expect(jergaEn(`const d = "paid_social con utm_id={{ad.id}}";`)).not.toEqual([]);
    expect(jergaEn(`const e = "Macro sin expandir";`)).not.toEqual([]);
  });

  it("no marca la solución: códigos internos, comentarios y el vocabulario", () => {
    expect(jergaEn(`const c = "macro"; const k = "con_utm"; // Monto, utm_ y macro en un comentario`)).toEqual([]);
    expect(jergaEn(`<th>{rotuloDeImporte(metrica)}</th><p>Vendido y Recaudado</p>`)).toEqual([]);
  });

  it("el vocabulario no usa palabras prohibidas y el importe nunca es Monto", () => {
    for (const e of Object.values(VOCABULARIO)) expect(jergaEn(`"${e.corto} ${e.largo} ${e.definicion}"`)).toEqual([]);
    for (const m of ["caja", "cartera", "contratado", "cierres"]) expect(rotuloDeImporte(m)).not.toBe("Monto");
  });
});
