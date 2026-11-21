import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cohorts, dealEtapaHistorial, dealLineas, deals, leads, productos, programs, skus, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ventasDelRangoConValor } from "@/lib/queries/dashboard";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let skuVirtual: string;
let skuUnoAUno: string;
let ownerUserId: string;

const HOY = "2026-11-20";
const RANGO = { desde: "2026-11-01", hasta: HOY };

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [programa, ajeno] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "sku-hub", nombre: "SKU Hub", ticketUsd: "200" },
    { ...PROGRAMA_DE_PRUEBA, slug: "sku-hub-ajeno", nombre: "SKU Hub ajeno", ticketUsd: "200" },
  ]).returning();
  programId = programa.id;
  [ownerUserId] = (await db.insert(users).values({ email: "sku-hub@retia.test", rol: "closer", closerId: "SKU Hub" }).returning()).map((fila) => fila.id);
  const [cohorte, cohorteAjena] = await db.insert(cohorts).values([
    { programId, codigo: "C3", metaCupos: 10, precioUsd: "200", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01" },
    { programId: ajeno.id, codigo: "C3", metaCupos: 10, precioUsd: "200", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01" },
  ]).returning();
  const [virtual, unoAUno, ajenoProducto] = await db.insert(productos).values([
    { programId, nombre: "Virtual C3", slug: "virtual-c3" },
    { programId, nombre: "Uno a uno C3", slug: "uno-a-uno-c3" },
    { programId: ajeno.id, nombre: "Solo ajeno", slug: "solo-ajeno" },
  ]).returning();
  const filas = await db.insert(skus).values([
    { programId, nombre: virtual.nombre, slug: virtual.slug, productoId: virtual.id, cohortId: cohorte.id, codigo: "VIRTUAL-C3", precioListaUsd: "200", cuentaComoCupo: true },
    { programId, nombre: unoAUno.nombre, slug: unoAUno.slug, productoId: unoAUno.id, cohortId: cohorte.id, codigo: "UNO-C3", precioListaUsd: "100", cuentaComoCupo: true },
    { programId: ajeno.id, nombre: ajenoProducto.nombre, slug: ajenoProducto.slug, productoId: ajenoProducto.id, cohortId: cohorteAjena.id, codigo: "AJENO-C3", precioListaUsd: "100" },
  ]).returning();
  skuVirtual = filas[0].id;
  skuUnoAUno = filas[1].id;

  const crearVenta = async (numero: number, lineas: Array<{ skuId: string; valor: string }>, total: string) => {
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `sku-${numero}@retia.test`, entrada: "crm" }).returning();
    const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, cohortId: cohorte.id, ownerUserId, etapa: "ganado_parcial", valorVendidoUsd: total }).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: new Date(`2026-11-0${numero + 4}T10:00:00-05:00`) });
    await db.insert(dealLineas).values(lineas.map((linea) => ({ dealId: deal.id, programId, skuId: linea.skuId, precioListaUsd: linea.valor, valorVendidoUsd: linea.valor })));
  };
  await crearVenta(1, [{ skuId: skuVirtual, valor: "200" }, { skuId: skuUnoAUno, valor: "100" }], "300");
  await crearVenta(2, [{ skuId: skuVirtual, valor: "200" }], "200");
}, 60_000);

const alcance = (filtros = {}) => ({ programId, rango: RANGO, ...filtros });
const vista = (filtros = {}) => armarVistaDelDashboard({
  programId, hoy: HOY, preset: "custom", periodo: { preset: "custom", a: RANGO },
  filtroDeCohorte: { parametro: "todas" }, filtrosDeSku: filtros,
}, db);

describe("filtros de SKU del Hub", () => {
  it("cuenta una vez el deal con dos líneas y aparece bajo cada nombre y cada SKU", async () => {
    expect(await ventasDelRangoConValor(alcance(), db)).toHaveLength(2);
    expect(await ventasDelRangoConValor(alcance({ nombreDeSku: "virtual-c3" }), db)).toHaveLength(2);
    expect(await ventasDelRangoConValor(alcance({ nombreDeSku: "uno-a-uno-c3" }), db)).toHaveLength(1);
    expect(await ventasDelRangoConValor(alcance({ skuId: skuVirtual }), db)).toHaveLength(2);
    expect(await ventasDelRangoConValor(alcance({ skuId: skuUnoAUno }), db)).toHaveLength(1);
  });

  it("mantiene coherentes las cifras filtradas del Hub con los deals que casan", async () => {
    const [virtual, uno] = await Promise.all([vista({ nombreDeSku: "virtual-c3" }), vista({ skuId: skuUnoAUno })]);
    expect({ ventas: virtual.embudo.cierres, skus: virtual.dinero.lineas, vendido: virtual.dinero.vendido, recaudado: virtual.dinero.recaudado, porCobrar: virtual.dinero.porCobrar })
      .toEqual({ ventas: 2, skus: 2, vendido: 400, recaudado: 0, porCobrar: 400 });
    expect({ ventas: uno.embudo.cierres, skus: uno.dinero.lineas, vendido: uno.dinero.vendido, recaudado: uno.dinero.recaudado, porCobrar: uno.dinero.porCobrar })
      .toEqual({ ventas: 1, skus: 1, vendido: 100, recaudado: 0, porCobrar: 100 });
  });

  it("sin filtro de SKU: 2 ventas (deals) y 3 SKUs vendidos; el dinero suma las líneas", async () => {
    const todas = await vista();
    expect({ ventas: todas.embudo.cierres, skus: todas.dinero.lineas, vendido: todas.dinero.vendido, porCobrar: todas.dinero.porCobrar })
      .toEqual({ ventas: 2, skus: 3, vendido: 500, porCobrar: 500 });
  });

  it("un slug que solo existe en otro programa no casa ningún deal", async () => {
    expect(await ventasDelRangoConValor(alcance({ nombreDeSku: "solo-ajeno" }), db)).toEqual([]);
  });
});
