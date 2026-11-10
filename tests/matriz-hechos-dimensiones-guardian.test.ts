import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de métricas y datos §8 (3) y §7.2 (matriz de bus de Kimball): una tabla hechos × dimensiones
 * conformes. Cada celda dice una de tres cosas: `si` (la dimensión es de la lista blanca del hecho), `no:<razón>`
 * (no aplica y la razón está escrita) o `aun` (no aplica todavía: es deuda a la vista, no un olvido).
 *
 * Qué verifica contra el código de `lib/queries/hechos/`:
 *   - la rejilla está completa: todo hecho trae TODAS las dimensiones del catálogo, ninguna se queda sin clasificar;
 *   - los `si` son EXACTAMENTE la lista blanca (`export type Dimension<Hecho> = ...`) de cada módulo, en los dos
 *     sentidos: agregar una dimensión al código obliga a clasificarla aquí, y marcar `si` sin que el código la admita falla;
 *   - toda razón de un `no:` existe;
 *   - el programa es frontera y no filtro (AGENTS.md, ADR 0043): ningún hecho admite `programa` como dimensión.
 *
 * Límites honestos: no prueba que la dimensión CALCULE bien (eso es la paridad por métrica); la tabla vive aquí
 * hasta que el registro tipado de F4 la absorba y `docs/metricas.md` la muestre; el gasto y el abono no tienen módulo en
 * `hechos/` y por eso no tiene fila (se agrega cuando lo tenga).
 */
const RAIZ = process.cwd();

/** Dimensiones conformes: una definición con un módulo (`hechos/fechas.ts`, `hechos/origen.ts`, ...). */
const DIMENSIONES = [
  "dia", "semana", "mes", "hora",
  "area", "canal", "cuenta", "campana", "fuente", "utm_source", "utm_medium", "categoria", "tiene_envio",
  "dueno", "cohorte", "etapa", "ocurrio",
] as const;
type DimensionConforme = (typeof DIMENSIONES)[number];
type Celda = "si" | "aun" | `no:${string}`;

const SOLO_DIA = "no:el hecho se ancla por día de negocio; no tiene hora";
const DEL_DEAL = "no:es del deal, no del hecho";

const MATRIZ: Record<string, Record<DimensionConforme, Celda>> = {
  Envio: {
    dia: "si", semana: "si", mes: "si", hora: SOLO_DIA,
    area: "si", canal: "si", cuenta: "si", campana: "si", fuente: "si", utm_source: "si", utm_medium: "si", categoria: "si",
    tiene_envio: "no:todo envío es un envío",
    dueno: DEL_DEAL, cohorte: DEL_DEAL, etapa: DEL_DEAL,
    ocurrio: "no:solo las citas ocurren",
  },
  Agenda: {
    dia: "si", semana: "si", mes: "si", hora: "si",
    area: "si", canal: "si", cuenta: "si", campana: "aun", fuente: "aun", utm_source: "si", utm_medium: "si", categoria: "si", tiene_envio: "si",
    dueno: "si", cohorte: "si", etapa: "si",
    ocurrio: "no:la agenda es la cita creada, no la ocurrida",
  },
  Cita: {
    dia: "si", semana: "si", mes: "si", hora: "aun",
    area: "si", canal: "si", cuenta: "si", campana: "aun", fuente: "aun", utm_source: "aun", utm_medium: "aun", categoria: "aun", tiene_envio: "aun",
    dueno: "si", cohorte: "si", etapa: "si",
    ocurrio: "si",
  },
  Venta: {
    dia: "si", semana: "si", mes: "si", hora: SOLO_DIA,
    area: "si", canal: "si", cuenta: "si", campana: "aun", fuente: "aun", utm_source: "aun", utm_medium: "aun", categoria: "aun", tiene_envio: "aun",
    dueno: "si", cohorte: "si", etapa: "no:una venta ya es Abonado o Completo; la etapa no la separa",
    ocurrio: "no:solo las citas ocurren",
  },
};

/** Lista blanca de cada hecho tal como la declara su módulo. */
export function dimensionesDelCodigo(fuente: string, hecho: string): string[] | null {
  const m = fuente.match(new RegExp(`export type Dimension${hecho}\\s*=\\s*([^;]+);`));
  return m ? [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]) : null;
}

