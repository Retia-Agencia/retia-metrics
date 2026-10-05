import { afterEach, beforeEach, expect, it } from "vitest";
import { abonos, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { leerMetasDelMes } from "@/lib/queries/metas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroPrograma: string;
let cohortId: string;
let ana: string;
let beto: string;
let contador: number;
const hoy = "2026-10-05";
const rango = { desde: "2026-10-01", hasta: hoy };

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
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
afterEach(async () => { await cerrar(); });

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

it("cada mes cuadra con las tarjetas y con Metas; anulación, reversa y otro programa no se cuelan", async () => {
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
  const serie = await leerSeriesDeDinero({ programId, rango, hoy }, db);
  expect(serie.programId).toBe(programId);
  expect(serie.meses.map((m) => m.mes)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  for (const mes of serie.meses.slice(4)) {
    const vista = await armarVistaDelDashboard({ programId, hoy, preset: "custom", desde: mes.rango.desde, hasta: mes.rango.hasta }, db);
    const metas = await leerMetasDelMes(programId, mes.mes, hoy, db);
    expect(mes.contratadoUsd).toBe(vista.contratadoUsd);
    expect(mes.cupos).toBe(vista.embudo.cierres);
    expect(mes.caja.filter((c) => c.total !== 0)).toEqual(vista.caja.sort((a, b) => a.moneda.localeCompare(b.moneda)));
    expect(mes.cupos).toBe(metas.vendidos);
    expect(mes.contratadoUsd).toBe(metas.contratadoUsd);
    expect(mes.metaUsd).toBe(metas.mesSinVentana ? null : metas.metaUsd);
    expect(mes.metaCupos).toBe(metas.mesSinVentana ? null : metas.metaCupos);
  }
  expect(serie.meses[4]).toMatchObject({ contratadoUsd: 80, cupos: 1 });
  expect(serie.meses[5]).toMatchObject({ contratadoUsd: 120.35, cupos: 2, sinValorVendido: 1, metaCupos: 22, metaUsd: 2200,
    caja: [{ moneda: "COP", total: 450000 }, { moneda: "USD", total: 25.15 }] });
});

it("respeta el closer como las tarjetas: dueño en ventas y registrador en caja, sin repartir meta", async () => {
  const deAna = await venta({ dia: "2026-10-01", owner: ana, valor: "80" });
  const deBeto = await venta({ dia: "2026-10-02", owner: beto, valor: "140" });
  await db.insert(abonos).values([
    { programId, dealId: deBeto, registradoPorUserId: ana, fecha: hoy, moneda: "USD", monto: "20" },
    { programId, dealId: deAna, registradoPorUserId: beto, fecha: hoy, moneda: "USD", monto: "30" },
    { programId, dealId: deBeto, closerId: " ANA ", fecha: hoy, moneda: "USD", monto: "5" },
  ]);
  const serie = await leerSeriesDeDinero({ programId, rango, hoy, claveCloser: ana }, db);
  const vista = await armarVistaDelDashboard({ programId, hoy, preset: "mes", claveCloser: ana }, db);
  const metas = await leerMetasDelMes(programId, "2026-10", hoy, db);
  expect(serie.meses[5]).toMatchObject({ contratadoUsd: vista.contratadoUsd, cupos: vista.embudo.cierres, caja: vista.caja,
    metaCupos: metas.metaCupos, metaUsd: metas.metaUsd });
  expect(serie.meses[5]).toMatchObject({ contratadoUsd: 80, cupos: 1, caja: [{ moneda: "USD", total: 25 }] });
});

it("acumula fines de semana y compara cada punto al mismo hábil, sin arrastrar el mes anterior entero", async () => {
  await venta({ dia: "2026-10-01", valor: "100" });
  const sabado = await venta({ dia: "2026-10-03", valor: "50" });
  await venta({ dia: "2026-09-01", valor: "20" });
  await venta({ dia: "2026-09-03", valor: "30" });
  await venta({ dia: "2026-09-04", valor: "999" });
  await db.insert(abonos).values({ programId, dealId: sabado, fecha: "2026-10-04", moneda: "USD", monto: "15" });
  const serie = await leerSeriesDeDinero({ programId, rango, hoy }, db);
  const acumulado = serie.acumulado!;
  expect(acumulado.b).toEqual({ desde: "2026-09-01", hasta: "2026-09-03" });
  expect(acumulado.puntos.map((p) => p.diaAnterior)).toEqual(["2026-09-01", "2026-09-02", "2026-09-02", "2026-09-02", "2026-09-03"]);
  expect(acumulado.puntos.map((p) => p.actual.contratadoUsd)).toEqual([100, 100, 150, 150, 150]);
  expect(acumulado.puntos.map((p) => p.anterior?.contratadoUsd)).toEqual([20, 20, 20, 20, 50]);
  expect(acumulado.puntos.at(-1)!.actual).toMatchObject({ contratadoUsd: serie.meses[5].contratadoUsd, cupos: serie.meses[5].cupos, caja: serie.meses[5].caja });
  const vista = await armarVistaDelDashboard({ programId, hoy, preset: "mes", periodo: { preset: "este_mes" } }, db);
  expect(acumulado.b).toEqual(vista.periodo.b);
  expect(acumulado.puntos.at(-1)!.anterior?.contratadoUsd).toBe(vista.anterior!.contratadoUsd);
});

it("historia en lotes por mes, huecos en cero, cambio de año y ninguna meta inventada", async () => {
  await venta({ dia: "2025-09-10", valor: "40" });
  await venta({ dia: "2025-09-11", valor: "60" });
  const serie = await leerSeriesDeDinero({ programId, rango: { desde: "2026-01-15", hasta: "2026-01-31" }, hoy }, db);
  expect(serie.meses.map((m) => m.mes)).toEqual(["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
  expect(serie.meses[1]).toMatchObject({ contratadoUsd: 100, cupos: 2 });
  expect(serie.meses[5]).toMatchObject({ contratadoUsd: 0, cupos: 0, metaUsd: null, metaCupos: null });
  expect(serie.acumulado!.a).toEqual({ desde: "2026-01-01", hasta: "2026-01-31" });
});

it("un mes que empieza en fin de semana no inventa comparación; B más corto deja huecos", async () => {
  await venta({ dia: "2026-08-01", valor: "50" });
  const inicio = await leerSeriesDeDinero({ programId, rango: { desde: "2026-08-01", hasta: "2026-08-02" }, hoy }, db);
  expect(inicio.acumulado!.b).toBeNull();
  expect(inicio.acumulado!.puntos.map((p) => p.anterior)).toEqual([null, null]);
  expect(inicio.acumulado!.puntos.at(-1)!.actual.contratadoUsd).toBe(50);
  const largo = await leerSeriesDeDinero({ programId, rango: { desde: "2026-03-01", hasta: "2026-03-31" }, hoy }, db);
  expect(largo.acumulado!.puntos.at(-1)!.anterior).toBeNull();
  expect(largo.acumulado!.puntos.at(-1)!.diaAnterior).toBeNull();
});

it("corta a hoy en Bogotá aunque A alcance el futuro y deja ausente el acumulado de un mes futuro", async () => {
  await venta({ dia: "2026-10-06", valor: "999" });
  const actual = await leerSeriesDeDinero({ programId, rango: { desde: "2026-10-01", hasta: "2026-10-31" }, hoy }, db);
  expect(actual.meses[5].rango.hasta).toBe(hoy);
  expect(actual.meses[5].cupos).toBe(0);
  const futuro = await leerSeriesDeDinero({ programId, rango: { desde: "2026-11-01", hasta: "2026-11-30" }, hoy }, db);
  expect(futuro.acumulado).toBeNull();
});
