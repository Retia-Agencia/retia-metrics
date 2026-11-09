import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Un módulo de servidor solo importa de un archivo `"use client"` COMPONENTES (9-nov, ticket 360).
 *
 * Un valor que no es componente (una constante, un arreglo, una función) exportado desde un archivo
 * `"use client"` llega al servidor como una REFERENCIA de cliente, no como el valor: `[...CLAVES]` revienta
 * con "is not iterable" y una función no se puede llamar. Pasó con `CLAVES_DE_FECHA_LISTA` en Calls: typecheck,
 * lint y 181 tests en verde, y la pantalla caída. Solo se vio al abrirla en el navegador.
 *
 * La regla: lo que un servidor importa de un archivo cliente empieza con mayúscula seguida de minúscula
 * (`FiltroFechaLista`, un componente) o es un tipo. Una constante o función que ambos lados necesitan
 * vive en `lib/`, sin `"use client"`.
 */
const RAIZ = process.cwd();
const CARPETAS = ["app", "components", "lib"];
const EXTENSIONES = [".tsx", ".ts"];

function recorrer(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === "node_modules" ? [] : recorrer(join(dir, e.name))) : [join(dir, e.name)],
  );
}

/** ¿El archivo declara `"use client"` como primera sentencia (ignorando comentarios)? */
export function esDeCliente(fuente: string): boolean {
  let resto = fuente.trimStart();
  while (resto.startsWith("/*") || resto.startsWith("//")) {
    resto = resto.startsWith("/*") ? resto.slice(resto.indexOf("*/") + 2).trimStart() : resto.slice(resto.indexOf("\n") + 1).trimStart();
  }
  return /^["']use client["']/.test(resto);
}

/** Un nombre de componente: mayúscula y después una minúscula (`FiltroX`), no `CLAVES_X` ni `useX`. */
export function esNombreDeComponente(nombre: string): boolean {
  return /^[A-Z][a-z0-9]/.test(nombre);
}

export interface ImportDeValor {
  nombre: string;
  de: string;
}

/** Los valores (no tipos) que un archivo importa por nombre de rutas `@/...` o relativas. */
export function importsDeValores(fuente: string): ImportDeValor[] {
  const salida: ImportDeValor[] = [];
  const patron = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
  for (const m of fuente.matchAll(patron)) {
    if (m[1]) continue;
    for (const crudo of m[2].split(",")) {
      const t = crudo.trim();
      if (!t || t.startsWith("type ")) continue;
      const nombre = t.split(/\s+as\s+/)[0].trim();
      salida.push({ nombre, de: m[3] });
    }
  }
  return salida;
}

function resolver(desde: string, ruta: string, existe: (r: string) => boolean): string | null {
  const base = ruta.startsWith("@/") ? join(RAIZ, ruta.slice(2)) : ruta.startsWith(".") ? join(dirname(desde), ruta) : null;
  if (!base) return null;
  for (const ext of EXTENSIONES) if (existe(base + ext)) return base + ext;
  for (const ext of EXTENSIONES) if (existe(join(base, "index" + ext))) return join(base, "index" + ext);
  return null;
}

/** Violaciones: un archivo de servidor que importa un valor que no es componente de un archivo de cliente. */
export function violaciones(archivos: { ruta: string; fuente: string }[]): string[] {
  const porRuta = new Map(archivos.map((a) => [a.ruta, a.fuente]));
  const salida: string[] = [];
  for (const { ruta, fuente } of archivos) {
    if (esDeCliente(fuente)) continue;
    for (const { nombre, de } of importsDeValores(fuente)) {
      const destino = resolver(ruta, de, (r) => porRuta.has(r));
      const fuenteDestino = destino ? porRuta.get(destino) : undefined;
      if (fuenteDestino === undefined || !esDeCliente(fuenteDestino)) continue;
      if (!esNombreDeComponente(nombre)) salida.push(`${relative(RAIZ, ruta)} importa ${nombre} de ${de} ("use client")`);
    }
  }
  return salida;
}

describe("guardián de la frontera cliente/servidor", () => {
  it("ningún módulo de servidor importa un valor que no es componente de un archivo \"use client\"", () => {
    const archivos = CARPETAS.flatMap((c) => recorrer(join(RAIZ, c)))
      .filter((r) => EXTENSIONES.some((e) => r.endsWith(e)))
      .map((ruta) => ({ ruta, fuente: readFileSync(ruta, "utf8") }));
    expect(violaciones(archivos)).toEqual([]);
  });

  it("muerde: caza una constante de un archivo cliente y deja pasar un componente, un tipo y un cliente", () => {
    const cliente = { ruta: join(RAIZ, "components/x.tsx"), fuente: '"use client";\nexport const CLAVES = ["a"];\nexport function Panel() { return null; }' };
    const servidor = (fuente: string) => ({ ruta: join(RAIZ, "app/p.tsx"), fuente });
    expect(violaciones([cliente, servidor('import { Panel, CLAVES } from "@/components/x";')])).toEqual([
      `app/p.tsx importa CLAVES de @/components/x ("use client")`,
    ]);
    expect(violaciones([cliente, servidor('import { Panel } from "@/components/x";')])).toEqual([]);
    expect(violaciones([cliente, servidor('import type { CLAVES } from "@/components/x";')])).toEqual([]);
    expect(violaciones([cliente, servidor('import { type CLAVES, Panel } from "@/components/x";')])).toEqual([]);
    // un archivo de cliente puede importar valores de otro de cliente
    expect(violaciones([cliente, { ruta: join(RAIZ, "components/y.tsx"), fuente: '"use client";\nimport { CLAVES } from "@/components/x";' }])).toEqual([]);
    // una función de servidor (sin "use client") no cuenta como destino
    expect(violaciones([{ ruta: join(RAIZ, "lib/z.ts"), fuente: "export const CLAVES = [];" }, servidor('import { CLAVES } from "@/lib/z";')])).toEqual([]);
  });
});
