import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Ticket 172 — la reja de SOLO LECTURA de la suplantación ("ver como") vive en
 * `requireSession` y detecta las ESCRITURAS por la cabecera `next-action` que Next pone
 * a las server actions (opción A de la decisión 7). Esa señal NO existe para los route
 * handlers: desde dentro de la guarda no se puede saber el método HTTP (no es una
 * cabecera, y la guarda no recibe el `Request`).
 *
 * Mientras TODO write sea una server action, la reja basta —hoy los únicos handlers que
 * pasan por la guarda son GET (`/api/me`, `/api/admin/ping`), y los POST (webhooks) no
 * usan sesión—. Este guardian falla el día que alguien agregue un route handler de
 * escritura (POST/PUT/PATCH/DELETE) que llame `requireSession`/`requireRole`/
 * `requireGerente`: en ese momento la reja hay que extenderla pasándole el método a la
 * guarda (opción B), o la escritura por handler se colaría bajo suplantación sin error.
 *
 * Mismo molde de análisis de texto que los otros guardianes del repo. Más una prueba de
 * que el detector no es trivial (muerde en los dos sentidos sobre un árbol de mentira).
 */

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const EXTENSIONES = new Set([".ts", ".tsx"]);
const METODOS_DE_ESCRITURA = ["POST", "PUT", "PATCH", "DELETE"];
const GUARDAS_DE_SESION = ["requireSession", "requireRole", "requireGerente"];

/** Todos los `route.ts`/`route.tsx` bajo `dir`, recursivo y ordenado. */
function routeHandlers(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const encontrados: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...routeHandlers(completo));
    else if (EXTENSIONES.has(path.extname(entrada.name)) && entrada.name.startsWith("route.")) encontrados.push(completo);
  }
  return encontrados;
}

/** Reemplaza comentarios por espacios conservando saltos de línea (como los otros guardianes). */
function sinComentarios(fuente: string): string {
  const salida: string[] = [];
  let estado: "codigo" | "linea" | "bloque" = "codigo";
  let i = 0;
  const blanco = (c: string) => (c === "\n" ? "\n" : " ");
  while (i < fuente.length) {
    const c = fuente[i];
    const par = fuente.slice(i, i + 2);
    if (estado === "codigo") {
      if (par === "//") { estado = "linea"; salida.push(" ", " "); i += 2; continue; }
      if (par === "/*") { estado = "bloque"; salida.push(" ", " "); i += 2; continue; }
      salida.push(c); i += 1; continue;
    }
    if (estado === "linea") {
      if (c === "\n") estado = "codigo";
      salida.push(blanco(c)); i += 1; continue;
    }
    if (par === "*/") { estado = "codigo"; salida.push(" ", " "); i += 2; continue; }
    salida.push(blanco(c)); i += 1;
  }
  return salida.join("");
}

/** Un handler de escritura que llama una guarda de sesión es una violación. */
function handlerDeEscrituraConGuarda(contenido: string): boolean {
  const limpio = sinComentarios(contenido);
  const exportaEscritura = METODOS_DE_ESCRITURA.some((m) =>
    new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(limpio) ||
    new RegExp(`export\\s+const\\s+${m}\\b`).test(limpio),
  );
  if (!exportaEscritura) return false;
  return GUARDAS_DE_SESION.some((g) => new RegExp(`\\b${g}\\s*\\(`).test(limpio));
}

function violaciones(raiz: string): string[] {
  return routeHandlers(path.join(raiz, "app"))
    .filter((archivo) => handlerDeEscrituraConGuarda(fs.readFileSync(archivo, "utf8")))
    .map((archivo) => path.relative(raiz, archivo))
    .sort();
}

describe("la reja de solo lectura no cubre route handlers (ticket 172, decisión 7 opción A)", () => {
  it("ningún route handler de escritura (POST/PUT/PATCH/DELETE) pasa por requireSession/requireRole/requireGerente", () => {
    const fuera = violaciones(RAIZ);
    expect(
      fuera,
      `La reja de solo lectura de "ver como" vive en requireSession y solo detecta ` +
        `escrituras por la cabecera next-action (server actions). NO cubre route ` +
        `handlers: desde la guarda no se sabe el método HTTP. Estos handlers de ` +
        `escritura llaman una guarda de sesión, así que una escritura suya se colaría ` +
        `bajo suplantación sin error. Pásale el método a la guarda (opción B) antes de ` +
        `agregarlos:\n` +
        fuera.join("\n"),
    ).toEqual([]);
  });

  // Prueba de que el detector no es trivial: sobre un árbol temporal caza un POST con
  // guarda, deja pasar un GET con guarda y un POST sin guarda.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reja-handlers-"));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("muerde en los dos sentidos", () => {
    const app = path.join(tmp, "app", "api");
    fs.mkdirSync(path.join(app, "malo"), { recursive: true });
    fs.mkdirSync(path.join(app, "get-ok"), { recursive: true });
    fs.mkdirSync(path.join(app, "post-sin-guarda"), { recursive: true });

    // Malo: POST que llama requireRole.
    fs.writeFileSync(
      path.join(app, "malo", "route.ts"),
      ["export async function POST() {", "  const s = await requireRole(\"gerente\");", "  return Response.json(s);", "}"].join("\n"),
    );
    // OK: GET con guarda (lectura).
    fs.writeFileSync(
      path.join(app, "get-ok", "route.ts"),
      ["export async function GET() {", "  const s = await requireSession();", "  return Response.json(s);", "}"].join("\n"),
    );
    // OK: POST sin guarda (un webhook).
    fs.writeFileSync(
      path.join(app, "post-sin-guarda", "route.ts"),
      ["export async function POST() {", "  return Response.json({ ok: true });", "}"].join("\n"),
    );

    expect(violaciones(tmp)).toEqual([path.join("app", "api", "malo", "route.ts")]);
  });
});
