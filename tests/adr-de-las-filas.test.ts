import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * Ticket 358 (enmienda 13-nov), punto 3 de los pendientes de `docs/contrato-metricas-y-datos.md`: todo "ADR NNNN" que
 * cite `docs/metricas.md` existe en `docs/adr/` y no está en el índice de retirados. Hoy una cita a un ADR retirado es
 * revisión manual y se ve igual que una buena.
 */
const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/** Números de ADR citados como "ADR 0088", "ADR 0088 y 0109" o "ADR 0088, 0109". */
export function adrCitados(texto: string): string[] {
  const citados = new Set<string>();
  for (const m of texto.matchAll(/ADRs?\s+((?:\d{4})(?:\s*(?:,|y|e|\/)\s*\d{4})*)/g)) {
    for (const n of m[1].match(/\d{4}/g) ?? []) citados.add(n);
  }
  return [...citados].sort();
}

/** Números de las tablas "## Retirados ..." del índice. */
export function adrRetirados(indice: string): string[] {
  const retirados = new Set<string>();
  let enRetirados = false;
  for (const linea of indice.split("\n")) {
    if (linea.startsWith("## ")) enRetirados = linea.startsWith("## Retirados");
    const fila = enRetirados ? linea.match(/^\|\s*(\d{4})\s*\|/) : null;
    if (fila) retirados.add(fila[1]);
  }
  return [...retirados].sort();
}

export function citasMalas(texto: string, existentes: ReadonlySet<string>, retirados: ReadonlySet<string>) {
  const citados = adrCitados(texto);
  return {
    inexistentes: citados.filter((n) => !existentes.has(n)),
    retirados: citados.filter((n) => retirados.has(n)),
  };
}

/** Citas que ya estaban rotas cuando se escribió el guardián; solo puede bajar. */
const CITAS_POR_ARREGLAR: Record<string, string> = {};
const TOPE_DE_CITAS_POR_ARREGLAR = 0;

describe("los ADR que cita el diccionario de métricas", () => {
  const existentes = new Set(readdirSync(join(RAIZ, "docs/adr")).flatMap((f) => f.match(/^(\d{4})-/)?.[1] ?? []));
  const retirados = new Set(adrRetirados(readFileSync(join(RAIZ, "docs/adr/README.md"), "utf8")));
  const metricas = readFileSync(join(RAIZ, "docs/metricas.md"), "utf8");

  it("existen y no están retirados", () => {
    const { inexistentes, retirados: citadosRetirados } = citasMalas(metricas, existentes, retirados);
    const malos = [...inexistentes.map((n) => `${n} no existe`), ...citadosRetirados.map((n) => `${n} está retirado`)]
      .filter((m) => !(m.slice(0, 4) in CITAS_POR_ARREGLAR));
    expect(malos).toEqual([]);
    expect(Object.keys(CITAS_POR_ARREGLAR).length).toBeLessThanOrEqual(TOPE_DE_CITAS_POR_ARREGLAR);
  });

  it("el guardián ve citas de verdad: el diccionario cita ADR y el índice tiene retirados", () => {
    expect(adrCitados(metricas).length).toBeGreaterThan(10);
    expect(retirados.size).toBeGreaterThan(0);
  });

  it("muerde: caza un ADR inexistente y uno retirado, deja pasar uno vigente", () => {
    const e = new Set(["0088", "0007"]);
    const r = new Set(["0007"]);
    expect(citasMalas("ver ADR 0088", e, r)).toEqual({ inexistentes: [], retirados: [] });
    expect(citasMalas("ver ADR 0007 y 0999", e, r)).toEqual({ inexistentes: ["0999"], retirados: ["0007"] });
    expect(adrRetirados("## Vigentes\n| 0001 | x |\n## Retirados el 1\n| 0007 | x |\n")).toEqual(["0007"]);
  });
});
