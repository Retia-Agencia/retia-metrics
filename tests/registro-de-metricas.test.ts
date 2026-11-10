import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { insertarBloque, MARCA_FIN, MARCA_INICIO, renderizarFichas } from "@/lib/metricas/ficha";
import {
  CONCEPTO_DE_OBJETIVO, CONCEPTO_DE_PAUTA_SEMANAL, PENDIENTES_DE_REGISTRO, TOPE_DE_PENDIENTES,
  TOPE_PENDIENTES_DE_OBJETIVO, TOPE_PENDIENTES_DE_PAUTA_SEMANAL, TOPE_TOTAL, type DestinoDeUnaClave,
} from "@/lib/metricas/pendientes";
import { METRICAS_OBJETIVO } from "@/lib/objetivos/metricas";
import { REGISTRO, type ClaveRegistrada, type FichaDeMetrica, type ReferenciaAFuncion } from "@/lib/metricas/registro";
import { METRICAS_DE_LISTA } from "@/lib/queries/filtros-de-lista";
import { nombreCorto, VOCABULARIO } from "@/lib/vocabulario-metricas";

/**
 * Ticket 385 F4 (ADR 0120, contrato `docs/contrato-metricas-y-datos.md` §1 paso 5): el registro tipado de
 * métricas y el diccionario `docs/metricas.md` no divergen. Cinco guardianes: (1) cada clave del vocabulario
 * está registrada o pendiente, nunca las dos, y los pendientes solo encogen; (2) la forma de cada ficha;
 * (3) cada función citada existe y tiene un llamador fuera de `tests/` (N7); (4) el bloque generado de
 * §3.0 está al día y cada concepto tiene su prosa en §3.1; (5) el nombre aparece en el glosario §11.
 */
const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["lib", "app", "components", "scripts"];
const IGNORADOS = new Set(["lib/metricas/registro.ts", "lib/metricas/ficha.ts", "lib/metricas/pendientes.ts"]);

function archivosDeCodigo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return entrada.name === "node_modules" || entrada.name === ".next" ? [] : archivosDeCodigo(ruta);
    return /\.(ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

const CODIGO = CARPETAS.flatMap((c) => archivosDeCodigo(join(RAIZ, c))).map((ruta) => ({
  ruta: relative(RAIZ, ruta).split("\\").join("/"),
  texto: readFileSync(ruta, "utf8"),
}));

export function exportaLaFuncion(texto: string, nombre: string): boolean {
  return new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${nombre}\\b`).test(texto);
}

/**
 * Un llamador es un archivo de código (no de `tests/`) que usa el nombre en una línea que no es su definición ni
 * un re-export. El propio archivo cuenta si la usa en otra línea (`dineroDeVentas` llama a `dineroDeSaldos`).
 */
export function llamadoresFueraDeTests(archivo: string, nombre: string, codigo = CODIGO): string[] {
  const palabra = new RegExp(`\\b${nombre}\\b`);
  const definicion = new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${nombre}\\b`);
  return codigo
    .filter((c) => !IGNORADOS.has(c.ruta))
    .filter((c) => c.texto.split("\n").some((linea) =>
      palabra.test(linea) && !definicion.test(linea) && !/^\s*export\s*\{.*\}\s*from/.test(linea)))
    .map((c) => c.ruta);
}

