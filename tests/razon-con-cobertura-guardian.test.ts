import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Contrato de métricas y datos §8 (5), ADR 0115 N3: toda razón (tasa, porcentaje, costo, ROAS) devuelve su
 * cobertura (`RazonConCobertura`, `lib/cobertura.ts`) y la pantalla dice "parcial" o "—"; nunca una razón con
 * medio dato. Hoy solo ROAS y costo por agenda lo hacen (F1 H-13).
 *
 * Qué caza: un CAMPO DECLARADO (tipo, interface o esquema zod) de `lib/` cuyo nombre es de razón
 * (`pct*`, `tasa*`, `porcentaje*`, `roas`, `cpl`, `cac`, `costoPor*`) y cuyo tipo es un número pelado:
 * `number`, `number | null`, `Tasa` (que solo trae el valor) o `z.number()`. Un campo `RazonConCobertura`
 * no cae. Límite honesto: no ve una razón con un nombre fuera de ese patrón ni una calculada y devuelta sin
 * campo declarado; eso queda para revisión manual (olor: una división que sale a pantalla sin su `base`).
 *
 * Las violaciones de hoy son una lista NOMBRADA `archivo:campo` con el ticket que la retira. Sin excepciones
 * zombi: si una deja de ser violación se borra de aquí; y una nueva razón sin cobertura rompe el test.
 */
const RAIZ = process.cwd();
const NOMBRE_DE_RAZON = /^(pct[A-Za-z0-9]*|tasa[A-Za-z0-9]*|porcentaje[A-Za-z0-9]*|roas|cpl|cac|costoPor[A-Za-z0-9]*)$/;
const TIPO_PELADO = /^(number(\s*\|\s*null)?|Tasa|z\.number\(\)(\.nullable\(\))?)$/;

export function razonesSinCobertura(fuente: string): string[] {
  const salida: string[] = [];
  for (const linea of sinComentarios(fuente).split("\n")) {
    const m = linea.match(/^\s*(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\??:\s*(.+?)\s*[;,]?\s*$/);
    if (!m) continue;
    // Solo declaraciones: en una interface/type cierran con `;`, en un esquema zod con `,` y un `z.`.
    const cierra = linea.trimEnd().slice(-1);
    const esDeclaracion = cierra === ";" || (cierra === "," && m[2].startsWith("z."));
    if (esDeclaracion && NOMBRE_DE_RAZON.test(m[1]) && TIPO_PELADO.test(m[2])) salida.push(m[1]);
  }
  return salida;
}

/** `archivo:campo` → por qué se acepta hoy y qué ticket lo retira. */
const EXCEPCIONES: Record<string, string> = {
  "lib/queries/vista-todos.ts:pctSinGrain": "403: banderas del pulso sin cobertura",
  "lib/queries/vista-metrica.ts:pctNoShow": "403: el no show como complemento nombrado de la razón del show",
  "lib/queries/tasa-show-por-cita.ts:porcentaje": "403: showPorCita; hoy calcula su propia cobertura aparte",
  "lib/queries/deals-contra-agendas.ts:pctAgendaron": "403: razón del embudo del formulario sin cobertura",
  "lib/queries/embudo-comercial.ts:pctDelPaso": "403: pasos del embudo comercial",
  "lib/queries/embudo-etapas.ts:tasaDesdeAnterior": "403: embudo por etapas",
  "lib/queries/embudo-etapas.ts:tasaDesdeEntrada": "403: embudo por etapas",
  "lib/queries/banderas-del-pulso.ts:pct": "403: banderas del pulso",
  "lib/queries/vista-escalera.ts:porcentaje": "403: escalera de conversión (la vista repite el campo como Tasa)",
  "lib/queries/escalera.ts:porcentaje": "403: escalera de conversión",
  "lib/semaforo/costo-por-agenda.ts:costoPorRegistro": "contrato del semaforo (ADR 0089): cambia junto con Juanito",
  "lib/semaforo/semaforo.ts:costoPorRegistro": "contrato del semaforo (ADR 0089): cambia junto con Juanito",
  "lib/reporte-whatsapp/contrato.ts:costoPorRegistro": "contrato del semaforo (ADR 0089): cambia junto con Juanito",
};

/** Campos cuyo nombre parece una razón, pero el concepto no tiene cobertura parcial. */
const NO_SON_RAZON: Record<string, string> = {
  "lib/queries/vamos-a-llegar.ts:pct": "avance contra la meta, siempre calculable (N3 no aplica)",
  "lib/queries/saldo.ts:porcentaje": "abonado sobre ticket, sin universo parcial (ADR 0024)",
  "lib/semaforo/semaforo.ts:porcentajeDelUmbral": "distancia al umbral configurado, no una razón de captura",
  "lib/reporte-whatsapp/contrato.ts:porcentajeDelUmbral": "distancia al umbral configurado, no una razón de captura",
};

function hallazgosDelRepo(): string[] {
  return archivos(path.join(RAIZ, "lib")).flatMap((f) => {
    const rel = path.relative(RAIZ, f).split(path.sep).join("/");
    if (rel.startsWith("lib/db/") || rel === "lib/cobertura.ts") return [];
    return razonesSinCobertura(fs.readFileSync(f, "utf8")).map((campo) => `${rel}:${campo}`);
  });
}

describe("guardián: toda razón declara su cobertura (N3)", () => {
  const hallazgos = [...new Set(hallazgosDelRepo())].sort();

  it("ninguna razón nueva es un número pelado", () => {
    expect(hallazgos.filter((h) => !(h in EXCEPCIONES) && !(h in NO_SON_RAZON))).toEqual([]);
  });

  it("sin excepciones zombi: cada excepción nombrada sigue siendo una violación", () => {
    expect([...Object.keys(EXCEPCIONES), ...Object.keys(NO_SON_RAZON)].filter((e) => !hallazgos.includes(e))).toEqual([]);
  });

  it("muerde: caza la razón pelada en interface, type y esquema zod", () => {
    expect(razonesSinCobertura("export interface V {\n  pctShow: number | null;\n}")).toEqual(["pctShow"]);
    expect(razonesSinCobertura("type V = {\n  roas: number;\n  pctCierre: Tasa;\n};")).toEqual(["roas", "pctCierre"]);
    expect(razonesSinCobertura("z.object({\n  costoPorRegistro: z.number().nullable(),\n})")).toEqual(["costoPorRegistro"]);
  });

  it("no marca lo bueno: razón con cobertura, campos que no son razón y asignaciones", () => {
    expect(razonesSinCobertura("interface V {\n  roas: RazonConCobertura;\n  pctShow: RazonConCobertura | null;\n}")).toEqual([]);
    expect(razonesSinCobertura("interface V {\n  ventas: number;\n  show: number | null;\n}")).toEqual([]);
    expect(razonesSinCobertura("const x = {\n  pctShow: null,\n  pctCierre: tasas.pctCierre,\n};")).toEqual([]);
    expect(razonesSinCobertura("// pctShow: number | null;\n")).toEqual([]);
  });
});
