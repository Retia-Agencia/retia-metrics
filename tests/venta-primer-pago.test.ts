import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, cohorts, dealEtapaHistorial, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { idsDeVentasEn, ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";

/**
 * ADR 0136 (D-1 de la auditoría del 18-nov): la venta cuenta por el día de su PRIMER PAGO (abono vigente
 * más antiguo, concepto ticket), no por el día en que la etapa la registró. Sin abono cae al día de la etapa.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let n = 0;

const OCTUBRE = { desde: "2026-10-01", hasta: "2026-10-31" };
const NOVIEMBRE = { desde: "2026-11-01", hasta: "2026-11-30" };

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});
beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p456", nombre: "P456", ticketUsd: "1000" }).returning();
  programId = p.id;
  await db.insert(cohorts).values({
    programId, codigo: "C1", metaCupos: 20, precioUsd: "1000",
    fechaInicioClases: "2026-12-01", fechaInicioVentas: "2026-10-01", fechaCierreVentas: "2026-12-04", estado: "activo",
  });
});

async function dealVendido(diaEtapa: string, pagos: Array<{ fecha: string; concepto?: "ticket" | "adicional"; anulado?: boolean }>) {
  const [lead] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `l${++n}@t456.test` }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, etapa: "ganado_parcial" as EtapaDeal, ownerUserId: await duenoDePrueba(db, programId) }).returning();
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial" as EtapaDeal, fecha: new Date(`${diaEtapa}T11:00:00-05:00`) });
  for (const p of pagos) {
    await db.insert(abonos).values({
      dealId: deal.id, programId, fecha: p.fecha, monto: "500", moneda: "USD", comprobanteUrl: "https://example.test/c",
      concepto: p.concepto ?? "ticket", ...(p.anulado ? { anuladoEn: new Date(), anuladoPor: await duenoDePrueba(db, programId), motivoAnulacion: "prueba" } : {}),
    });
  }
  return deal.id;
}

describe("la venta se fecha por el primer pago (ADR 0136)", () => {
  it("un pago anterior al cambio de etapa deja la venta en el mes del pago", async () => {
    // Pagó el 28-oct; el lote se capturó (etapa) el 11-nov.
    const id = await dealVendido("2026-11-11", [{ fecha: "2026-10-28" }]);
    expect(await ventasConDiaEn(db, OCTUBRE)).toEqual([{ dealId: id, dia: "2026-10-28" }]);
    expect(await ventasConDiaEn(db, NOVIEMBRE)).toEqual([]);
    expect((await idsDeVentasEn(db, OCTUBRE)).map((f) => f.dealId)).toEqual([id]);
    expect(await idsDeVentasEn(db, NOVIEMBRE)).toEqual([]);
  });

  it("un deal sin abono cae al día de la etapa", async () => {
    const id = await dealVendido("2026-11-11", []);
    expect(await ventasConDiaEn(db, NOVIEMBRE)).toEqual([{ dealId: id, dia: "2026-11-11" }]);
    expect(await ventasConDiaEn(db, OCTUBRE)).toEqual([]);
  });

  it("es UNA venta aunque haya varios abonos: cuenta el más antiguo vigente", async () => {
    const id = await dealVendido("2026-11-11", [{ fecha: "2026-11-05" }, { fecha: "2026-10-20" }]);
    expect(await ventasConDiaEn(db, { desde: "2000-01-01", hasta: "2100-12-31" })).toEqual([{ dealId: id, dia: "2026-10-20" }]);
  });

  it("un abono anulado y un abono adicional no fechan la venta", async () => {
    const id = await dealVendido("2026-11-11", [
      { fecha: "2026-09-01", anulado: true },
      { fecha: "2026-09-02", concepto: "adicional" },
      { fecha: "2026-11-03" },
    ]);
    expect(await ventasConDiaEn(db, { desde: "2000-01-01", hasta: "2100-12-31" })).toEqual([{ dealId: id, dia: "2026-11-03" }]);
  });
});
