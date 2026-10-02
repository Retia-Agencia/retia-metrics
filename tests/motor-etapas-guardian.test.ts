import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Ticket 046 — nadie escribe `deals.etapa` ni `deals.pendiente` fuera del motor.
 *
 * `moverEtapa()` (`lib/deals/mover-etapa.ts`) es el unico camino: valida la flecha, lo
 * que le falta al deal y escribe el historial. Una escritura por fuera deja un deal en
 * una etapa sin historial, y sin historial no hay conversion ni tiempo en etapa, **sin
 * lanzar ningun error**. Por eso lo vigila un test y no la disciplina.
 *
 * Tres formas de escribir la etapa, las tres cazadas:
 *  1. una cadena de drizzle `.update(deals)…` que toca `etapa`;
 *  2. SQL crudo (cadena o plantilla) con `update`, `deals` y `etapa`;
 *  3. la puerta generica: `editarConRastro` sobre `deals` con `etapa`, o `crearConRastro`
 *     con la llave del motor (`desdeElMotor: true`) fuera del motor. Las dos las rechaza
 *     ademas `lib/crm/rastro.ts` en tiempo de ejecucion, porque la etapa puede llegar
 *     dentro de una variable que ningun escaneo de texto ve.
 *
 * A diferencia del guardian de rastro, este NO vacia las cadenas: el SQL crudo vive
 * justo ahi. Solo quita los comentarios, que en este repo hablan de etapas en prosa.
 */
const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const DIRECTORIOS = ["lib", "app", "components", "scripts"];
const EXTENSIONES = new Set([".ts", ".tsx"]);
/** El unico modulo autorizado a escribir la etapa. */
const MOTOR = path.join("lib", "deals", "mover-etapa.ts");

/** Quita comentarios y conserva cadenas y saltos de linea. */
function sinComentarios(fuente: string): string {
  let salida = "";
  let estado: "codigo" | "linea" | "bloque" | "simple" | "doble" | "template" = "codigo";
  for (let i = 0; i < fuente.length; i++) {
    const c = fuente[i];
    const par = fuente.slice(i, i + 2);
    if (estado === "linea") {
      if (c === "\n") { estado = "codigo"; salida += "\n"; }
      continue;
    }
    if (estado === "bloque") {
      if (par === "*/") { estado = "codigo"; i++; } else if (c === "\n") salida += "\n";
      continue;
    }
    if (estado === "codigo") {
      if (par === "//") { estado = "linea"; i++; continue; }
      if (par === "/*") { estado = "bloque"; i++; continue; }
      if (c === "'") estado = "simple";
      else if (c === '"') estado = "doble";
      else if (c === "`") estado = "template";
      salida += c;
      continue;
    }
    // Dentro de una cadena: se copia tal cual, saltando el escape.
    if (c === "\\") { salida += par; i++; continue; }
    if ((estado === "simple" && c === "'") || (estado === "doble" && c === '"') || (estado === "template" && c === "`")) {
      estado = "codigo";
    }
    salida += c;
  }
  return salida;
}

function archivos(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : archivos(completo);
    return EXTENSIONES.has(path.extname(e.name)) ? [completo] : [];
  });
}

/** El texto de una sentencia desde `inicio` hasta el `;` que la cierra (o el fin del archivo). */
function sentencia(texto: string, inicio: number): string {
  const fin = texto.indexOf(";", inicio);
  return texto.slice(inicio, fin === -1 ? undefined : fin);
}

