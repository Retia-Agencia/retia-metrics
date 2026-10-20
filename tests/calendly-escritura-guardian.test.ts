import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const PERMITIDOS = new Set(["lib/calendly/escritura.ts", "lib/calendly/suscripcion.ts"]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (nombre === "node_modules" || nombre === ".next" || nombre === ".git" || nombre === ".claude") return [];
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

/**
 * ¿Este texto tiene un `fetch` que ESCRIBE en la API de Calendly? Se mira llamada por
 * llamada: el destino (primer argumento) apunta a la API —el host escrito, la constante
 * `BASE` de `lib/calendly/` o una URI devuelta por Calendly— y el método no es GET. Un POST
 * al webhook propio que lleva una URI de Calendly dentro del cuerpo no cuenta.
 */
export function escribeEnCalendly(texto: string): boolean {
  for (const m of texto.matchAll(/\b(?:fetch\w*|fetcher)\s*\(/g)) {
    const resto = texto.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 600);
    const destino = resto.split(/,\s*\{/)[0] ?? "";
    const apuntaALaApi = /api\.calendly\.com|\$\{BASE\}|\b(?:uri\w*|\w+Uri\w*)\b/.test(destino);
    const escribe = /method\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/.test(resto.slice(destino.length, destino.length + 300));
    if (apuntaALaApi && escribe) return true;
  }
  return false;
}

describe("guardián de escrituras de Calendly", () => {
  it("muerde en los dos sentidos", () => {
    expect(escribeEnCalendly('await fetch("https://api.calendly.com/invitees", { method: "POST", body })')).toBe(true);
    expect(escribeEnCalendly("await fetchImpl(`${uriEvento}/cancellation`, { method: \"POST\" })")).toBe(true);
    expect(escribeEnCalendly("await fetch(`${BASE}/event_types`, { method: \"GET\" })")).toBe(false);
    expect(escribeEnCalendly(
      'const uri = "https://api.calendly.com/scheduled_events/X";\nawait fetch(`${base}/api/webhooks/calendly/${id}`, { method: "POST", body })',
    )).toBe(false);
  });

  it("encierra todo fetch no-GET a la API de Calendly en los dos módulos autorizados", () => {
    const infracciones = archivos(RAIZ).flatMap((ruta) => {
      const rel = relative(RAIZ, ruta);
      if (PERMITIDOS.has(rel) || rel.startsWith("tests/") || !/\.(ts|tsx|mjs)$/.test(rel)) return [];
      return escribeEnCalendly(readFileSync(ruta, "utf8")) ? [rel] : [];
    });
    expect(infracciones).toEqual([]);
  });

  it("los módulos autorizados sí escriben (el guardián no está ciego)", () => {
    expect(escribeEnCalendly(readFileSync(join(RAIZ, "lib/calendly/escritura.ts"), "utf8"))).toBe(true);
  });
});
