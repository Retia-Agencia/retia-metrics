import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as schema from "@/lib/db/schema";

/**
 * ADR 0026 punto 3 — regla verificable: **ninguna consulta lee `calls`, `sales` o
 * `abonos` sin excluir lo anulado**, y la exclusion no se escribe a mano: viene de
 * `vigente(tabla)` en `lib/queries/vigente.ts` (ADR 0024, una sola definicion).
 *
 * Por que un guardian y no cuidado al escribir: si una consulta del embudo se olvida
 * del filtro, **la cifra sale inflada y no lanza ningun error**. Dos pantallas
 * muestran numeros distintos de lo mismo y nadie se entera hasta que el dinero no
 * cuadra. Es el mismo fallo que costo la primera version de `/nerd-stats` (conteos en
 * cero, sin excepcion, destapados por un test que ya estaba escrito).
 *
 * **La unidad de analisis es la CADENA de drizzle**, no el archivo ni el statement de
 * JavaScript. Dentro de una funcion no hay ningun `;` a profundidad cero, asi que
 * cortar por statements mete la funcion entera —o el archivo entero— en una sola
 * unidad y el guardian pierde toda precision: diria "este archivo olvida abonos" sin
 * decir cual de sus seis consultas. Una cadena (`db.select(...).from(x).where(...)`)
 * es exactamente lo que ejecuta una consulta, y es la granularidad en la que se
 * arregla el problema.
 *
 * **Mira TODO el codigo, no solo `lib/queries/`.** El ADR dice "toda consulta sobre
 * esas tres tablas", y una metrica escrita dentro de una pagina o de una mutacion
 * cuenta igual. Acotarlo a un directorio habria dejado el agujero justo donde nadie
 * lo busca: cuatro lecturas de `calls`, `sales` y `abonos` viven hoy en
 * `lib/mutations/`.
 *
 * Mismo molde que el guardian de slugs del ticket 009 (`tests/contrato-extension.test.ts`):
 * analisis de texto sobre el arbol real, y una prueba aparte de que el detector no es
 * trivial sobre un arbol temporal controlado.
 */

const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/** Las tres tablas que ganan `anulado_en` en el ticket 029. */
const TABLAS_ANULABLES = ["calls", "sales", "abonos"] as const;

/** El unico modulo autorizado a saber como se escribe "esta vigente". */
const MODULO_DEL_PREDICADO = path.join("lib", "queries", "vigente.ts");

/** Todo el codigo de la app. `tests/` queda fuera: es quien prueba la regla. */
const DIRECTORIOS = ["lib", "app", "components", "scripts"];

/** Extensiones que se inspeccionan. */
const EXTENSIONES = new Set([".ts", ".tsx"]);

/**
 * Todo lo que exporta el esquema. Sirve para distinguir `.from(sales)` —una tabla
 * que el guardian conoce— de `.from(tabla)`, donde la tabla entra por parametro y el
 * texto no alcanza a decir cual es. Ese segundo caso NO se deja pasar: una funcion
 * generica que recibe la tabla puede recibir una anulable, asi que tiene que aplicar
 * el predicado igual. Es justo la forma de `conteosPorPrograma` en `/nerd-stats`.
 */
const NOMBRES_DEL_ESQUEMA = new Set(Object.keys(schema));

/**
 * Excepciones explicitas, por ruta relativa. HOY ESTA VACIA A PROPOSITO.
 *
 * Una entrada aqui es una consulta que lee lo anulado a sabiendas, y tiene que
 * justificarse en este comentario. Ojo: "la pantalla muestra lo anulado tachado"
 * (ADR 0026 punto 4) NO es una excepcion valida — esa consulta pide lo anulado
 * explicitamente, asi que se escribe con su propia funcion de `vigente.ts`
 * (p.ej. `incluyendoAnulados`), no saltandose la regla.
 */
const EXCEPCIONES: readonly string[] = [];

