import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { Db } from "@/lib/db/tipos";
import { consultarMetricaMcp, resumenDelHubMcp } from "@/lib/mcp/herramientas/metricas";
import type { ContextoMcp } from "@/lib/mcp/herramientas";
import { studentsDelPrograma } from "@/lib/queries/estudiantes";
import { totalesDeStudents } from "@/lib/queries/estudiantes-totales";
import { leerMetasDelMes } from "@/lib/queries/metas";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import {
  HOY_DORADO, PERIODOS_DORADOS, sembrarDorada, type ClaveDeal, type SemillaDorada,
} from "./helpers/semilla-dorada";

/**
 * NUMEROS DORADOS (ticket 385, contrato de metricas y datos §4).
 *
 * Una base sembrada y determinista (`tests/helpers/semilla-dorada.ts`, solo en memoria, nunca produccion) con
 * los casos que produccion no tiene. Cada superficie llama a la funcion REAL y se compara contra valores
 * escritos A MANO abajo: nada se regenera ni se copia de la salida. Cada numero se calculo desde la semilla
 * con la definicion de `docs/metricas.md`; el comentario de cada bloque dice como.
 *
 * Cambiar una formula, o la semilla, obliga a editar estos esperados en el mismo commit (N8).
 *
 * Fuera de alcance A PROPOSITO: llamadas, shows, citas sin resultado y agendas (ticket 353) y leads/registros
 * (354). La semilla no tiene llamadas, asi que esas cifras no se congelan aqui.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let s: SemillaDorada;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => {
  await vaciar();
  s = await sembrarDorada(db);
}, 60_000);

type Periodo = keyof typeof PERIODOS_DORADOS;
type Programa = "A" | "B";
const id = (p: Programa) => (p === "A" ? s.programaA : s.programaB);
const slug = (p: Programa) => (p === "A" ? s.slugA : s.slugB);

/** El escalon de paridad: primero el CONTEO; si difiere o si las claves no coinciden, QUE deals sobran y faltan. */
function compararConteoYClaves(obtenidos: string[], esperadas: ClaveDeal[]) {
  expect(obtenidos.length, `conteo (obtenidos: ${obtenidos.join(", ")})`).toBe(esperadas.length);
  const sobran = obtenidos.filter((c) => !esperadas.includes(c as ClaveDeal)).sort();
  const faltan = esperadas.filter((c) => !obtenidos.includes(c)).sort();
  expect({ sobran, faltan }).toEqual({ sobran: [], faltan: [] });
}

function contexto(): ContextoMcp {
  return {
    db,
    session: { user: { id: s.gerenteId, email: "gerente-dorado@retia.test", name: "gerente" } } as Session,
    rol: "gerente",
    tokenId: crypto.randomUUID(),
    escritura: false,
  };
}

const vistaDe = (p: Programa, periodo: Periodo) =>
  armarVistaDelDashboard({
    programId: id(p), hoy: HOY_DORADO, preset: "custom",
    periodo: { preset: "custom", a: PERIODOS_DORADOS[periodo], comparaciones: [] },
  }, db);

/**
 * Venta = deal vigente, sin cortesia, hoy en Abonado o Completo, por el dia (Bogota) de su primera entrada.
 * A: a1 14-oct, a2 20-oct, a4 31-oct 21:30 (en UTC ya es noviembre, en Bogota sigue siendo octubre), a10 5-oct
 *    (cohorte cerrada SIN inicio de ventas); a5 2-nov, a6 3-nov (sin cohorte ni dueño), a7 4-nov (sin valor).
 *    Fuera: a3 (paso a Cierre Perdido), a8 (cortesia), a9 (anulado).
 * B: b1 20-oct (abono en COP), b2 3-nov, b3 5-nov (mismo correo que a1: son dos leads).
 */
