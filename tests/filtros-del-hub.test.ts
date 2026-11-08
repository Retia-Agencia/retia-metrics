import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, cohorts, deals, dealEtapaHistorial, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { listaDeMetrica, resumenDeMetrica } from "@/lib/queries/metricas-con-filas";
import { cohorteDeLaUrl } from "@/lib/queries/cohorte-del-hub";
import { urlDeLista, vistaDeLista } from "@/lib/queries/vista-metrica";
import { fraseSinActividad, lineaDeLaCohorte } from "@/lib/hub/linea-de-cohorte";
import { parsearPeriodoUrl, type PeriodoResuelto } from "@/lib/periodo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 377 — los filtros del Hub: Cohorte y Periodo cada uno por su lado.
 * La cohorte filtra por `deals.cohort_id` en SQL, en todos los hechos; el periodo, cada hecho por su ancla.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let otroPrograma: string;
let c1: string;
let c2: string;
let cAjena: string;

const HOY = "2026-09-15";
const SEPTIEMBRE = { desde: "2026-09-01", hasta: "2026-09-30" };
const periodoDe = (rango = SEPTIEMBRE): PeriodoResuelto => ({ preset: "custom", a: rango, b: null });

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});

async function vender(programId: string, cohortId: string, email: string, dia: string, ownerUserId?: string) {
  const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: new Date(`${dia}T08:00:00-05:00`), programId, emailNormalizado: email }).returning();
  const [deal] = await db.insert(deals).values({
    programId, leadId: lead.id, cohortId, etapa: "ganado_parcial", valorVendidoUsd: "100", ownerUserId: ownerUserId ?? null,
  }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: new Date(`${dia}T10:00:00-05:00`) });
  await db.insert(abonos).values({ programId, dealId: deal.id, fecha: dia, monto: "50", moneda: "USD" });
  return deal.id;
}