/**
 * Archivos donde un `.from(x)` con la tabla por PARAMETRO no exige predicado.
 *
 * El molde de catalogo (ADR 0012) es generico sobre tablas de catalogo —plataformas
 * de pago, motivos, origenes, productos—, **ninguna de las cuales se anula**: esas se
 * desactivan (`activo = false`), que es otra cosa. Exigirles vigencia seria pedir un
 * filtro sobre una columna que no existe.
 *
 * Las tablas anulables escritas con su nombre SIGUEN vigiladas en estos archivos: la
 * excepcion es solo para el parametro. Si algun dia una tabla anulable entra al
 * molde, esta lista hay que revisarla.
 */
const GENERICOS_SOBRE_CATALOGOS: readonly string[] = [
  path.join("lib", "catalogo", "molde.ts"),
  path.join("lib", "catalogo", "versionar.ts"),
];

/** Metodos de drizzle que reciben una tabla como primer argumento. */
const METODOS_CON_TABLA = ["from", "leftJoin", "innerJoin", "rightJoin", "fullJoin", "join"];

/**
 * Reemplaza comentarios y cadenas literales por espacios, conservando los saltos de
 * linea (para que los numeros de linea sigan siendo los del archivo real).
 *
 * Hay que borrarlos antes de mirar nada: este repo comenta en espanol y las palabras
 * "abonos", "sales" y "calls" aparecen en prosa por todas partes. Lo que SI se
 * conserva es el interior de los templates `sql`, porque ahi `${abonos.monto}` es una
 * lectura de verdad.
 */
function limpiar(fuente: string): string {
  const salida: string[] = [];
  const pila: string[] = [];
  let estado: "codigo" | "linea" | "bloque" | "simple" | "doble" | "template" = "codigo";
  let i = 0;

  const blanco = (c: string) => (c === "\n" ? "\n" : " ");

  while (i < fuente.length) {
    const c = fuente[i];
    const par = fuente.slice(i, i + 2);

    if (estado === "codigo") {
      if (par === "//") { estado = "linea"; salida.push(" ", " "); i += 2; continue; }
      if (par === "/*") { estado = "bloque"; salida.push(" ", " "); i += 2; continue; }
      if (c === "'") { estado = "simple"; salida.push(" "); i += 1; continue; }
      if (c === '"') { estado = "doble"; salida.push(" "); i += 1; continue; }
      if (c === "`") { pila.push("`"); estado = "template"; }
      else if (c === "{") pila.push("{");
      else if (c === "}" && pila.pop() === "${") {
        // Se cierra una interpolacion: lo que sigue vuelve a ser texto del template.
        // Sin esta rama, a partir del primer `${...}` el resto del archivo se lee en
        // el estado equivocado y las cadenas de drizzle salen cortadas por la mitad.
        estado = "template";
      }
      salida.push(c); i += 1; continue;
    }

    if (estado === "linea") {
      if (c === "\n") estado = "codigo";
      salida.push(blanco(c)); i += 1; continue;
    }

    if (estado === "bloque") {
      if (par === "*/") { estado = "codigo"; salida.push(" ", " "); i += 2; continue; }
      salida.push(blanco(c)); i += 1; continue;
    }

    if (estado === "simple" || estado === "doble") {
      if (c === "\\") { salida.push(" ", " "); i += 2; continue; }
      if ((estado === "simple" && c === "'") || (estado === "doble" && c === '"')) estado = "codigo";
      salida.push(blanco(c)); i += 1; continue;
    }

    // estado === "template": se conserva tal cual; `${` devuelve a codigo.
    if (c === "\\") { salida.push(fuente[i], fuente[i + 1] ?? ""); i += 2; continue; }
    if (par === "${") { pila.push("${"); estado = "codigo"; salida.push("$", "{"); i += 2; continue; }
    if (c === "`") { pila.pop(); estado = "codigo"; }
    salida.push(c); i += 1;
  }

  return salida.join("");
}

const ESPACIO = /\s/;
const IDENT = /[A-Za-z0-9_$]/;

/** Indice del parentesis/corchete que cierra el que abre en `abre`. */
function cierreDe(texto: string, abre: number): number {
  const pares: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const fin = pares[texto[abre]];
  let nivel = 0;
  for (let i = abre; i < texto.length; i += 1) {
    if (texto[i] === texto[abre]) nivel += 1;
    else if (texto[i] === fin) {
      nivel -= 1;
      if (nivel === 0) return i;
    }
  }
  return -1;
}

