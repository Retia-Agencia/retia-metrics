import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import {
  citaSinResultado,
  noAsistio,
  noShowPorCita,
  noShowPorDeal,
  ocurrio,
  RESULTADOS_QUE_OCURRIERON,
  showPorCita,
  showPorDeal,
} from "@/lib/deals/resultados-de-llamada";

/** Ticket 353, ADR 0115 N1: "ocurrió", "no asistió", las tasas y la cita sin resultado, una sola vez. */

describe("resultados de llamada", () => {
  it("ocurrió es show, compromiso, cerrada o perdida; nada más", () => {
    for (const r of RESULTADOS_QUE_OCURRIERON) expect(ocurrio(r)).toBe(true);
    for (const r of ["agendada", "no_show", "cancelada", "reagendada"]) expect(ocurrio(r)).toBe(false);
  });

  it("no asistió es solo no_show: la cancelada y la sin marcar no lo son", () => {
    expect(noAsistio("no_show")).toBe(true);
    for (const r of ["cancelada", "agendada", "reagendada", "show"]) expect(noAsistio(r)).toBe(false);
  });

  it("show por deal y por cita son cocientes distintos del mismo set; el no show es su complemento nombrado", () => {
    // Una persona con dos citas el mismo día: una show, una no show.
    expect(showPorDeal(1, 1)).toBe(1);
    expect(showPorCita(1, 2)).toBe(0.5);
    expect(noShowPorCita(1, 1)).toBe(0.5);
    expect(noShowPorCita(1, 1)).toBeCloseTo(1 - showPorCita(1, 2)!);
    expect(noShowPorDeal(0, 1)).toBe(0);
    expect(noShowPorDeal(1, 4)).toBe(0.25);
  });

  it("sin base no hay tasa: es null, nunca 0", () => {
    expect(showPorDeal(0, 0)).toBeNull();
    expect(showPorCita(0, 0)).toBeNull();
    expect(noShowPorCita(0, 0)).toBeNull();
    expect(noShowPorDeal(0, 0)).toBeNull();
  });

  it("cita sin resultado: agendada con la hora en el corte (inclusive); sin hora o con resultado no lo es", () => {
    const ahora = new Date("2026-10-14T12:00:00-05:00");
    const cita = (resultado: string, fechaAgenda: Date | null, fechaLlamada: Date | null = null) => ({ resultado, fechaAgenda, fechaLlamada });
    expect(citaSinResultado(cita("agendada", new Date("2026-10-14T12:00:00-05:00")), ahora)).toBe(true);
    expect(citaSinResultado(cita("agendada", new Date("2026-10-14T12:00:01-05:00")), ahora)).toBe(false);
    expect(citaSinResultado(cita("agendada", null, new Date("2026-10-14T09:00:00-05:00")), ahora)).toBe(true);
    expect(citaSinResultado(cita("agendada", null, null), ahora)).toBe(false);
    expect(citaSinResultado(cita("show", new Date("2026-10-14T09:00:00-05:00")), ahora)).toBe(false);
    expect(citaSinResultado(cita("no_show", new Date("2026-10-14T09:00:00-05:00")), ahora)).toBe(false);
  });
});

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const CARPETAS = ["lib", "app", "components", "scripts"];
const MODULO = "lib/deals/resultados-de-llamada.ts";
const MODULO_DE_FILTROS = "lib/queries/metricas-filtros.ts";

function archivosDeCodigo(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosDeCodigo(ruta);
    return /\.[cm]?[jt]sx?$/.test(entrada.name) ? [ruta] : [];
  });
}

/** Lo que solo el módulo de resultados puede escribir: la lista, un "no_show" comparado a mano, o un `ocurrio` propio. */
const PROHIBIDO_FUERA_DEL_MODULO = [
  /RESULTADOS_QUE_OCURRIERON/,
  /(?<!filtros)\.resultado\s*(?:===|!==)\s*["']no_show["']/,
  /eq\(\s*calls\.resultado\s*,\s*["']no_show["']\s*\)/,
  /(?:const|function)\s+ocurrio\b/,
];
/** La cita pasada sin resultado en SQL vive en `metricas-filtros.ts`: nadie arma `agendada` + corte de hora a mano. */
const CITA_SIN_RESULTADO_A_MANO = /eq\(\s*calls\.resultado\s*,\s*["']agendada["']\s*\)[\s\S]{0,200}?(?:lte|lt)\(\s*calls\.fecha(?:Agenda|Llamada)/;

export function infraccionesDeResultados(fuente: string, ruta: string): string[] {
  const encontradas: string[] = [];
  // Las métricas viven en lib/queries; los mapeos de ingesta y migración leen el evento crudo y no miden nada.
  const esMetrica = ruta.startsWith("lib/queries/") || !ruta.startsWith("lib/");
  if (ruta !== MODULO) for (const patron of PROHIBIDO_FUERA_DEL_MODULO) {
    if (patron.source.includes("no_show") && !esMetrica) continue;
    if (patron.test(fuente)) encontradas.push(String(patron));
  }
  if (ruta !== MODULO_DE_FILTROS && CITA_SIN_RESULTADO_A_MANO.test(fuente)) encontradas.push("cita sin resultado a mano");
  return encontradas;
}

describe("guardián N1: los resultados de llamada se deciden en un solo módulo", () => {
  it("nadie fuera del módulo escribe la lista, el no_show a mano ni la cita sin resultado", () => {
    const infracciones = CARPETAS.flatMap((carpeta) => archivosDeCodigo(join(RAIZ, carpeta)))
      .flatMap((archivo) => {
        const ruta = relative(RAIZ, archivo);
        return infraccionesDeResultados(readFileSync(archivo, "utf8"), ruta).map((i) => `${ruta}: ${i}`);
      });
    expect(infracciones).toEqual([]);
  });

  it("muerde los patrones prohibidos y deja pasar el uso del módulo", () => {
    expect(infraccionesDeResultados('const r = ["show", "perdida"]; RESULTADOS_QUE_OCURRIERON.includes(x)', "lib/x.ts")).not.toEqual([]);
    expect(infraccionesDeResultados('if (c.resultado === "no_show") n++', "lib/queries/x.ts")).not.toEqual([]);
    expect(infraccionesDeResultados('where(eq(calls.resultado, "no_show"))', "lib/queries/x.ts")).not.toEqual([]);
    expect(infraccionesDeResultados("const ocurrio = (r: string) => true", "lib/x.ts")).not.toEqual([]);
    expect(infraccionesDeResultados('and(eq(calls.resultado, "agendada"), lte(calls.fechaAgenda, ahora))', "lib/x.ts")).not.toEqual([]);
    expect(infraccionesDeResultados('import { ocurrio, noAsistio } from "@/lib/deals/resultados-de-llamada"; if (noAsistio(r)) n++', "lib/x.ts")).toEqual([]);
    expect(infraccionesDeResultados("RESULTADOS_QUE_OCURRIERON", MODULO)).toEqual([]);
    expect(infraccionesDeResultados('and(eq(calls.resultado, "agendada"), lte(calls.fechaAgenda, ahora))', MODULO_DE_FILTROS)).toEqual([]);
  });
});
