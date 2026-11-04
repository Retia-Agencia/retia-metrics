import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { abonos, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { leerMetasDelMes } from "@/lib/queries/metas";
import { tramosDe, valoresPorTramo } from "@/lib/series-pasos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroPrograma: string;
let cohortId: string;
let ana: string;
let beto: string;
let contador: number;
const hoy = "2026-10-05";
const rango = { desde: "2026-10-01", hasta: hoy };

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "serie-a", nombre: "Serie A", ticketUsd: "100" },
    { ...PROGRAMA_DE_PRUEBA, slug: "serie-b", nombre: "Serie B", ticketUsd: "100" },
  ]).returning();
  [programId, otroPrograma] = programas.map((p) => p.id);
  const cuentas = await db.insert(users).values([
    { email: "ana@serie.test", rol: "closer", closerId: "Ana" },
    { email: "beto@serie.test", rol: "closer", closerId: "Beto" },
  ]).returning();
  [ana, beto] = cuentas.map((u) => u.id);
  const [cohorte] = await db.insert(cohorts).values({
    programId, codigo: "SERIE", metaCupos: 22, precioUsd: "100",
    fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-10-31",
    fechaInicioClases: "2026-11-01", estado: "activo",
  }).returning();
  cohortId = cohorte.id;
  contador = 0;
});
afterAll(async () => cerrar());

async function venta(args: {
  dia: string;
  valor?: string | null;
  programa?: string;
  owner?: string;
  anulada?: boolean;
  revertida?: boolean;
  completa?: boolean;
}) {
  const programa = args.programa ?? programId;
  const [lead] = await db.insert(leads).values({ programId: programa, emailNormalizado: `lead-${++contador}@serie.test` }).returning();
  const [deal] = await db.insert(deals).values({
    programId: programa, leadId: lead.id, ownerUserId: args.owner ?? ana,
    cohortId: programa === programId ? cohortId : null,
    valorVendidoUsd: args.valor === undefined ? "100" : args.valor,
    etapa: args.revertida ? "contactado" : args.completa ? "ganado_completo" : "ganado_parcial",
    anuladoEn: args.anulada ? new Date("2026-10-05T12:00:00-05:00") : null,
    anuladoPor: args.anulada ? ana : null,
    motivoAnulacion: args.anulada ? "Error de registro" : null,
  }).returning();
  await db.insert(dealEtapaHistorial).values({
    dealId: deal.id, a: "ganado_parcial", fecha: new Date(`${args.dia}T23:30:00-05:00`),
  });
  if (args.revertida || args.completa) await db.insert(dealEtapaHistorial).values({
    dealId: deal.id, de: "ganado_parcial", a: args.revertida ? "contactado" : "ganado_completo",
    fecha: new Date("2026-10-05T12:00:00-05:00"),
  });
  return deal.id;
}

const pedir = (extra: Partial<Parameters<typeof leerSeriesDeDinero>[0]> = {}) =>
  leerSeriesDeDinero({ programId, a: { rango, cohorteId: null }, b: null, claveCloser: null, hoy, ...extra }, db);
const total = (mapa: Map<string, number>) => [...mapa.values()].reduce((n, v) => n + v, 0);

it("los días del periodo cuadran con las cifras; anulación, reversa y otro programa no se cuelan", async () => {
  const septiembre = await venta({ dia: "2026-09-30", valor: "80", completa: true });
  const octubre = await venta({ dia: "2026-10-02", valor: "120.35" });
  await venta({ dia: "2026-10-03", valor: null });
  await venta({ dia: "2026-10-01", valor: "900", anulada: true });
  await venta({ dia: "2026-10-01", valor: "800", revertida: true });
  const ajena = await venta({ dia: "2026-10-02", valor: "700", programa: otroPrograma });
  await db.insert(abonos).values([
    { programId, dealId: septiembre, registradoPorUserId: ana, fecha: "2026-10-03", moneda: "USD", monto: "25.15" },
    { programId, dealId: octubre, registradoPorUserId: ana, fecha: "2026-10-04", moneda: "COP", monto: "450000" },
    { programId, dealId: octubre, fecha: "2026-10-02", moneda: "USD", monto: "999", anuladoEn: new Date(), anuladoPor: ana, motivoAnulacion: "Error" },
    { programId: otroPrograma, dealId: ajena, fecha: "2026-10-02", moneda: "USD", monto: "700" },
  ]);
  const serie = await pedir();
  const vista = await armarVistaDelDashboard({ programId, hoy, preset: "custom", desde: rango.desde, hasta: rango.hasta }, db);
  const metas = await leerMetasDelMes(programId, "2026-10", hoy, db);
  expect(serie.programId).toBe(programId);
  // Unidad Cupos cuenta ventas; unidad Plata suma Vendido: las dos cuadran con la cifra del periodo y con Metas.
  expect(total(serie.a.cuposPorDia)).toBe(vista.embudo.cierres);
  expect(total(serie.a.cuposPorDia)).toBe(metas.vendidos);
  expect(total(serie.a.usdPorDia)).toBe(vista.contratadoUsd);
  expect(serie.a.sinValorVendido).toBe(vista.sinValorVendido);
  expect(serie.a.cuposPorDia.get("2026-10-02")).toBe(1);
  expect([...serie.a.cajaPorMoneda].map(([moneda, dias]) => ({ moneda, total: total(dias) })).sort((x, y) => x.moneda.localeCompare(y.moneda)))
    .toEqual([...vista.caja].sort((x, y) => x.moneda.localeCompare(y.moneda)));
  expect(serie.monedas).toEqual(["COP", "USD"]);
  expect(serie.meta).toMatchObject({ cupos: 22, usd: 2200 });
});