const VENTAS: Record<Programa, Record<Periodo, ClaveDeal[]>> = {
  A: {
    mesCerrado: ["a1_parcial", "a2_completo", "a4_noche", "a10_cohorte1"],
    mesEnCurso: ["a5_cohorte3", "a6_sin_cohorte", "a7_sin_valor"],
    custom14: ["a4_noche", "a5_cohorte3", "a6_sin_cohorte", "a7_sin_valor"],
  },
  B: {
    mesCerrado: ["b1_cop"],
    mesEnCurso: ["b2_usd", "b3_mismo_correo"],
    custom14: ["b2_usd", "b3_mismo_correo"],
  },
};

interface EsperadoHub {
  cierres: number;
  /** Vendido, recaudado y por cobrar SOLO de las ventas con saldo calculable (`dineroDeVentas`). */
  dinero: { vendido: number; recaudado: number; porCobrar: number; ventas: number; sinSaldoCalculable: number };
  caja: Array<{ moneda: string; total: number }>;
  contratadoUsd: number;
  sinValorVendido: number;
  comision: { totalUsd: number; ventasSinComision: number };
  cortesias: number;
  porCohorte: Array<[codigo: string | null, ventas: number, contratadoUsd: number, recaudado: number]>;
  /** closerId (null = sin dueño) y cierres. */
  comparativo: Array<[closer: string | null, cierres: number]>;
}

/**
 * Cada cifra, derivada a mano de la semilla:
 *  - vendido = valor vendido de las ventas con saldo calculable; recaudado = sus abonos de ticket vigentes.
 *  - caja = abonos vigentes (ticket y adicional) con fecha en el rango, por moneda, de ventas o no: el
 *    abono de a3 (Cierre Perdido) SIGUE contando; el anulado de a1 (77) y el de a9 (999) no.
 *  - comision = 10 % del valor vendido de cada venta con valor; a7 no tiene valor, por eso "sin comision".
 */
const HUB: Record<Programa, Record<Periodo, EsperadoHub>> = {
  A: {
    // caja 500 + 600 + 400 + 200 (a3) + 300 + 1000 = 3.000
    mesCerrado: {
      cierres: 4, dinero: { vendido: 4000, recaudado: 2800, porCobrar: 1200, ventas: 4, sinSaldoCalculable: 0 },
      caja: [{ moneda: "USD", total: 3000 }], contratadoUsd: 4000, sinValorVendido: 0,
      comision: { totalUsd: 400, ventasSinComision: 0 }, cortesias: 0,
      porCohorte: [["C1", 1, 1000, 1000], ["C2", 3, 3000, 1800]], comparativo: [["Ana", 4]],
    },
    // caja 120 (adicional) + 700 + 100 + 150 = 1.070
    mesEnCurso: {
      cierres: 3, dinero: { vendido: 2000, recaudado: 800, porCobrar: 1200, ventas: 2, sinSaldoCalculable: 1 },
      caja: [{ moneda: "USD", total: 1070 }], contratadoUsd: 2000, sinValorVendido: 1,
      comision: { totalUsd: 200, ventasSinComision: 1 }, cortesias: 1,
      porCohorte: [["C3", 2, 1000, 700], [null, 1, 1000, 100]], comparativo: [["Ana", 2], [null, 1]],
    },
    // caja 400 (28-oct) + 300 (31-oct) + 1.070 = 1.770; cruza C2 y C3
    custom14: {
      cierres: 4, dinero: { vendido: 3000, recaudado: 1100, porCobrar: 1900, ventas: 3, sinSaldoCalculable: 1 },
      caja: [{ moneda: "USD", total: 1770 }], contratadoUsd: 3000, sinValorVendido: 1,
      comision: { totalUsd: 300, ventasSinComision: 1 }, cortesias: 1,
      porCohorte: [["C2", 1, 1000, 300], ["C3", 2, 1000, 700], [null, 1, 1000, 100]], comparativo: [["Ana", 3], [null, 1]],
    },
  },
  B: {
    // OJO (hallazgo del 385): cierres = 1 pero dinero.ventas = 0. La venta con abono SOLO en COP tiene
    // saldo no calculable y el dinero la deja fuera, mientras cierres y comision si la cuentan.
    mesCerrado: {
      cierres: 1, dinero: { vendido: 0, recaudado: 0, porCobrar: 0, ventas: 0, sinSaldoCalculable: 1 },
      caja: [{ moneda: "COP", total: 2_000_000 }], contratadoUsd: 1500, sinValorVendido: 0,
      comision: { totalUsd: 150, ventasSinComision: 0 }, cortesias: 0,
      porCohorte: [["B1", 1, 1500, 0]], comparativo: [["Ana", 1]],
    },
    mesEnCurso: {
      cierres: 2, dinero: { vendido: 3000, recaudado: 1800, porCobrar: 1200, ventas: 2, sinSaldoCalculable: 0 },
      caja: [{ moneda: "USD", total: 1800 }], contratadoUsd: 3000, sinValorVendido: 0,
      comision: { totalUsd: 300, ventasSinComision: 0 }, cortesias: 0,
      porCohorte: [["B1", 2, 3000, 1800]], comparativo: [["Ana", 2]],
    },
    custom14: {
      cierres: 2, dinero: { vendido: 3000, recaudado: 1800, porCobrar: 1200, ventas: 2, sinSaldoCalculable: 0 },
      caja: [{ moneda: "USD", total: 1800 }], contratadoUsd: 3000, sinValorVendido: 0,
      comision: { totalUsd: 300, ventasSinComision: 0 }, cortesias: 0,
      porCohorte: [["B1", 2, 3000, 1800]], comparativo: [["Ana", 2]],
    },
  },
};

