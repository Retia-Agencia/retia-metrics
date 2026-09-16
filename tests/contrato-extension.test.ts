import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * ADR 0012 — regla verificable: ningun slug ni nombre de programa escrito a mano en
 * `lib/`, `app/` ni `components/`. Si el codigo no decide segun ese valor, es una
 * instancia (fila en la base), no un literal ni una ruta fija.
 *
 * Este guardian recorre esos tres directorios y falla si aparece `comunicarte`,
 * `tactical` o `vieira` (sin distinguir mayusculas), tanto en el contenido de una
 * linea como en la RUTA de un archivo: la carpeta `app/(app)/comunicarte/` es una
 * ruta por instancia que el ADR prohibe.
 *
 * Los seeds (`scripts/`) y los tests (`tests/`) quedan fuera de la regla a proposito.
 */

const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/** Terminos prohibidos: nombres y slugs de programa, en minuscula. */
const PROHIBIDOS = ["comunicarte", "tactical", "vieira"];

/** Extensiones de codigo que se inspeccionan. */
const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

/**
 * Excepciones explicitas. HOY ESTA VACIA A PROPOSITO.
 *
 * Cada entrada que se agregue aqui es una violacion tolerada y debe justificarse en
 * este comentario: por que ese literal es inevitable y no puede vivir en la base.
 * El ticket 009 no agrega ninguna: prefiere reescribir el comentario, y eso lo hace
 * el ticket 010. Si te ves tentado a agregar una, para y arregla el codigo.
 */
const EXCEPCIONES: readonly string[] = [];

/** Recorta un texto largo para que el mensaje de falla sea legible. */
function recortar(texto: string, max = 80): string {
  const limpio = texto.trim();
  return limpio.length > max ? `${limpio.slice(0, max)}…` : limpio;
}

/** Todos los archivos de codigo bajo `dir`, recursivo, con `node:fs` a secas. */
function archivosDeCodigo(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const encontrados: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...archivosDeCodigo(completo));
    } else if (EXTENSIONES.has(path.extname(entrada.name))) {
      encontrados.push(completo);
    }
  }
  return encontrados;
}

/**
 * Busca violaciones del contrato de extension en `dirs` (relativos a `raiz`).
 * Devuelve una lista de violaciones ya formateadas:
 *   - `ruta:linea: texto recortado` para un termino en el CONTENIDO de una linea.
 *   - `ruta` (sin numero de linea) para un termino en la RUTA del archivo.
 * La logica vive aqui, en el test, para que el detector no sea trivial.
 */
function buscarViolaciones(dirs: readonly string[], raiz: string): string[] {
  const violaciones: string[] = [];
  for (const dir of dirs) {
    for (const archivo of archivosDeCodigo(path.join(raiz, dir))) {
      const ruta = path.relative(raiz, archivo);
      if (EXCEPCIONES.includes(ruta)) continue;

      // Violacion por RUTA: la carpeta lleva el nombre de una instancia.
      const rutaMin = ruta.toLowerCase();
      if (PROHIBIDOS.some((t) => rutaMin.includes(t))) {
        violaciones.push(ruta);
      }

      // Violacion por CONTENIDO: el literal aparece en una linea.
      const lineas = fs.readFileSync(archivo, "utf8").split("\n");
      lineas.forEach((linea, i) => {
        const min = linea.toLowerCase();
        if (PROHIBIDOS.some((t) => min.includes(t))) {
          violaciones.push(`${ruta}:${i + 1}: ${recortar(linea)}`);
        }
      });
    }
  }
  return violaciones;
}

describe("contrato de extension (ADR 0012)", () => {
  // El ticket 010 elimino las violaciones que este guardian nacio vigilando: los
  // programas ya no viven a mano en `lib/nav.ts` ni en dos paginas fijas, sino que
  // salen de la base y entran como dato; el dashboard vive en `/programas/[slug]`;
  // los comentarios de `lib/sheets/*`, `app/layout.tsx` y los iconos del sidebar ya
  // no nombran ningun programa. Con eso el `.fails` desaparece y el guardian queda
  // activo: si alguien vuelve a escribir un programa a mano en lib/, app/ o
  // components/, este test falla y lo señala.
  it("ningun slug ni nombre de programa vive en lib/, app/ ni components/", () => {
    const violaciones = buscarViolaciones(["lib", "app", "components"], RAIZ);
    expect(
      violaciones,
      `El ADR 0012 prohibe escribir programas a mano. Arregla estas (ticket 010):\n${violaciones.join("\n")}`,
    ).toEqual([]);
  });

  // Prueba de que el detector no es trivial: sobre un arbol temporal controlado
  // encuentra exactamente la linea sucia y la ruta sucia, y deja pasar lo limpio.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "contrato-ext-"));

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("detecta una violacion de contenido y una de ruta, y no toca lo limpio", () => {
    // Un directorio de mentira que imita lib/ app/ components/.
    fs.mkdirSync(path.join(tmp, "lib"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "app", "(app)", "comunicarte"), { recursive: true });

    // Archivo limpio: no dispara nada.
    fs.writeFileSync(
      path.join(tmp, "lib", "limpio.ts"),
      "export const PROGRAMAS = cargarDeLaBase();\n// nada prohibido aqui\n",
    );

    // Archivo con el literal en la linea 3 (violacion de contenido).
    fs.writeFileSync(
      path.join(tmp, "lib", "sucio.ts"),
      "const a = 1;\nconst b = 2;\nconst nombre = \"Comunicarte\";\n",
    );

    // Archivo cuya RUTA lleva el nombre de la instancia (violacion de ruta).
    fs.writeFileSync(
      path.join(tmp, "app", "(app)", "comunicarte", "page.tsx"),
      "export default function Page() { return null; }\n",
    );

    const violaciones = buscarViolaciones(["lib", "app", "components"], tmp);

    expect(violaciones).toContain(
      `${path.join("lib", "sucio.ts")}:3: const nombre = "Comunicarte";`,
    );
    expect(violaciones).toContain(path.join("app", "(app)", "comunicarte", "page.tsx"));
    // El archivo limpio no aparece en ninguna violacion.
    expect(violaciones.some((v) => v.includes("limpio.ts"))).toBe(false);
  });
});