/**
 * Una cadena de llamadas encadenadas: `db.select({...}).from(x).where(...)`.
 * Devuelve su texto y donde empieza.
 *
 * Se localiza a partir de cada `.from(`, caminando hacia atras por los eslabones
 * (`.metodo(...)`) hasta el identificador raiz, y luego hacia adelante hasta que se
 * acaban los eslabones. Asi una funcion con tres consultas produce tres unidades.
 */
function cadenasDe(limpio: string): { texto: string; desde: number }[] {
  const cadenas: { texto: string; desde: number }[] = [];

  for (let i = 0; i < limpio.length; i += 1) {
    if (!limpio.startsWith(".from(", i)) continue;

    // Hacia atras: saltar eslabones `.identificador(...)` hasta la raiz.
    let p = i;
    for (;;) {
      let q = p - 1;
      while (q >= 0 && ESPACIO.test(limpio[q])) q -= 1;
      if (q >= 0 && limpio[q] === ")") {
        const abre = (() => {
          let nivel = 0;
          for (let k = q; k >= 0; k -= 1) {
            if (limpio[k] === ")") nivel += 1;
            else if (limpio[k] === "(") { nivel -= 1; if (nivel === 0) return k; }
          }
          return -1;
        })();
        if (abre < 0) break;
        q = abre - 1;
      }
      while (q >= 0 && ESPACIO.test(limpio[q])) q -= 1;
      const fin = q;
      while (q >= 0 && IDENT.test(limpio[q])) q -= 1;
      if (q === fin) break; // no habia identificador: se acabo la cadena
      while (q >= 0 && ESPACIO.test(limpio[q])) q -= 1;
      if (q >= 0 && limpio[q] === ".") { p = q; continue; }
      p = q + 1;
      while (p < limpio.length && ESPACIO.test(limpio[p])) p += 1;
      break;
    }

    // Hacia adelante: consumir eslabones mientras sigan.
    let j = i;
    for (;;) {
      while (j < limpio.length && ESPACIO.test(limpio[j])) j += 1;
      if (limpio[j] !== ".") break;
      j += 1;
      while (j < limpio.length && ESPACIO.test(limpio[j])) j += 1;
      while (j < limpio.length && IDENT.test(limpio[j])) j += 1;
      while (j < limpio.length && ESPACIO.test(limpio[j])) j += 1;
      if (limpio[j] === "(") {
        const cierra = cierreDe(limpio, j);
        if (cierra < 0) break;
        j = cierra + 1;
      }
    }

    const texto = limpio.slice(p, j);
    // Solo las cadenas de drizzle. `Buffer.from(b64, "base64")` y `Array.from(x)`
    // tambien traen `.from(`, y sin este filtro el guardian pide vigencia sobre una
    // variable local. Un guardian que grita por cosas que no son consultas se apaga
    // a la tercera falsa alarma, y entonces ya no guarda nada.
    //
    // `.select(` alcanza porque este repo no usa la API relacional de drizzle
    // (`db.query.tabla.findMany()`), verificado por grep. Si algun dia se usa, este
    // guardian no la veria: no tiene `.from(`. Quedaria que anotarlo aca.
    if (/\.select\s*\(/.test(texto)) cadenas.push({ texto, desde: p });
    i = j - 1;
  }

  return cadenas;
}

/** Primer argumento (en texto) de cada `.from(` / `.leftJoin(` / … de la cadena. */
function tablasDeFromYJoins(cadena: string): string[] {
  const encontradas: string[] = [];
  for (const metodo of METODOS_CON_TABLA) {
    const marca = `.${metodo}(`;
    let i = cadena.indexOf(marca);
    while (i !== -1) {
      const abre = i + marca.length - 1;
      const cierra = cierreDe(cadena, abre);
      if (cierra > 0) {
        const args = cadena.slice(abre + 1, cierra);
        encontradas.push(args.split(",")[0].trim());
      }
      i = cadena.indexOf(marca, i + 1);
    }
  }
  return encontradas;
}

/** Tablas anulables referenciadas por columna (`abonos.monto`) dentro de la cadena. */
function tablasPorColumna(cadena: string): string[] {
  return TABLAS_ANULABLES.filter((t) => new RegExp(`\\b${t}\\s*\\.`).test(cadena));
}

/**
 * Los dos predicados que `lib/queries/vigente.ts` autoriza, y no hay mas.
 *
 * `incluyendoAnulados` no filtra nada: lo que aporta es el nombre. Existe porque el
 * historial de `/personas/[id]` SI muestra lo anulado (ADR 0026 punto 4), y una
 * consulta que lo pide tiene que decirlo en voz alta.
 *
 * Si, alguien podria silenciar el guardian escribiendo `incluyendoAnulados` donde
 * tocaba `vigente`. **Eso es aceptable y es el punto:** el guardian existe para que
 * ninguna consulta se olvide EN SILENCIO. Una llamada con ese nombre aparece en el
 * diff, en el grep y en la revision; un filtro que nunca se escribio, no.
 */
const PREDICADOS = ["vigente", "incluyendoAnulados"];

/** La cadena aplica alguno de los predicados centrales sobre ese identificador. */
function tieneElPredicado(cadena: string, tabla: string): boolean {
  const nombre = tabla.replace(/\$/g, "\\$");
  return PREDICADOS.some((p) => new RegExp(`${p}\\s*\\(\\s*${nombre}\\s*[),]`).test(cadena));
}

/** Todos los archivos de codigo bajo `dir`, recursivo, con `node:fs` a secas. */
function archivosDeCodigo(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const encontrados: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...archivosDeCodigo(completo));
    else if (EXTENSIONES.has(path.extname(entrada.name))) encontrados.push(completo);
  }
  return encontrados;
}