const CASOS = (["A", "B"] as const).flatMap((p) => (["mesCerrado", "mesEnCurso", "custom14"] as const).map((per) => [p, per] as const));

describe("Hub Comercial y Dinero", () => {
  it.each(CASOS)("programa %s, %s: las cifras son las escritas a mano", async (p, per) => {
    const vista = await vistaDe(p, per);
    const esperado = HUB[p][per];
    expect(vista.embudo.cierres).toBe(esperado.cierres);
    expect(vista.dinero).toMatchObject({ ...esperado.dinero, sobrepago: 0 });
    expect(vista.caja).toEqual(esperado.caja);
    expect(vista.contratadoUsd).toBe(esperado.contratadoUsd);
    expect(vista.sinValorVendido).toBe(esperado.sinValorVendido);
    expect(vista.comision).toEqual(esperado.comision);
    expect(vista.cortesias).toBe(esperado.cortesias);
    expect(vista.ventasPorCohorte.map((c) => [c.codigo, c.ventas, c.contratadoUsd, c.dinero.recaudado])).toEqual(esperado.porCohorte);
    expect(vista.comparativo.map((c) => [c.closerId, c.cierres])).toEqual(esperado.comparativo);
  });

  it("las ventas por cohorte suman las ventas del periodo (la misma venta no se cuenta dos veces)", async () => {
    for (const [p, per] of CASOS) {
      const vista = await vistaDe(p, per);
      expect(vista.ventasPorCohorte.reduce((suma, c) => suma + c.ventas, 0)).toBe(vista.embudo.cierres);
    }
  });
});

describe("MCP contra Hub, con el escalon conteo y despues claves", () => {
  it.each(CASOS)("programa %s, %s: resumen_del_hub y consultar_metrica dan lo mismo que el Hub", async (p, per) => {
    const rango = PERIODOS_DORADOS[per];
    const entrada = { programa: slug(p), periodo: "custom" as const, desde: rango.desde, hasta: rango.hasta };
    const pagina = await vistaDe(p, per);

    const resumen = await resumenDelHubMcp.ejecutar(contexto(), entrada);
    const vistaMcp = resumen.estructurado.vista as typeof pagina;
    expect(vistaMcp.embudo.cierres).toBe(pagina.embudo.cierres);
    expect(vistaMcp.caja).toEqual(pagina.caja);
    expect(vistaMcp.dinero).toEqual(pagina.dinero);

    const cierres = await consultarMetricaMcp.ejecutar(contexto(), { ...entrada, metrica: "cierres", pagina: 1 });
    const filas = cierres.estructurado.filas as Array<{ dealId: string }>;
    expect((cierres.estructurado.resumen as { subtotal: { cantidad: number } }).subtotal.cantidad).toBe(pagina.embudo.cierres);
    compararConteoYClaves(filas.map((f) => s.claveDe(f.dealId)), VENTAS[p][per]);

    const caja = await consultarMetricaMcp.ejecutar(contexto(), { ...entrada, metrica: "caja", pagina: 1 });
    expect((caja.estructurado.resumen as { subtotal: { caja: unknown } }).subtotal.caja).toEqual(pagina.caja);
  });
});

