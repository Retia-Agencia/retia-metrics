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
  "lib/queries/dashboard.ts:pctShow": "353: % de show con la cobertura de las citas sin resultado (H-13, F2-05)",
  "lib/queries/dashboard.ts:pctCierre": "353: % de cierre con su cobertura (H-13)",
  "lib/queries/tasas-del-grupo.ts:pctShow": "353: la razón canónica del grupo nace sin cobertura",
  "lib/queries/tasas-del-grupo.ts:pctCierre": "353: la razón canónica del grupo nace sin cobertura",
  "lib/queries/proyeccion.ts:pctShow": "353: proyección usa la tasa del grupo sin cobertura (lleva aparte `razonShow` como texto)",
  "lib/queries/proyeccion.ts:pctCierre": "353: proyección usa la tasa del grupo sin cobertura (lleva aparte `razonCierre` como texto)",
  "lib/queries/mi-espacio-metricas.ts:pctCierre": "353: Mi espacio repite la tasa sin cobertura",
  "lib/queries/vista-todos.ts:pctShow": "353: vista de todos los programas; la regla del tipo permite tasas por programa, no sin cobertura",
  "lib/queries/vista-todos.ts:pctCierre": "353: vista de todos los programas",
  "lib/queries/vista-todos.ts:pctSinGrain": "385 F4: banderas del pulso sin cobertura",
  "lib/queries/vista-metrica.ts:pctNoShow": "353: el no show como complemento nombrado de la razón del show",
  "lib/queries/tasa-show-por-cita.ts:porcentaje": "353: showPorCita; hoy calcula su propia cobertura aparte",
  "lib/queries/deals-contra-agendas.ts:pctAgendaron": "385 F4: razón del embudo del formulario sin cobertura",
  "lib/queries/embudo-comercial.ts:pctDelPaso": "385 F4: pasos del embudo comercial",
  "lib/queries/embudo-etapas.ts:tasaDesdeAnterior": "385 F4: embudo por etapas",
  "lib/queries/embudo-etapas.ts:tasaDesdeEntrada": "385 F4: embudo por etapas",
  "lib/queries/banderas-del-pulso.ts:pct": "385 F4: banderas del pulso",
  "lib/queries/vamos-a-llegar.ts:pct": "no es razón de captura: avance contra la meta, siempre calculable (N3 no aplica); decisión de F4",
  "lib/queries/saldo.ts:porcentaje": "no es razón con dato faltante: abonado sobre ticket, sin universo parcial (ADR 0024)",
  "lib/queries/vista-escalera.ts:porcentaje": "385 F4: escalera de conversión (la vista repite el campo como Tasa)",
  "lib/queries/escalera.ts:porcentaje": "385 F4: escalera de conversión",
  "lib/semaforo/costo-por-agenda.ts:costoPorRegistro": "385 F4: costo por registro del semáforo; el costo por agenda sí trae cobertura",
  "lib/semaforo/semaforo.ts:costoPorRegistro": "385 F4: costo por registro del semáforo",
  "lib/semaforo/semaforo.ts:porcentajeDelUmbral": "no es razón de negocio: distancia al umbral configurado",
  "lib/reporte-whatsapp/contrato.ts:costoPorRegistro": "385 F4: contrato del semáforo (ADR 0089), cambia con el costo por registro",
  "lib/reporte-whatsapp/contrato.ts:porcentajeDelUmbral": "no es razón de negocio: distancia al umbral configurado",
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
    expect(hallazgos.filter((h) => !(h in EXCEPCIONES))).toEqual([]);
  });

  it("sin excepciones zombi: cada excepción nombrada sigue siendo una violación", () => {
    expect(Object.keys(EXCEPCIONES).filter((e) => !hallazgos.includes(e))).toEqual([]);
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
