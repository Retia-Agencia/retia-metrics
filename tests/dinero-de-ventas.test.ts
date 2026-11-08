import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { abonos, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cajaRecaudada } from "@/lib/queries/dashboard";
import { dineroDeSaldos, dineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import { listaDeMetrica, resumenDeMetrica, TAMANO_PAGINA } from "@/lib/queries/metricas-con-filas";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * Ticket 369: Vendido, Recaudado y Por cobrar son tres cifras del MISMO conjunto de ventas
 * (docs/hub.md §0, G-3 y DH-2). Lo recaudado es a hoy; "Entró a caja" es otra pregunta.
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroPrograma: string;
let closerA: typeof users.$inferSelect;
let closerB: typeof users.$inferSelect;
let secuencia = 0;

const HOY = "2026-10-20";
const RANGO = { desde: "2026-10-01", hasta: "2026-10-20" };
const AHORA = new Date("2026-10-20T12:00:00-05:00");

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [a, b] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "d369", nombre: "D369", ticketUsd: "1500" },
    { ...PROGRAMA_DE_PRUEBA, slug: "d369-ajeno", nombre: "Ajeno", ticketUsd: "1500" },
  ]).returning();
  programId = a.id;
  otroPrograma = b.id;
  [closerA, closerB] = await db.insert(users).values([
    { email: "a369@retia.co", rol: "closer", closerId: "A369" },
    { email: "b369@retia.co", rol: "closer", closerId: "B369" },
  ]).returning();
}, 60_000);

async function vender(valor: string | null, abonosUsd: number[], extra: { programa?: string; owner?: typeof closerA; cohortId?: string; dia?: string; etapa?: "ganado_parcial" | "ganado_completo" } = {}) {
  secuencia += 1;
  const programa = extra.programa ?? programId;
  const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: programa, emailNormalizado: `d369-${secuencia}@retia.co` }).returning();
  const [deal] = await db.insert(deals).values({
    programId: programa, leadId: lead.id, ownerUserId: (extra.owner ?? closerA).id, cohortId: extra.cohortId ?? null,
    etapa: extra.etapa ?? "ganado_parcial", valorVendidoUsd: valor,
  }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: extra.etapa ?? "ganado_parcial", fecha: new Date(`${extra.dia ?? "2026-10-05"}T10:00:00-05:00`) });
  for (const monto of abonosUsd) {
    await db.insert(abonos).values({ programId: programa, dealId: deal.id, registradoPorUserId: closerA.id, fecha: "2026-10-06", monto: String(monto), moneda: "USD" });
  }
  return deal;
}

const alcance = (extra: Record<string, unknown> = {}) => ({ programId, rango: RANGO, ...extra });