describe("Metas y cohorte", () => {
  // Meta de la cohorte repartida por dias habiles de venta (lunes a viernes, festivos cuentan):
  //  A/C3 vende 1-nov a 20-nov = 15 habiles; hasta hoy (6-nov) van 5 => esperado 20 x 5/15 = 6,667.
  //  B/B1 vende 1-oct a 30-nov = 22 habiles de octubre + 21 de noviembre = 43; meta de cupos del mes = 20 x 22/43 y 20 x 21/43.
  //  C1 (cerrada, sin inicio de ventas) no tiene ventana: sus ventas cuentan, su meta es 0 y sale en "sin ventana".
  it("A octubre: la venta de la cohorte sin inicio de ventas cuenta y no pone meta", async () => {
    const m = await leerMetasDelMes(s.programaA, "2026-10", HOY_DORADO, db);
    expect(m.vendidos).toBe(4);
    expect(m.filas.map((f) => [f.codigo, f.vendidos])).toEqual([["C1", 1], ["C2", 3]]);
    expect(m.cohortesSinVentana.map((c) => c.codigo)).toEqual(["C1"]);
    expect(m.metaCupos).toBe(20);
    expect(m.metaUsd).toBe(20000);
    expect(m.esperado).toBe(20);
    expect(m.deuda).toBe(16);
    expect(m.cumplimiento).toBeCloseTo(0.2, 10);
    expect(m.contratadoUsd).toBe(4000);
    expect(m.ventasSinValorVendido).toBe(0);
  });

  it("A noviembre: la venta sin cohorte sale en su propia fila y la sin valor se avisa", async () => {
    const m = await leerMetasDelMes(s.programaA, "2026-11", HOY_DORADO, db);
    expect(m.vendidos).toBe(3);
    expect(m.filas.map((f) => [f.codigo, f.vendidos])).toEqual([["C3", 2], ["Sin cohorte", 1]]);
    expect(m.metaCupos).toBe(20);
    expect(m.esperado).toBeCloseTo((20 * 5) / 15, 10);
    expect(m.deuda).toBeCloseTo((20 * 5) / 15 - 3, 10);
    expect(m.cumplimiento).toBeCloseTo(3 / ((20 * 5) / 15), 10);
    expect(m.contratadoUsd).toBe(2000);
    expect(m.ventasSinValorVendido).toBe(1);
  });

  it("B: la meta del mes se prorratea por habiles de la ventana de la cohorte", async () => {
    const oct = await leerMetasDelMes(s.programaB, "2026-10", HOY_DORADO, db);
    expect(oct.vendidos).toBe(1);
    expect(oct.metaCupos).toBeCloseTo((20 * 22) / 43, 10);
    expect(oct.contratadoUsd).toBe(1500);
    const nov = await leerMetasDelMes(s.programaB, "2026-11", HOY_DORADO, db);
    expect(nov.vendidos).toBe(2);
    expect(nov.metaCupos).toBeCloseTo((20 * 21) / 43, 10);
    expect(nov.esperado).toBeCloseTo((20 * 5) / 43, 10);
    expect(nov.contratadoUsd).toBe(3000);
  });

  it("el vendido del mes de Metas coincide con las ventas del Hub del mismo mes (misma definicion de venta)", async () => {
    for (const p of ["A", "B"] as const) {
      const metas = await leerMetasDelMes(id(p), "2026-10", HOY_DORADO, db);
      expect(metas.vendidos).toBe((await vistaDe(p, "mesCerrado")).embudo.cierres);
    }
  });
});