const tocaEstado = (s: string) => /\b(etapa|pendiente)\b/.test(s);
const PATRONES: { nombre: string; buscar: RegExp; tocaEtapa: (s: string) => boolean }[] = [
  {
    nombre: "update(deals) que toca etapa o pendiente",
    buscar: /\.update\(\s*deals\s*\)/g,
    tocaEtapa: tocaEstado,
  },
  {
    nombre: "SQL crudo que actualiza etapa o pendiente de deals",
    buscar: /\bupdate\b/gi,
    tocaEtapa: (s) => /\bdeals\b/.test(s) && tocaEstado(s) && /\bset\b/i.test(s),
  },
  {
    nombre: "editarConRastro sobre deals con etapa o pendiente",
    buscar: /\beditarConRastro\s*\(/g,
    tocaEtapa: (s) => /\bdeals\b/.test(s) && tocaEstado(s),
  },
  {
    // La llave con la que `abrirDeal()` le dice a `crearConRastro` que la etapa viene del
    // motor. Fuera del motor, es alguien abriendo un deal sin historial.
    nombre: "la llave del motor (desdeElMotor) fuera del motor",
    buscar: /\bdesdeElMotor\s*:\s*true\b/g,
    tocaEtapa: () => true,
  },
];

function escriturasDeEtapa(raiz: string): string[] {
  const hallazgos: string[] = [];
  for (const dir of DIRECTORIOS) {
    for (const archivo of archivos(path.join(raiz, dir))) {
      const relativo = path.relative(raiz, archivo);
      if (relativo === MOTOR) continue;
      const texto = sinComentarios(fs.readFileSync(archivo, "utf8"));
      for (const { nombre, buscar, tocaEtapa } of PATRONES) {
        for (const m of texto.matchAll(buscar)) {
          // `.update(deals)` de drizzle tambien casa con la regla del SQL crudo; se cuenta una vez.
          if (nombre.startsWith("SQL") && /\.\s*$/.test(texto.slice(0, m.index))) continue;
          if (!tocaEtapa(sentencia(texto, m.index!))) continue;
          const linea = texto.slice(0, m.index).split("\n").length;
          hallazgos.push(`${relativo}:${linea}: ${nombre}`);
        }
      }
    }
  }
  return hallazgos.sort();
}

describe("nadie escribe deals.etapa fuera del motor (ADR 0037, ticket 046)", () => {
  it("el codigo de la app no escribe la etapa por fuera de moverEtapa()", () => {
    const violaciones = escriturasDeEtapa(RAIZ);
    expect(
      violaciones,
      "Estas lineas escriben deals.etapa sin pasar por el motor. Usa moverEtapa() de " +
        "lib/deals/mover-etapa.ts: valida la flecha y lo que le falta al deal, y escribe el " +
        `historial. Una etapa sin historial no lanza ningun error, solo miente:\n${violaciones.join("\n")}`,
    ).toEqual([]);
  });

  // Mordido en los dos sentidos sobre un arbol temporal controlado.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "motor-etapas-"));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("caza las tres escrituras clandestinas y no marca ni la prosa, ni otras columnas, ni el motor", () => {
    const lib = path.join(tmp, "lib", "mutations");
    const motor = path.join(tmp, "lib", "deals");
    fs.mkdirSync(lib, { recursive: true });
    fs.mkdirSync(motor, { recursive: true });

    fs.writeFileSync(
      path.join(lib, "sucio.ts"),
      [
        "export async function cerrar(db: Db, id: string) {",
        "  await db",
        "    .update(deals)",
        "    .set({ etapa: 'ganado_completo', pendiente: null })",
        "    .where(eq(deals.id, id));",
        "  await db.execute(sql`update deals set pendiente = null where id = ${id}`);",
        "  await editarConRastro({ db, tabla: deals, nombreTabla: 'deals', actorId, etiqueta }, id, { pendiente: null });",
        "  await crearConRastro({ db, tabla: deals, nombreTabla: 'deals', actorId, etiqueta, desdeElMotor: true }, valores);",
        "}",
      ].join("\n"),
    );

    fs.writeFileSync(
      path.join(lib, "limpio.ts"),
      [
        "// Aqui se habla de la etapa y de update deals en prosa: no cuenta.",
        "/* update deals set etapa = x, tambien en prosa */",
        "export async function editar(db: Db, id: string) {",
        "  await editarConRastro({ db, tabla: deals, nombreTabla: 'deals', actorId, etiqueta }, id, {});",
        "  const lista = await db.select({ etapa: deals.etapa }).from(deals);",
        "  return moverEtapa(db, { dealId: id, a: 'contactado', actor });",
        "}",
      ].join("\n"),
    );

    // El motor escribe la etapa, y es el unico que puede.
    fs.writeFileSync(
      path.join(motor, "mover-etapa.ts"),
      "await tx.update(deals).set({ etapa: mov.a, pendiente: mov.pendiente }).where(and(eq(deals.id, id), eq(deals.etapa, de)));",
    );

    expect(escriturasDeEtapa(tmp)).toEqual([
      path.join("lib", "mutations", "sucio.ts") + ":3: update(deals) que toca etapa o pendiente",
      path.join("lib", "mutations", "sucio.ts") + ":6: SQL crudo que actualiza etapa o pendiente de deals",
      path.join("lib", "mutations", "sucio.ts") + ":7: editarConRastro sobre deals con etapa o pendiente",
      path.join("lib", "mutations", "sucio.ts") + ":8: la llave del motor (desdeElMotor) fuera del motor",
    ]);
  });
});