/**
 * Recorre todo el codigo y devuelve las consultas que leen una tabla anulable —o una
 * tabla que entra por parametro— sin aplicar el predicado.
 */
function consultasSinPredicado(raiz: string): string[] {
  const violaciones: string[] = [];

  for (const dir of DIRECTORIOS) {
    for (const archivo of archivosDeCodigo(path.join(raiz, dir))) {
      const ruta = path.relative(raiz, archivo);
      if (ruta === MODULO_DEL_PREDICADO || EXCEPCIONES.includes(ruta)) continue;

      const limpio = limpiar(fs.readFileSync(archivo, "utf8"));
      for (const { texto, desde } of cadenasDe(limpio)) {
        const linea = limpio.slice(0, desde).split("\n").length;
        const sospechosas = new Set<string>();

        for (const arg of tablasDeFromYJoins(texto)) {
          // Un nombre del esquema que no es anulable (leads, programs, users…) no
          // tiene nada que excluir. Todo lo demas si: una anulable, o una tabla que
          // llega por parametro y podria ser cualquiera.
          const conocida = NOMBRES_DEL_ESQUEMA.has(arg);
          if (conocida && !TABLAS_ANULABLES.includes(arg as never)) continue;
          if (!conocida && GENERICOS_SOBRE_CATALOGOS.includes(ruta)) continue;
          if (!IDENT.test(arg[0] ?? "")) continue;
          sospechosas.add(arg);
        }
        for (const t of tablasPorColumna(texto)) sospechosas.add(t);

        for (const tabla of [...sospechosas].sort()) {
          if (!tieneElPredicado(texto, tabla)) {
            violaciones.push(`${ruta}:${linea}: lee '${tabla}' sin vigente(${tabla})`);
          }
        }
      }
    }
  }
  return violaciones;
}