beforeEach(async () => {
  await vaciar();
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" }).returning();
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1500.00" }).returning();
  programaA = a.id;
  otroPrograma = b.id;
  const base = { metaCupos: 50, precioUsd: "797.00" };
  const filas = await db.insert(cohorts).values([
    { ...base, programId: programaA, codigo: "C2", estado: "activo", fechaInicioClases: "2026-10-01", fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-09-30" },
    { ...base, programId: programaA, codigo: "C1", estado: "cerrado", fechaInicioClases: "2026-09-01", fechaInicioVentas: "2026-08-03", fechaCierreVentas: "2026-08-31" },
    { ...base, programId: otroPrograma, codigo: "AJENA", estado: "activo", fechaInicioClases: "2026-10-05", fechaInicioVentas: "2026-07-01", fechaCierreVentas: "2026-09-30" },
  ]).returning();
  c2 = filas.find((c) => c.codigo === "C2")!.id;
  c1 = filas.find((c) => c.codigo === "C1")!.id;
  cAjena = filas.find((c) => c.codigo === "AJENA")!.id;
  // C2: dos ventas en septiembre y una anterior al inicio de ventas (20-ago). C1: una venta en septiembre.
  await vender(programaA, c2, "c2a@x.co", "2026-09-10");
  await vender(programaA, c2, "c2b@x.co", "2026-09-12");
  await vender(programaA, c2, "c2antes@x.co", "2026-08-20");
  await vender(programaA, c1, "c1a@x.co", "2026-09-05");
  await vender(programaA, c1, "c1b@x.co", "2026-08-10");
  await vender(programaA, c1, "c1c@x.co", "2026-08-11");
  await vender(otroPrograma, cAjena, "ajeno@x.co", "2026-09-06");
}, 60_000);

const vistaCon = (parametro: string | undefined, periodo = periodoDe()) =>
  armarVistaDelDashboard({
    programId: programaA, hoy: HOY, preset: "hoy",
    periodo: { preset: "custom", a: periodo.a },
    filtroDeCohorte: { parametro },
  }, db);

describe("Cohorte y Periodo se cruzan con Y", () => {
  it("con C2 y septiembre, Vendido cuenta las ventas de C2 de ese mes; con C1 solo las suyas", async () => {
    const deC2 = await vistaCon(c2);
    expect(deC2.embudo.cierres).toBe(2);
    expect(deC2.caja).toEqual([{ moneda: "USD", total: 100 }]);
    const deC1 = await vistaCon(c1);
    expect(deC1.embudo.cierres).toBe(1);
    expect(deC1.caja).toEqual([{ moneda: "USD", total: 50 }]);
    // Sin filtro de cohorte (Hoy, Mi espacio): las tres ventas de septiembre.
    const sinFiltro = await armarVistaDelDashboard({ programId: programaA, hoy: HOY, preset: "hoy", periodo: { preset: "custom", a: SEPTIEMBRE } }, db);
    expect(sinFiltro.embudo.cierres).toBe(3);
  });

  it.each(["cierres", "caja", "contratado", "deals_creados"] as const)("la cifra de %s y su lista dan lo mismo, en todas sus páginas", async (metrica) => {
    for (const cohorteId of [c2, c1]) {
      const filtros = { programId: programaA, rango: SEPTIEMBRE, hoy: HOY, cohorteId };
      const [resumen] = await resumenDeMetrica(metrica, filtros, db);
      const [pagina1] = await listaDeMetrica(metrica, filtros, 1, db);
      expect(pagina1.filas.length).toBe(resumen.subtotal.cantidad);
    }
    const [deC2] = await resumenDeMetrica(metrica, { programId: programaA, rango: SEPTIEMBRE, hoy: HOY, cohorteId: c2 }, db);
    const [deC1] = await resumenDeMetrica(metrica, { programId: programaA, rango: SEPTIEMBRE, hoy: HOY, cohorteId: c1 }, db);
    const [todas] = await resumenDeMetrica(metrica, { programId: programaA, rango: SEPTIEMBRE, hoy: HOY }, db);
    // Las cohortes se reparten el programa, sin que ninguna venta cuente en las dos.
    expect(deC2.subtotal.cantidad + deC1.subtotal.cantidad).toBe(todas.subtotal.cantidad);
  });

  it("cifra y lista de Vendido cuadran con la que arma el Hub", async () => {
    const vista = await vistaCon(c2);
    const [lista] = await listaDeMetrica("cierres", { programId: programaA, rango: SEPTIEMBRE, hoy: HOY, cohorteId: c2 }, 1, db);
    expect(lista.filas.length).toBe(vista.embudo.cierres);
  });

  it("un cruce que no se toca queda vacío, no inventa ventas de otra cohorte", async () => {
    const octubre = { desde: "2026-10-01", hasta: "2026-10-31" };
    const vista = await vistaCon(c2, periodoDe(octubre));
    expect(vista.embudo.cierres).toBe(0);
    expect(vista.caja).toEqual([]);
    expect(fraseSinActividad("C2", { ...periodoDe(octubre), preset: "mes_pasado" })).toBe("C2 no tuvo actividad en octubre. Elige otro periodo o Desde el inicio.");
  });
});

describe("Todas + Desde el inicio es la historia del programa", () => {
  it("suma todas las ventas del programa y nunca las de otro", async () => {
    const vista = await armarVistaDelDashboard({
      programId: programaA, hoy: HOY, preset: "hoy",
      periodo: parsearPeriodoUrl({ periodo: "desde_el_inicio" }),
      filtroDeCohorte: { parametro: "todas" },
    }, db);
    expect(vista.filtroDeCohorte.elegida).toBeNull();
    expect(vista.periodo.preset).toBe("desde_el_inicio");
    // Lo más temprano del programa A: el inicio de ventas de C1 (3-ago), no el 1-jul del programa ajeno.
    expect(vista.periodo.a).toEqual({ desde: "2026-08-03", hasta: HOY });
    expect(vista.embudo.cierres).toBe(6);
    expect(vista.filtroDeCohorte.ventas).toHaveLength(6);
  });
});

describe("Comparar con la cohorte anterior compara dos cohortes, no dos fechas", () => {
  it("B se consulta con las ventas de la cohorte anterior, no con las de la elegida en otras fechas", async () => {
    const vista = await armarVistaDelDashboard({
      programId: programaA, hoy: HOY, preset: "hoy",
      periodo: parsearPeriodoUrl({ periodo: "desde_el_inicio", comparar: "cohorte" }),
      filtroDeCohorte: { parametro: c2 },
    }, db);
    // A: C2 desde su primera venta (20-ago) hasta hoy. B: la ventana de C1 al mismo hábil, con las ventas de C1.
    expect(vista.periodo.a.desde).toBe("2026-08-20");
    expect(vista.periodo.b?.desde).toBe("2026-08-03");
    expect(vista.filtroDeCohorte.cohorteIdDeB).toBe(c1);
    expect(vista.embudo.cierres).toBe(3);
    expect(vista.anterior?.embudo.cierres).toBe(2);
    expect(vista.anterior?.caja).toEqual([{ moneda: "USD", total: 100 }]);
  });
  it("una comparación por rango conserva la cohorte del filtro", async () => {
    const vista = await armarVistaDelDashboard({
      programId: programaA, hoy: HOY, preset: "hoy",
      periodo: parsearPeriodoUrl({ periodo: "este_mes", comparar: "2026-08-01_2026-08-31" }),
      filtroDeCohorte: { parametro: c2 },
    }, db);
    expect(vista.filtroDeCohorte.cohorteIdDeB).toBe(c2);
    expect(vista.anterior?.embudo.cierres).toBe(1);
  });
});

describe("la línea bajo el filtro Cohorte", () => {
  it("muestra la primera venta real aunque sea anterior al inicio de ventas, y lo dice", async () => {
    const vista = await vistaCon(c2);
    const { elegida, ventas } = vista.filtroDeCohorte;
    const linea = lineaDeLaCohorte({ cohorte: elegida && { codigo: elegida.codigo, metaCupos: elegida.metaCupos, inicioVentas: elegida.inicioVentas, cierreVentas: elegida.cierreVentas }, ventas });
    expect(linea).toMatch(/^C2 · se vende del 1-sep(-2026)? al 30-sep(-2026)? · primera venta: 20-ago(-2026)? · última: 12-sep(-2026)? · 3 vendidos de 50 · 1 venta anterior al inicio de ventas$/);
  });
  it("sin ventas dice 'aún sin ventas' y con Todas nombra la primera del programa", () => {
    expect(lineaDeLaCohorte({ cohorte: { codigo: "C3", metaCupos: 40, inicioVentas: "2026-11-01", cierreVentas: "2026-11-30" }, ventas: [] })).toMatch(/^C3 · se vende del 1-nov.* al 30-nov.* · aún sin ventas$/);
    expect(lineaDeLaCohorte({ cohorte: null, ventas: [{ dia: "2026-05-12" }] })).toMatch(/^Todas las cohortes · primera venta del programa: 12-may/);
    expect(lineaDeLaCohorte({ cohorte: null, ventas: [] })).toBe("Todas las cohortes · aún sin ventas");
  });
});

describe("enlaces viejos y fronteras", () => {
  it.each([
    [{ periodo: "cohorte_actual" }, "C2"],
    [{ rango: "cohorte" }, "C2"],
    [{ periodo: "cohorte_anterior" }, "C1"],
  ])("el enlace %j abre con la cohorte que pedía y Desde el inicio", async (url, codigo) => {
    const vista = await armarVistaDelDashboard({
      programId: programaA, hoy: HOY, preset: "hoy",
      periodo: parsearPeriodoUrl(url),
      filtroDeCohorte: {},
    }, db);
    expect(vista.filtroDeCohorte.elegida?.codigo).toBe(codigo);
    expect(vista.periodo.preset).toBe("desde_el_inicio");
  });

  it("sin parámetro rige la cohorte activa (DH-1)", async () => {
    const vista = await vistaCon(undefined);
    expect(vista.filtroDeCohorte.elegida?.codigo).toBe("C2");
    expect(vista.filtroDeCohorte.opciones.map((o) => [o.codigo, o.activa])).toEqual(expect.arrayContaining([["C2", true], ["C1", false]]));
  });

  it("una cohorte de otro programa se ignora: el programa es frontera", async () => {
    const vista = await vistaCon(cAjena);
    expect(vista.filtroDeCohorte.elegida?.codigo).toBe("C2");
    expect(vista.filtroDeCohorte.opciones.map((o) => o.id)).not.toContain(cAjena);
    expect(vista.embudo.cierres).toBe(2);
  });

  it("en una lista, una cohorte ajena no filtra y una propia sí", async () => {
    const base = { programId: programaA, metrica: "cierres" as const, hoy: HOY, pagina: 1, busqueda: { periodo: "custom", a_desde: SEPTIEMBRE.desde, a_hasta: SEPTIEMBRE.hasta, sin_b: "1" } };
    expect((await vistaDeLista({ ...base, cohorteId: cAjena }, db))!.lista.subtotal.cantidad).toBe(3);
    expect((await vistaDeLista({ ...base, cohorteId: c1 }, db))!.lista.subtotal.cantidad).toBe(1);
  });

  it("la URL de una lista lleva la cohorte, y solo valores válidos entran por el borde", () => {
    const periodo = periodoDe();
    const href = urlDeLista({ slug: "programa-a", metrica: "cierres", periodo, origen: "/p/programa-a/hub", cohorteId: c2 });
    expect(new URL(href, "http://x").searchParams.get("cohorte")).toBe(c2);
    expect(new URL(urlDeLista({ slug: "programa-a", metrica: "cierres", periodo, origen: "/p/programa-a/hub" }), "http://x").searchParams.has("cohorte")).toBe(false);
    expect(cohorteDeLaUrl(c2)).toBe(c2);
    expect(cohorteDeLaUrl("todas")).toBe("todas");
    expect(cohorteDeLaUrl("no-es-uuid")).toBeUndefined();
    expect(cohorteDeLaUrl(["todas", "todas"])).toBeUndefined();
  });
});