describe("Students y cartera", () => {
  // Students son los deals vendidos (cortesia incluida, con precio 0). Recaudado = abonos de ticket vigentes
  // (sin el adicional de 120, sin el anulado de 77); por cobrar = saldo positivo.
  //  A: recaudado 1000 + 500 + 1000 + 300 + 700 + 100 + 150 = 3.750; por cobrar 500 + 700 + 300 + 900 = 2.400.
  it("A: totales y saldo de cada deal", async () => {
    const filas = await studentsDelPrograma(db, s.programaA, {}, HOY_DORADO);
    const porClave = new Map(filas.map((f) => [s.claveDe(f.dealId), f.saldo]));
    compararConteoYClaves([...porClave.keys()], ["a1_parcial", "a2_completo", "a4_noche", "a5_cohorte3", "a6_sin_cohorte", "a7_sin_valor", "a8_cortesia", "a10_cohorte1"]);
    expect(porClave.get("a1_parcial")).toMatchObject({ abonado: 500, saldo: 500 });
    expect(porClave.get("a2_completo")).toMatchObject({ abonado: 1000, saldo: 0, abonosVigentes: 2 });
    expect(porClave.get("a7_sin_valor")).toMatchObject({ abonado: 150, saldo: null, sinSaldoPorque: "sin_valor_vendido" });
    expect(porClave.get("a8_cortesia")).toMatchObject({ precio: 0, abonado: 0, saldo: 0 });
    expect(totalesDeStudents(filas)).toEqual({ porMoneda: [{ moneda: "USD", recaudado: 3750, porCobrar: 2400 }], sinValorVendido: 1 });
  });

  // OJO (hallazgo del 385): el abono de 2.000.000 COP de b1 NO aparece en el total de Students: el deal queda
  // con saldo no calculable ("moneda_distinta") y el total solo suma lo que esta en USD. La caja del Hub si lo ve.
  it("B: el abono en otra moneda deja el saldo sin calcular y no entra al total de Students", async () => {
    const filas = await studentsDelPrograma(db, s.programaB, {}, HOY_DORADO);
    const porClave = new Map(filas.map((f) => [s.claveDe(f.dealId), f.saldo]));
    expect(porClave.get("b1_cop")).toMatchObject({ abonado: 0, saldo: null, sinSaldoPorque: "moneda_distinta" });
    expect(porClave.get("b2_usd")).toMatchObject({ abonado: 300, saldo: 1200 });
    expect(porClave.get("b3_mismo_correo")).toMatchObject({ abonado: 1500, saldo: 0 });
    expect(totalesDeStudents(filas)).toEqual({ porMoneda: [{ moneda: "USD", recaudado: 1800, porCobrar: 1200 }], sinValorVendido: 0 });
  });

  it("el recaudado de Students de las ventas del mes en curso coincide con el recaudado del Hub (A, ventas de noviembre)", async () => {
    // Students de A incluye todas las cohortes; el de noviembre son a5, a6 y a7: 700 + 100 + 150 = 950.
    // El Hub da 800 porque deja fuera a7 (sin valor: saldo no calculable). Las dos son legitimas y distintas.
    const filas = await studentsDelPrograma(db, s.programaA, {}, HOY_DORADO);
    const deNoviembre = filas.filter((f) => ["a5_cohorte3", "a6_sin_cohorte", "a7_sin_valor"].includes(s.claveDe(f.dealId)));
    expect(deNoviembre.reduce((suma, f) => suma + (f.saldo?.abonado ?? 0), 0)).toBe(950);
    expect((await vistaDe("A", "mesEnCurso")).dinero.recaudado).toBe(800);
  });
});
