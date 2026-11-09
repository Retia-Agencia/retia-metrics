import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXCEPCIONES_HISTORICAS, TOPE_DE_EXCEPCIONES } from "./helpers/n9-excepciones";

/**
 * Guardián de la regla N9 (ADR 0115): un ticket es `done` solo con sus casillas marcadas y el tracker igual al
 * `status:` de su archivo. Sin base de datos: solo lee `docs/tasks/`.
 *   R1  todo ticket `done` tiene todas las casillas de «## Done cuando» marcadas.
 *   R2  la marca `[x]` del tracker ⇔ status ∈ {done, reemplazado, descartado} (`en main` NO cuenta).
 *   R3  todo ticket tiene fila en el tracker.
 * Los históricos que incumplen son un trinquete (`tests/helpers/n9-excepciones.ts`).
 */

const CERRADOS = new Set(["done", "reemplazado", "descartado"]);

export type Regla = "R1" | "R2" | "R3";

export function statusDe(textoTicket: string): string | null {
  const m = /^---\n([\s\S]*?)\n---/.exec(textoTicket);
  const linea = m?.[1].split("\n").find((l) => l.startsWith("status:"));
  if (!linea) return null;
  return linea.slice("status:".length).replace(/#.*$/, "").trim().replace(/^["']|["']$/g, "") || null;
}

export function casillasSinMarcar(textoTicket: string): number {
  const m = /^## Done cuando[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(textoTicket);
  return m ? (m[1].match(/^\s*- \[ \]/gm) ?? []).length : 0;
}

/** id → marcas `[x]`/`[ ]` de sus filas en la tabla del tracker. */
export function marcasDelTracker(textoTracker: string): Map<string, boolean[]> {
  const marcas = new Map<string, boolean[]>();
  for (const l of textoTracker.split("\n")) {
    const m = /^\|\s*\[([ xX])\]\s*\|\s*(\d+)\s*\|/.exec(l);
    if (!m) continue;
    marcas.set(m[2], [...(marcas.get(m[2]) ?? []), m[1] !== " "]);
  }
  return marcas;
}

/** Reglas que incumple un ticket; función pura, la que se muerde con casos sintéticos. */
export function reglasQueIncumple(textoTicket: string, marcas: boolean[] | undefined): Regla[] {
  const status = statusDe(textoTicket);
  const r: Regla[] = [];
  if (status === "done" && casillasSinMarcar(textoTicket) > 0) r.push("R1");
  if (!marcas || marcas.length === 0) r.push("R3");
  else if (marcas.some((x) => x !== CERRADOS.has(status ?? ""))) r.push("R2");
  return r;
}

const RAIZ = join(__dirname, "..", "docs", "tasks");

function violacionesReales(): string[] {
  const tracker = marcasDelTracker(readFileSync(join(RAIZ, "README.md"), "utf8"));
  const out: string[] = [];
  for (const f of readdirSync(RAIZ).filter((n) => /^\d.*\.md$/.test(n))) {
    const texto = readFileSync(join(RAIZ, f), "utf8");
    if (statusDe(texto) === null) continue; // briefs y notas sin front matter de ticket
    const id = /^(\d+)-/.exec(f)![1];
    for (const regla of reglasQueIncumple(texto, tracker.get(id))) out.push(`${id}:${regla}`);
  }
  return out;
}

const ticket = (status: string, casillas: string) =>
  `---\nid: 999\nstatus: ${status}\n---\n\n# 999\n\n## Done cuando\n\n${casillas}\n\n## Fuera de alcance\n\n- [ ] no cuenta\n`;

describe("guardián N9 del tracker", () => {
  it("muerde en los dos sentidos con casos sintéticos", () => {
    expect(reglasQueIncumple(ticket("done", "- [x] a\n- [ ] b"), [true])).toEqual(["R1"]);
    expect(reglasQueIncumple(ticket("done", "- [x] a\n- [x] b"), [true])).toEqual([]);
    expect(reglasQueIncumple(ticket("en main", "- [ ] a"), [true])).toEqual(["R2"]);
    expect(reglasQueIncumple(ticket("en main", "- [ ] a"), [false])).toEqual([]);
    expect(reglasQueIncumple(ticket("done", "- [x] a"), [false])).toEqual(["R2"]);
    expect(reglasQueIncumple(ticket("reemplazado", ""), [true])).toEqual([]);
    expect(reglasQueIncumple(ticket("descartado", ""), [true])).toEqual([]);
    expect(reglasQueIncumple(ticket("done", "- [x] a"), undefined)).toEqual(["R3"]);
    expect(statusDe(ticket("en curso  # nota", ""))).toBe("en curso");
    expect(marcasDelTracker("| [x] | 12 | t | — | done |\n| [ ] | 13 | t | — | todo |").get("13")).toEqual([false]);
  });

  it("no hay ticket nuevo que incumpla, ni excepción que ya cumpla, y la lista solo encoge", () => {
    const reales = new Set(violacionesReales());
    const excepciones = new Set(EXCEPCIONES_HISTORICAS);
    expect(EXCEPCIONES_HISTORICAS).toHaveLength(TOPE_DE_EXCEPCIONES);
    expect(excepciones.size).toBe(EXCEPCIONES_HISTORICAS.length);
    expect([...reales].filter((v) => !excepciones.has(v)).sort(), "incumplen N9 y no son históricos").toEqual([]);
    expect([...excepciones].filter((v) => !reales.has(v)).sort(), "ya cumplen: bórralos de la lista").toEqual([]);
  });
});