function listaBlancaDe(hecho: string): string[] {
  const archivo = path.join(RAIZ, "lib/queries/hechos", `${hecho.toLowerCase()}.ts`);
  const lista = dimensionesDelCodigo(fs.readFileSync(archivo, "utf8"), hecho);
  if (!lista) throw new Error(`${archivo} no declara Dimension${hecho}`);
  return lista;
}

describe("guardián: matriz hechos × dimensiones conformes (§7.2)", () => {
  it("la rejilla está completa: cada hecho clasifica cada dimensión del catálogo", () => {
    for (const [hecho, celdas] of Object.entries(MATRIZ)) {
      expect({ hecho, dimensiones: Object.keys(celdas).sort() }).toEqual({ hecho, dimensiones: [...DIMENSIONES].sort() });
    }
  });

  it("los `si` son exactamente la lista blanca de cada módulo, en los dos sentidos", () => {
    for (const [hecho, celdas] of Object.entries(MATRIZ)) {
      const declaradas = Object.entries(celdas).filter(([, c]) => c === "si").map(([d]) => d).sort();
      expect({ hecho, lista: listaBlancaDe(hecho).sort() }).toEqual({ hecho, lista: declaradas });
    }
  });

  it("toda dimensión del código está en el catálogo y toda del catálogo la usa algún hecho", () => {
    const usadas = new Set(Object.keys(MATRIZ).flatMap(listaBlancaDe));
    expect([...usadas].filter((d) => !(DIMENSIONES as readonly string[]).includes(d))).toEqual([]);
    expect(DIMENSIONES.filter((d) => !usadas.has(d))).toEqual([]);
  });

  it("todo `no:` trae su razón escrita", () => {
    const sinRazon = Object.entries(MATRIZ).flatMap(([hecho, celdas]) =>
      Object.entries(celdas).filter(([, c]) => c.startsWith("no:") && c.slice(3).trim().length < 10).map(([d]) => `${hecho}.${d}`));
    expect(sinRazon).toEqual([]);
  });

  it("todo hecho de hechos/ tiene fila (un módulo nuevo obliga a clasificarlo)", () => {
    const conTipo = fs.readdirSync(path.join(RAIZ, "lib/queries/hechos"))
      .filter((f) => /^[a-z]+\.ts$/.test(f))
      .filter((f) => /export type Dimension[A-Z]\w*\s*=/.test(fs.readFileSync(path.join(RAIZ, "lib/queries/hechos", f), "utf8")))
      .map((f) => f.replace(".ts", "").replace(/^./, (c) => c.toUpperCase()));
    expect(conTipo.sort()).toEqual(Object.keys(MATRIZ).sort());
  });

  it("el programa es frontera: ningún hecho lo admite como dimensión", () => {
    const todas = Object.keys(MATRIZ).flatMap(listaBlancaDe);
    expect(todas.filter((d) => /^program/.test(d))).toEqual([]);
  });

  it("muerde: caza una dimensión nueva sin clasificar y un `si` que el código no admite", () => {
    const fuente = 'export type DimensionEnvio = "dia" | "semana" | "campana_nueva";';
    expect(dimensionesDelCodigo(fuente, "Envio")).toEqual(["dia", "semana", "campana_nueva"]);
    expect(dimensionesDelCodigo(fuente, "Envio")?.filter((d) => !(DIMENSIONES as readonly string[]).includes(d))).toEqual(["campana_nueva"]);
    expect(dimensionesDelCodigo(fuente, "Venta")).toBeNull();
  });

  it("no marca lo bueno: lo que el código y la matriz comparten no sobra ni falta", () => {
    const fuente = 'export type DimensionVenta = "dia" | "semana" | "mes" | "area" | "canal" | "cuenta" | "dueno" | "cohorte";';
    const celdas = MATRIZ.Venta;
    const si = Object.entries(celdas).filter(([, c]) => c === "si").map(([d]) => d).sort();
    expect(dimensionesDelCodigo(fuente, "Venta")?.sort()).toEqual(si);
  });
});