const DOC = readFileSync(join(RAIZ, "docs/metricas.md"), "utf8");
const GLOSARIO = (() => {
  const overview = readFileSync(join(RAIZ, "docs/overview.md"), "utf8");
  const desde = overview.indexOf("## 11. Vocabulario");
  const resto = overview.slice(desde + 5);
  const hasta = resto.search(/\n## /);
  return hasta === -1 ? resto : resto.slice(0, hasta);
})();

const claves = Object.keys(REGISTRO) as ClaveRegistrada[];
const referencias = (f: FichaDeMetrica): ReferenciaAFuncion[] => [f.funcionSql, ...(f.gemelaTs ? [f.gemelaTs] : [])];

function filaDeProsa(nombre: string): string[] | null {
  const desde = DOC.indexOf("### 3.1 Embudo y ventas");
  const hasta = DOC.indexOf("### 3.2 Pauta");
  const linea = DOC.slice(desde, hasta).split("\n").find((l) => l.startsWith(`| ${nombre} |`));
  return linea ? linea.replace(/^\|\s*/, "").replace(/\s*\|\s*$/, "").split(" | ") : null;
}

describe("registro de métricas (ADR 0120)", () => {
  it("cada clave del vocabulario está registrada o pendiente, nunca las dos, y los pendientes solo encogen", () => {
    const delVocabulario = Object.keys(VOCABULARIO).sort();
    const cubiertas = [...claves, ...PENDIENTES_DE_REGISTRO].sort();
    expect(cubiertas).toEqual(delVocabulario);
    expect(claves.filter((c) => (PENDIENTES_DE_REGISTRO as readonly string[]).includes(c))).toEqual([]);
    expect(PENDIENTES_DE_REGISTRO).toHaveLength(TOPE_DE_PENDIENTES);
  });

  it("el trinquete cubre también la tabla semanal de Pauta y los objetivos, con el tope a la vista", () => {
    const hub = new Set<string>([...claves, ...PENDIENTES_DE_REGISTRO]);
    const mapas: Array<[string, Record<string, DestinoDeUnaClave>, number]> = [
      ["tabla semanal", CONCEPTO_DE_PAUTA_SEMANAL, TOPE_PENDIENTES_DE_PAUTA_SEMANAL],
      ["objetivos", CONCEPTO_DE_OBJETIVO, TOPE_PENDIENTES_DE_OBJETIVO],
    ];
    for (const [nombre, mapa, tope] of mapas) {
      const propios = Object.values(mapa).filter((d) => d === "pendiente" || d === "retirar");
      expect(propios, `${nombre}: el tope no coincide con los pendientes`).toHaveLength(tope);
      for (const destino of Object.values(mapa)) {
        if (destino !== "pendiente" && destino !== "retirar") expect(hub.has(destino), `${nombre}: ${destino} no está cubierto`).toBe(true);
      }
    }
    expect(Object.keys(CONCEPTO_DE_OBJETIVO).sort()).toEqual([...METRICAS_OBJETIVO].sort());
    expect(TOPE_TOTAL).toBe(TOPE_DE_PENDIENTES + TOPE_PENDIENTES_DE_PAUTA_SEMANAL + TOPE_PENDIENTES_DE_OBJETIVO);
  });

  it("la forma de cada ficha es coherente: derivadas y razones nombran conceptos ya registrados", () => {
    for (const clave of claves) {
      const f: FichaDeMetrica = REGISTRO[clave];
      if (f.tipo === "simple") expect(f.de, `${clave} simple no lleva "de"`).toBeUndefined();
      else {
        expect(f.de?.length ?? 0, `${clave} necesita "de"`).toBeGreaterThan(0);
        for (const origen of f.de ?? []) expect(claves as string[], `${clave} depende de ${origen}`).toContain(origen);
      }
      if (f.tipo === "razon") expect(f.cobertura, `${clave} es razón`).toBe("razon_con_cobertura");
      if (f.unidad === "dinero") expect(f.monedas.length, `${clave} es dinero y necesita moneda`).toBeGreaterThan(0);
      else expect(f.monedas, `${clave} no es dinero`).toEqual([]);
    }
  });

  it("cada id de lista está en el tipo `Metrica` y pertenece a un solo concepto", () => {
    const ids = claves.flatMap((c) => [...REGISTRO[c].listas]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(METRICAS_DE_LISTA as readonly string[]).toContain(id);
  });

  it("cada función citada existe en su archivo y tiene un llamador fuera de tests/ (N7)", () => {
    for (const clave of claves) {
      for (const ref of referencias(REGISTRO[clave])) {
        const definicion = CODIGO.find((c) => c.ruta === ref.archivo);
        expect(definicion, `${clave}: ${ref.archivo} no existe`).toBeDefined();
        expect(exportaLaFuncion(definicion!.texto, ref.nombre), `${clave}: ${ref.nombre} no se exporta de ${ref.archivo}`).toBe(true);
        expect(llamadoresFueraDeTests(ref.archivo, ref.nombre).length, `${clave}: ${ref.nombre} no tiene llamador fuera de tests/`)
          .toBeGreaterThan(0);
      }
    }
  });

  it("el guardián de funciones muerde en los dos sentidos", () => {
    const falso = [{ ruta: "lib/x.ts", texto: "export function soloLoDefine() {}" }, { ruta: "lib/y.ts", texto: "export { soloLoDefine } from \"./x\";" }];
    expect(exportaLaFuncion("export async function hola() {}", "hola")).toBe(true);
    expect(exportaLaFuncion("function hola() {}", "hola")).toBe(false);
    expect(llamadoresFueraDeTests("lib/x.ts", "soloLoDefine", falso)).toEqual([]);
    expect(llamadoresFueraDeTests("lib/x.ts", "ayuda", [{ ruta: "lib/x.ts", texto: "export function ayuda() {}\nayuda();" }])).toEqual(["lib/x.ts"]);
    expect(llamadoresFueraDeTests("lib/x.ts", "soloLoDefine", [...falso, { ruta: "app/p.tsx", texto: "soloLoDefine();" }])).toEqual(["app/p.tsx"]);
  });

  it("el bloque generado de docs/metricas.md §3.0 está al día con el registro", () => {
    const desde = DOC.indexOf(MARCA_INICIO);
    const hasta = DOC.indexOf(MARCA_FIN);
    expect(desde, "faltan las marcas de §3.0").toBeGreaterThan(-1);
    const actual = DOC.slice(desde, hasta + MARCA_FIN.length);
    expect(actual, "corre `npm run docs:metricas`").toBe(renderizarFichas());
  });

  it("el generador muerde: un registro distinto da otro bloque y sin marcas lanza", () => {
    const otro = { ...REGISTRO, ventas: { ...REGISTRO.ventas, sumaEntreProgramas: false } };
    expect(renderizarFichas(otro)).not.toBe(renderizarFichas());
    expect(() => insertarBloque("sin marcas", renderizarFichas())).toThrow(/marcas/);
    expect(insertarBloque(`a\n${MARCA_INICIO}\nviejo\n${MARCA_FIN}\nb`, "NUEVO")).toBe("a\nNUEVO\nb");
  });

  it("cada concepto registrado tiene su fila de prosa en §3.1 y la fila cita su función y su suma entre programas", () => {
    for (const clave of claves) {
      const f: FichaDeMetrica = REGISTRO[clave];
      const celdas = filaDeProsa(f.filaDelDiccionario);
      expect(celdas, `${clave}: falta la fila "${f.filaDelDiccionario}" en §3.1`).not.toBeNull();
      expect(celdas![4], `${clave}: la fila no cita ${f.funcionSql.nombre}`).toContain(f.funcionSql.nombre);
      expect(celdas![3], `${clave}: ¿se suma entre programas?`).toBe(f.sumaEntreProgramas ? "sí" : "no");
    }
  });

  it("el nombre de cada concepto registrado aparece en el glosario de overview.md §11", () => {
    for (const clave of claves) expect(GLOSARIO, `${clave}: "${nombreCorto(clave)}" no está en §11`).toContain(nombreCorto(clave));
  });

  it("existen los archivos que el contrato cita", () => {
    expect(existsSync(join(RAIZ, "docs/metricas.md"))).toBe(true);
  });
});