describe("vigencia centralizada (ADR 0026)", () => {
  it("el predicado vive en un solo modulo y se llama vigente(tabla)", async () => {
    const modulo = (await import("@/lib/queries/vigente")) as Record<string, unknown>;
    expect(typeof modulo.vigente).toBe("function");
  });

  it("ninguna consulta del repo lee calls, sales o abonos sin vigente(tabla)", () => {
    const violaciones = consultasSinPredicado(RAIZ);
    expect(
      violaciones,
      `El ADR 0026 exige excluir lo anulado en TODA metrica, con el predicado de ` +
        `${MODULO_DEL_PREDICADO}. Una cifra sin el sale inflada y no lanza error:\n` +
        violaciones.join("\n"),
    ).toEqual([]);
  });

  // Prueba de que el detector no es trivial: sobre un arbol temporal controlado
  // separa consulta por consulta dentro de un mismo archivo, distingue tabla por
  // tabla dentro de una misma consulta, y deja pasar lo limpio, la prosa y los tipos.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vigencia-"));

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("detecta la consulta sin predicado y no confunde prosa, cadenas ni tipos", () => {
    const dir = path.join(tmp, "lib", "queries");
    fs.mkdirSync(dir, { recursive: true });

    // Limpia: filtra las dos tablas que lee, una en el where y otra en el join.
    fs.writeFileSync(
      path.join(dir, "limpia.ts"),
      [
        "export async function caja(db: Db) {",
        "  return db",
        "    .select({ total: sql`sum(${abonos.monto})` })",
        "    .from(abonos)",
        "    .leftJoin(sales, and(eq(sales.id, abonos.saleId), vigente(sales)))",
        "    .where(and(eq(abonos.programId, p), vigente(abonos)));",
        "}",
      ].join("\n"),
    );

    // Sucia: dos consultas en la MISMA funcion. La primera esta bien; la segunda
    // filtra `sales` pero se olvida de `abonos` en el join — EL error que este
    // guardian existe para atrapar: la caja seguiria sumando abonos anulados.
    fs.writeFileSync(
      path.join(dir, "sucia.ts"),
      [
        "export async function ventas(db: Db) {",
        "  const llamadas = await db",
        "    .select({ n: count() })",
        "    .from(calls)",
        "    .where(and(eq(calls.programId, p), vigente(calls)));",
        "  const filas = await db",
        "    .select({ id: sales.id, abonado: ABONADO })",
        "    .from(sales)",
        "    .leftJoin(abonos, eq(abonos.saleId, sales.id))",
        "    .where(vigente(sales));",
        "  return { llamadas, filas };",
        "}",
      ].join("\n"),
    );

    // Tabla por parametro: el texto no dice cual es, asi que tiene que filtrar igual.
    fs.writeFileSync(
      path.join(dir, "generica.ts"),
      [
        "export const porPrograma = (tabla: Tabla, columna: Columna) =>",
        "  db.select({ total: count() }).from(tabla).groupBy(columna);",
      ].join("\n"),
    );

    // El historial: pide lo anulado a proposito y lo dice con su nombre. Pasa.
    fs.writeFileSync(
      path.join(dir, "historial.ts"),
      [
        "export async function historial(db: Db) {",
        "  return db",
        "    .select({ id: calls.id })",
        "    .from(calls)",
        "    .where(and(eq(calls.personId, id), incluyendoAnulados(calls)));",
        "}",
      ].join("\n"),
    );

    // Ruido: prosa en espanol que nombra las tablas, una cadena y un tipo. Nada de
    // esto es una consulta, asi que no puede aparecer como violacion.
    fs.writeFileSync(
      path.join(dir, "ruido.ts"),
      [
        "// La caja recaudada suma abonos; las ventas cerradas cuentan sales.",
        "/* calls no se lee aqui: este modulo no consulta nada. */",
        "export const ETIQUETA = 'abonos del dia, sin calls ni sales';",
        "export interface Fila { total: typeof sales.precioAplicadoUsd }",
        // Dos `.from(` que no son consultas. Sin distinguirlos, el guardian pide
        // vigencia sobre una variable local — y uno que grita por cosas que no son
        // consultas se apaga a la tercera falsa alarma.
        "export const leer = (b64: string) => Buffer.from(b64, 'base64').toString();",
        "export const lista = (xs: Set<string>) => Array.from(xs);",
      ].join("\n"),
    );

    expect(consultasSinPredicado(tmp)).toEqual([
      `${path.join("lib", "queries", "generica.ts")}:2: lee 'tabla' sin vigente(tabla)`,
      `${path.join("lib", "queries", "sucia.ts")}:6: lee 'abonos' sin vigente(abonos)`,
    ]);
  });
});