describe("las tres cifras (369)", () => {
  it("dos ventas de USD 1.500, una pagada y otra con 500: Vendido 3.000, Recaudado 2.000, Por cobrar 1.000", async () => {
    const pagada = await vender("1500", [1500], { etapa: "ganado_completo" });
    const parcial = await vender("1500", [500]);
    expect(await dineroDeVentas(db, [pagada.id, parcial.id])).toEqual({
      vendido: 3000, recaudado: 2000, porCobrar: 1000, sobrepago: 0, ventas: 2, sinSaldoCalculable: 0, sinValorVendido: 0,
    });
  });

  it("un abono anulado no cuenta; un abono adicional no cambia ninguna de las tres y sí Entró a caja", async () => {
    const venta = await vender("1500", [500]);
    const [anulado] = await db.insert(abonos).values({ programId, dealId: venta.id, registradoPorUserId: closerA.id, fecha: "2026-10-07", monto: "400", moneda: "USD" }).returning();
    await db.update(abonos).set({ anuladoEn: AHORA, anuladoPor: closerA.id, motivoAnulacion: "Error de prueba" }).where(eq(abonos.id, anulado.id));
    const antes = await dineroDeVentas(db, [venta.id]);
    const cajaAntes = await cajaRecaudada(alcance(), db);
    await db.insert(abonos).values({ programId, dealId: venta.id, registradoPorUserId: closerA.id, fecha: "2026-10-08", monto: "100", moneda: "USD", concepto: "adicional" });

    expect(antes).toMatchObject({ vendido: 1500, recaudado: 500, porCobrar: 1000 });
    expect(await dineroDeVentas(db, [venta.id])).toEqual(antes);
    const cajaDespues = await cajaRecaudada(alcance(), db);
    expect(cajaDespues.find((c) => c.moneda === "USD")?.total).toBe((cajaAntes.find((c) => c.moneda === "USD")?.total ?? 0) + 100);
  });

  it("invariante: Vendido = Recaudado + Por cobrar − sobrepago, al centavo, con sobrepagos y centavos", async () => {
    const ids = [
      (await vender("797.10", [100.05, 200.1])).id,
      (await vender("1500", [1700.3])).id, // sobrepago de 200,30
      (await vender("333.33", [333.33], { etapa: "ganado_completo" })).id,
      (await vender("0.07", [0.01])).id,
    ];
    const d = await dineroDeVentas(db, ids);
    expect(d.sobrepago).toBe(200.3);
    expect(Math.round((d.recaudado + d.porCobrar - d.sobrepago) * 100)).toBe(Math.round(d.vendido * 100));
    // La función pura y la de base dicen lo mismo.
    expect(dineroDeSaldos((await saldosDeDeals(db, ids)).values())).toEqual(d);
  });

  it("sin valor vendido queda fuera; con abonos en otra moneda cuenta en Vendido pero no en Recaudado ni Por cobrar, y se cuenta aparte", async () => {
    const sinValor = await vender(null, [50]);
    const otraMoneda = await vender("100", []);
    await db.insert(abonos).values({ programId, dealId: otraMoneda.id, registradoPorUserId: closerA.id, fecha: "2026-10-06", monto: "400000", moneda: "COP" });
    const buena = await vender("100", [40]);
    expect(await dineroDeVentas(db, [sinValor.id, otraMoneda.id, buena.id])).toEqual({
      vendido: 200, recaudado: 40, porCobrar: 60, sobrepago: 0, ventas: 1, sinSaldoCalculable: 2, sinValorVendido: 1,
    });
  });
});

