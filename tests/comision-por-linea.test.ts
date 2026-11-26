/** Comisión por línea: valor por el % congelado de cada línea, congelado al primer abono. Es base porque el % se congela en deal_lineas. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { cohorts, dealEtapaHistorial, dealLineas, deals, leads, productos, programs, skus, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { congelarComisionDeLineas } from "@/lib/deals/comision-de-linea";
import { comisionesDeDeals } from "@/lib/queries/comision";
import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let ownerUserId: string;
let skuVirtual: string;
let skuUnoAUno: string;
let secuencia = 0;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "com-linea", nombre: "Comisión por línea", ticketUsd: "1000" }).returning();
  programId = programa.id;
  [ownerUserId] = (await db.insert(users).values({ email: "com-linea@retia.test", rol: "closer", closerId: "Com Linea" }).returning()).map((u) => u.id);
  const [cohorte] = await db.insert(cohorts).values({ programId, codigo: "C3", metaCupos: 10, precioUsd: "1000", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", fechaInicioClases: "2026-12-01" }).returning();
  const [virtual, unoAUno] = await db.insert(productos).values([
    { programId, nombre: "Virtual C3", slug: "virtual-c3" },
    { programId, nombre: "Uno a uno C3", slug: "uno-a-uno-c3" },
  ]).returning();
  const filas = await db.insert(skus).values([
    { programId, nombre: virtual.nombre, slug: virtual.slug, productoId: virtual.id, cohortId: cohorte.id, codigo: "VIRTUAL-C3", precioListaUsd: "1000", cuentaComoCupo: true, comisionPorcentaje: "10" },
    { programId, nombre: unoAUno.nombre, slug: unoAUno.slug, productoId: unoAUno.id, cohortId: cohorte.id, codigo: "UNO-C3", precioListaUsd: "200", cuentaComoCupo: false, comisionPorcentaje: "5" },
  ]).returning();
  skuVirtual = filas[0].id;
  skuUnoAUno = filas[1].id;
}, 60_000);

async function dealConLineas(lineas: Array<{ skuId: string; valor: string; pct: string | null; abonar: boolean }>) {
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `com-${++secuencia}@retia.test`, entrada: "crm" }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId, etapa: "ganado_parcial" }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial" });
  const ids: string[] = [];
  for (const linea of lineas) {
    const [fila] = await db.insert(dealLineas).values({
      dealId: deal.id, programId, skuId: linea.skuId, precioListaUsd: linea.valor,
      valorVendidoUsd: linea.valor, comisionPorcentaje: linea.pct,
    }).returning();
    ids.push(fila.id);
    if (linea.abonar) {
      await abonoDePrueba(db, { dealId: deal.id, lineaId: fila.id, programId, fecha: "2026-11-05", monto: "50", comprobanteUrl: "https://drive.google.com/abono" });
    }
  }
  return { dealId: deal.id, ids };
}

describe("comisión por línea", () => {
  it("un solo SKU: valor × % de la línea; 0 % no paga", async () => {
    const { dealId } = await dealConLineas([{ skuId: skuVirtual, valor: "1000", pct: "10", abonar: true }]);
    const { dealId: sinComision } = await dealConLineas([{ skuId: skuUnoAUno, valor: "200", pct: "0", abonar: true }]);
    const mapa = await comisionesDeDeals(db, [dealId, sinComision]);
    expect(mapa.get(dealId)).toBe(100);
    expect(mapa.get(sinComision)).toBe(0);
  });

  it("dos SKUs de % distinto suman línea por línea", async () => {
    const { dealId } = await dealConLineas([
      { skuId: skuVirtual, valor: "1000", pct: "10", abonar: true },
      { skuId: skuUnoAUno, valor: "200", pct: "5", abonar: true },
    ]);
    expect((await comisionesDeDeals(db, [dealId])).get(dealId)).toBe(110);
  });

  it("congelar toma el % del SKU solo en líneas con abono y no pisa lo ya congelado", async () => {
    const { dealId, ids } = await dealConLineas([
      { skuId: skuVirtual, valor: "1000", pct: "7", abonar: true },
      { skuId: skuUnoAUno, valor: "200", pct: null, abonar: false },
    ]);
    await db.update(skus).set({ comisionPorcentaje: "12" }).where(eq(skus.id, skuVirtual));
    await db.transaction((tx) => congelarComisionDeLineas(tx as Db, dealId, { actorId: ownerUserId, etiqueta: "test" }));
    const [abonada] = await db.select().from(dealLineas).where(eq(dealLineas.id, ids[0]));
    const [propuesta] = await db.select().from(dealLineas).where(eq(dealLineas.id, ids[1]));
    expect(abonada.comisionPorcentaje).toBe("7.00");
    expect(propuesta.comisionPorcentaje).toBeNull();
  });

  it("la primera línea abonada se congela con el % vigente de su SKU", async () => {
    const { dealId, ids } = await dealConLineas([{ skuId: skuVirtual, valor: "1000", pct: null, abonar: true }]);
    await db.transaction((tx) => congelarComisionDeLineas(tx as Db, dealId, { actorId: ownerUserId, etiqueta: "test" }));
    const [linea] = await db.select().from(dealLineas).where(eq(dealLineas.id, ids[0]));
    expect(linea.comisionPorcentaje).toBe("10.00");
  });
});
