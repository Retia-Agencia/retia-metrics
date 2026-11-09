import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Contrato de métricas y datos §8 (6), ADR 0115 N7: "reemplazar es borrar, y cada función que cita el
 * diccionario tiene un llamador fuera de `tests/`". Una función que solo llama un test está muerta y no
 * cuenta como cobertura; una que el diccionario cita y no existe es un cheque sin fondos.
 *
 * Qué mira: cada identificador entre acentos graves de `docs/metricas.md` con forma de función o constante
 * del código (camelCase, `nombre()` o MAYUS_CON_GUION). Se clasifica contra el código de `lib/`, `app/`,
 * `components/` y `scripts/` (sin `tests/`, sin comentarios):
 *   - inexistente: el nombre no aparece en ninguna parte (ni función, ni campo, ni tipo);
 *   - sin llamador: está definido, pero no tiene ninguna referencia más allá de su definición.
 * Las violaciones de hoy son una lista NOMBRADA con el ticket que las retira (F1 H-29). El guardián falla
 * también si una excepción deja de ser violación (sin excepciones zombi): quien la arregla la borra de aquí.
 */
const RAIZ = process.cwd();
const CARPETAS_DE_CODIGO = ["lib", "app", "components", "scripts"];

/**
 * Citadas por el diccionario y que no existen en el código. El diccionario las cita a propósito como
 * borradas o con el nombre viejo (`showPorDeal` y `ocurrioSql` ya existen desde el 353).
 * Límite honesto: un nombre que existe como alias local o variable (`showPorCita` en `vista-hoy.ts`,
 * `agruparEnvios` como alias de import) cuenta como aparición y no se caza; F1 H-29 los llamaba inexistentes.
 */
const INEXISTENTES_CONOCIDAS: Record<string, string> = {
  armarMensaje: "ticket 361: M §3.3 cita el nombre viejo; la real es armarMensajeDeLaHora",
  categoriaDe: "ticket 354: la fila de M §0 la cita como borrada a propósito",
};

/** Definidas y citadas, sin un solo llamador fuera de su definición (F1 H-29). */
const SIN_LLAMADOR_CONOCIDAS: Record<string, string> = {
  tasaDelDia: "ticket 361: la usada es tasasDelRango; M §1.8 cita la equivocada",
};

function lineaDeDefinicion(nombre: string): RegExp {
  return new RegExp(`(?:^|[^\\w$])(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function\\*?|const|let|var|class|enum)\\s+${nombre}\\b`, "g");
}

export type Hallazgos = { inexistentes: string[]; sinLlamador: string[] };

/** Identificadores del diccionario que parecen del código. */
export function citadosEn(doc: string): string[] {
  const salida = new Set<string>();
  for (const m of doc.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)(\(\))?`/g)) {
    const nombre = m[1];
    const llamada = m[2] === "()";
    const camel = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/.test(nombre);
    const constante = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(nombre);
    const unaPalabra = /^[a-z][a-z0-9]*$/.test(nombre);
    if (camel || constante || (llamada && (unaPalabra || camel))) salida.add(nombre);
  }
  return [...salida].sort();
}

export function auditar(doc: string, corpus: string): Hallazgos {
  const inexistentes: string[] = [];
  const sinLlamador: string[] = [];
  for (const nombre of citadosEn(doc)) {
    const apariciones = [...corpus.matchAll(new RegExp(`(?<![\\w$])${nombre}(?![\\w$])`, "g"))].length;
    if (apariciones === 0) {
      inexistentes.push(nombre);
      continue;
    }
    const definiciones = [...corpus.matchAll(lineaDeDefinicion(nombre))].length;
    if (definiciones > 0 && apariciones - definiciones === 0) sinLlamador.push(nombre);
  }
  return { inexistentes, sinLlamador };
}

function corpusDeCodigo(): string {
  return CARPETAS_DE_CODIGO.flatMap((c) => archivos(path.join(RAIZ, c)))
    .map((f) => sinComentarios(fs.readFileSync(f, "utf8")))
    .join("\n");
}

describe("guardián: toda función del diccionario existe y tiene llamador (N7)", () => {
  const doc = fs.readFileSync(path.join(RAIZ, "docs/metricas.md"), "utf8");
  const hallazgos = auditar(doc, corpusDeCodigo());

  it("ninguna función o constante nueva del diccionario es inexistente", () => {
    expect(hallazgos.inexistentes.filter((n) => !(n in INEXISTENTES_CONOCIDAS))).toEqual([]);
  });

  it("ninguna función nueva del diccionario carece de llamador fuera de tests/", () => {
    expect(hallazgos.sinLlamador.filter((n) => !(n in SIN_LLAMADOR_CONOCIDAS))).toEqual([]);
  });

  it("sin excepciones zombi: cada excepción nombrada sigue siendo una violación", () => {
    const vivas = new Set([...hallazgos.inexistentes, ...hallazgos.sinLlamador]);
    const zombis = [...Object.keys(INEXISTENTES_CONOCIDAS), ...Object.keys(SIN_LLAMADOR_CONOCIDAS)].filter((n) => !vivas.has(n));
    expect(zombis).toEqual([]);
  });

  it("muerde: caza la inexistente y la definida sin llamador", () => {
    const corpus = "export function viva() {}\nexport function huerfana() {}\nconst x = viva();\n";
    const r = auditar("Usa `viva()`, `huerfanaYa()` y `huerfana()`.", corpus);
    expect(r.inexistentes).toEqual(["huerfanaYa"]);
    expect(r.sinLlamador).toEqual(["huerfana"]);
  });

  it("no marca lo bueno: campos, columnas y funciones con llamador", () => {
    const corpus = "export const calculo = () => 1;\nuse(calculo);\nconst t = { cohortId: 1 };\n";
    const r = auditar("Calcula `calculo` sobre `cohortId` en `calls` con `fecha_envio`.", corpus.replace("cohortId", "cohortId"));
    expect(r).toEqual({ inexistentes: [], sinLlamador: [] });
  });

  it("citadosEn ignora palabras simples y columnas, y toma camelCase, nombre() y CONSTANTES", () => {
    expect(citadosEn("`etapaVendida()` `vigente()` `deals` `fecha_envio` `GRUPOS_DE_CIERRE` `cohorteId` `ig`")).toEqual(["GRUPOS_DE_CIERRE", "cohorteId", "etapaVendida", "vigente"]);
  });
});