describe("siguen los filtros del Hub y la lista suma lo mismo (369)", () => {
  it("cohorte, periodo y closer acotan las tres cifras; otro programa, cortesía y anulado no entran", async () => {
    const [c1, c2] = await db.insert(cohorts).values([
      { programId, codigo: "C1", metaCupos: 10, precioUsd: "1500", fechaInicioClases: "2026-11-01", fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-10-31", estado: "activo" },
      { programId, codigo: "C2", metaCupos: 10, precioUsd: "1500", fechaInicioClases: "2026-12-01", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", estado: "cerrado" },
    ]).returning();
    await vender("1500", [1500], { cohortId: c1.id, owner: closerA, etapa: "ganado_completo" });
    await vender("1000", [250], { cohortId: c1.id, owner: closerB });
    await vender("900", [100], { cohortId: c2.id, owner: closerA });
    await vender("700", [0], { cohortId: c1.id, owner: closerA, dia: "2026-09-10" }); // fuera del periodo
    await vender("5000", [5000], { programa: otroPrograma });
    const cortesia = await vender("0", [], { cohortId: c1.id });
    await db.update(deals).set({ cortesia: true }).where(eq(deals.id, cortesia.id));
    const anulada = await vender("4000", [4000], { cohortId: c1.id });
    await db.update(deals).set({ anuladoEn: AHORA, anuladoPor: closerA.id, motivoAnulacion: "Error de prueba" }).where(eq(deals.id, anulada.id));

    const vista = (extra: Record<string, unknown>) => armarVistaDelDashboard({
      programId, hoy: HOY, ahora: AHORA, preset: "custom", periodo: { preset: "custom", a: RANGO },
      filtroDeCohorte: {}, ...extra,
    }, db);
    expect((await vista({ filtroDeCohorte: { parametro: "todas" } })).dinero).toMatchObject({ vendido: 3400, recaudado: 1850, porCobrar: 1550 });
    expect((await vista({ filtroDeCohorte: { parametro: c1.id } })).dinero).toMatchObject({ vendido: 2500, recaudado: 1750, porCobrar: 750 });
    expect((await vista({ filtroDeCohorte: { parametro: c1.id }, claveCloser: closerB.id })).dinero).toMatchObject({ vendido: 1000, recaudado: 250, porCobrar: 750 });
    expect((await vista({ filtroDeCohorte: { parametro: c2.id } })).ventasPorCohorte).toEqual([
      expect.objectContaining({ codigo: "C2", dinero: expect.objectContaining({ vendido: 900, recaudado: 100, porCobrar: 800 }) }),
    ]);
  });

  it("la lista de ventas lleva las tres columnas y, sumadas página por página, dan el resumen", async () => {
    const total = TAMANO_PAGINA + 7;
    for (let i = 0; i < total; i += 1) await vender("100", [i % 3 === 0 ? 100 : 25], { etapa: i % 3 === 0 ? "ganado_completo" : "ganado_parcial" });
    const filtros = { programId, rango: RANGO, hoy: HOY, ahora: AHORA };
    for (const metrica of ["contratado", "cierres"] as const) {
      const [resumen] = await resumenDeMetrica(metrica, filtros, db);
      const paginas = [(await listaDeMetrica(metrica, filtros, 1, db))[0], (await listaDeMetrica(metrica, filtros, 2, db))[0]];
      const filas = paginas.flatMap((p) => p.filas);
      expect(filas).toHaveLength(total);
      const suma = (campo: "monto" | "recaudado" | "porCobrar") => Math.round(filas.reduce((n, f) => n + (f[campo] ?? 0), 0) * 100) / 100;
      expect(resumen.dinero).toBeDefined();
      expect(suma("monto")).toBe(resumen.dinero!.vendido);
      expect(suma("recaudado")).toBe(resumen.dinero!.recaudado);
      expect(suma("porCobrar")).toBe(resumen.dinero!.porCobrar);
      expect(paginas[0].dinero).toEqual(resumen.dinero);
    }
    // Las listas que no son de ventas no llevan las columnas.
    expect((await resumenDeMetrica("caja", filtros, db))[0].dinero).toBeUndefined();
  });
});

describe("paridad con la cartera que existía (369)", () => {
  it("Por cobrar con «Todas» y «Desde el inicio» = la suma de saldos de los deals en Abonado", async () => {
    await vender("1500", [500]);
    await vender("1000", [1000], { etapa: "ganado_completo" });
    await vender("800", [300]);
    // La fórmula que tenía `carteraDelPrograma`: deals vigentes en Abonado y sin cortesía, saldo positivo.
    const abonados = await db.select({ id: deals.id }).from(deals).where(and(eq(deals.programId, programId), eq(deals.cortesia, false), eq(deals.etapa, "ganado_parcial"), vigente(deals)));
    const saldos = await saldosDeDeals(db, abonados.map((d) => d.id));
    const carteraDeAntes = [...saldos.values()].reduce((n, s) => n + (s.saldo !== null && s.saldo > 0 ? s.saldo : 0), 0);

    const vista = await armarVistaDelDashboard({
      programId, hoy: HOY, ahora: AHORA, preset: "custom", periodo: { preset: "desde_el_inicio" }, filtroDeCohorte: { parametro: "todas" },
    }, db);
    expect(carteraDeAntes).toBe(1500 - 500 + 800 - 300);
    expect(vista.dinero.porCobrar).toBe(carteraDeAntes);
  });
});