it("cupos con caja: cada deal cuenta una vez, el día de su primer abono vigente del periodo", async () => {
  const dosAbonos = await venta({ dia: "2026-10-01" });
  const anulado = await venta({ dia: "2026-10-01" });
  await db.insert(abonos).values([
    { programId, dealId: dosAbonos, registradoPorUserId: ana, fecha: "2026-10-02", moneda: "USD", monto: "10" },
    { programId, dealId: dosAbonos, registradoPorUserId: ana, fecha: "2026-10-04", moneda: "USD", monto: "10" },
    { programId, dealId: dosAbonos, registradoPorUserId: ana, fecha: "2026-09-20", moneda: "USD", monto: "10" },
    { programId, dealId: anulado, registradoPorUserId: ana, fecha: "2026-10-03", moneda: "USD", monto: "10", anuladoEn: new Date(), anuladoPor: ana, motivoAnulacion: "Error" },
  ]);
  const serie = await pedir();
  expect([...serie.a.cuposConAbonoPorDia]).toEqual([["2026-10-02", 1]]);
  // Acumulado y por paso no inventan un segundo cupo por el segundo abono.
  const tramos = tramosDe(rango, "dia", hoy);
  expect(valoresPorTramo(serie.a.cuposConAbonoPorDia, tramos, "acum").at(-1)).toBe(1);
  expect(valoresPorTramo(serie.a.cuposConAbonoPorDia, tramos, "paso").reduce<number>((n, v) => n + (v ?? 0), 0)).toBe(1);
});

it("respeta el closer como las tarjetas: dueño en ventas y registrador en caja, sin repartir meta", async () => {
  const deAna = await venta({ dia: "2026-10-01", owner: ana, valor: "80" });
  const deBeto = await venta({ dia: "2026-10-02", owner: beto, valor: "140" });
  await db.insert(abonos).values([
    { programId, dealId: deBeto, registradoPorUserId: ana, fecha: hoy, moneda: "USD", monto: "20" },
    { programId, dealId: deAna, registradoPorUserId: beto, fecha: hoy, moneda: "USD", monto: "30" },
    { programId, dealId: deBeto, closerId: " ANA ", fecha: hoy, moneda: "USD", monto: "5" },
  ]);
  const serie = await pedir({ claveCloser: ana });
  const vista = await armarVistaDelDashboard({ programId, hoy, preset: "mes", claveCloser: ana }, db);
  expect(total(serie.a.usdPorDia)).toBe(vista.contratadoUsd);
  expect(total(serie.a.cuposPorDia)).toBe(vista.embudo.cierres);
  expect(total(serie.a.cajaPorMoneda.get("USD")!)).toBe(25);
  expect(serie.meta.cupos).toBe(22);
});

it("la cohorte elegida filtra A y B con su propia cohorte, y su meta es cupos por precio", async () => {
  const [otra] = await db.insert(cohorts).values({
    programId, codigo: "ANTES", metaCupos: 10, precioUsd: "50",
    fechaInicioVentas: "2026-08-01", fechaCierreVentas: "2026-08-31",
    fechaInicioClases: "2026-09-01", estado: "cerrado",
  }).returning();
  await venta({ dia: "2026-10-02", valor: "100" });
  const deAntes = await venta({ dia: "2026-08-05", valor: "50" });
  await db.update(deals).set({ cohortId: otra.id }).where(eq(deals.id, deAntes));
  const enB = { desde: "2026-08-01", hasta: "2026-08-31" };
  const serie = await pedir({ a: { rango, cohorteId: cohortId }, b: { rango: enB, cohorteId: otra.id } });
  expect(total(serie.a.cuposPorDia)).toBe(1);
  expect(total(serie.b!.cuposPorDia)).toBe(1);
  expect(serie.meta).toMatchObject({ etiqueta: "Meta de SERIE", cupos: 22, usd: 2200 });
  // Sin cohorte, la de A no se mezcla con la de B.
  const todas = await pedir({ a: { rango: enB, cohorteId: null } });
  expect(total(todas.a.cuposPorDia)).toBe(1);
});

it("no hay historia fija: un periodo de un año trae sus días y un mes sin ventana no inventa meta", async () => {
  await venta({ dia: "2025-09-10", valor: "40" });
  await venta({ dia: "2025-09-11", valor: "60" });
  const serie = await pedir({ a: { rango: { desde: "2025-09-01", hasta: "2026-01-31" }, cohorteId: null } });
  expect(total(serie.a.cuposPorDia)).toBe(2);
  expect(total(serie.a.usdPorDia)).toBe(100);
  expect(serie.meta).toMatchObject({ cupos: null, usd: null });
});
