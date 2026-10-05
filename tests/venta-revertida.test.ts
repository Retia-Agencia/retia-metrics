import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { areas, cohorts, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { anularAbono, registrarAbono } from "@/lib/deals/abonos";
import { hoyEnBogota } from "@/lib/format";
import { embudoPorEtapas } from "@/lib/queries/embudo-etapas";
import { leerMetasDelMes } from "@/lib/queries/metas";
import { primerosMovimientosDeVenta, vendidosEn, ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 200: una venta que se revierte al anular su abono (A1) no cuenta en ninguna métrica,
 * y si el deal vuelve a pagar, el día de la venta es el del pago nuevo. Abonado → Cierre
 * Perdido sigue siendo una venta (ADR 0038), y una cortesía nunca lo es (ADR 0071).
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let areaId: string;
let closer: string;
let leadN = 0;

const SIEMPRE = { desde: "2000-01-01", hasta: "2100-12-31" };
const comoCloser = () => ({ userId: closer, rol: "closer" as const });
const abono = (dealId: string, monto: string) => ({
  dealId,
  fecha: hoyEnBogota(),
  monto,
  comprobanteUrl: "https://drive.google.com/comprobante",
});

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2100-01-01",
      fechaInicioVentas: "2000-01-03",
      fechaCierreVentas: "2099-12-31",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  areaId = area.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
});

afterEach(async () => {
  await cerrar();
});

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: `lead${++leadN}@correo.co`, nombre: `Lead ${leadN}` })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId, cohortId, etapa, ownerUserId: closer, valorVendidoUsd: "1000", areaDeclaradaId: areaId, ...extra })
    .returning();
  return d.id;
}

async function vendidos(): Promise<string[]> {
  return (await vendidosEn(db, SIEMPRE)).map((f) => f.dealId);
}

async function pasoVendido(): Promise<string[]> {
  const embudo = await embudoPorEtapas(db, { programId, rango: SIEMPRE });
  return embudo.conversion.todas.pasos.find((p) => p.paso === "vendido")!.dealIds;
}

/** Corre hacia atrás la fecha de los movimientos de venta de un deal, para distinguir el día. */
async function fecharVentasEn(dealId: string, fecha: string) {
  await db
    .update(dealEtapaHistorial)
    .set({ fecha: new Date(`${fecha}T15:00:00-05:00`) })
    .where(and(eq(dealEtapaHistorial.dealId, dealId), inArray(dealEtapaHistorial.a, ["ganado_parcial", "ganado_completo"])));
}

describe("ticket 200: la venta revertida no cuenta", () => {
  it("anular el único abono saca al deal de toda lectura de ventas", async () => {
    const dealId = await nuevoDeal("atendido");
    const r = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    expect(await vendidos()).toEqual([dealId]);
    expect(await pasoVendido()).toEqual([dealId]);

    await anularAbono(db, comoCloser(), { abonoId: r.abonoId, motivo: "Duplicado" });

    expect(await vendidos()).toEqual([]);
    expect(await ventasConDiaEn(db, SIEMPRE)).toEqual([]);
    expect(await db.select({ id: dealEtapaHistorial.id }).from(dealEtapaHistorial)
      .where(inArray(dealEtapaHistorial.id, primerosMovimientosDeVenta(db)))).toEqual([]);
    expect(await pasoVendido()).toEqual([]);
    const metas = await leerMetasDelMes(programId, hoyEnBogota().slice(0, 7), hoyEnBogota(), db);
    expect(metas.vendidos).toBe(0);
  });

  it("si vuelve a pagar, cuenta con el día del pago nuevo y no con el del anulado", async () => {
    const dealId = await nuevoDeal("atendido");
    const r = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    await fecharVentasEn(dealId, "2026-08-10");
    await anularAbono(db, comoCloser(), { abonoId: r.abonoId, motivo: "Duplicado" });
    await registrarAbono(db, comoCloser(), abono(dealId, "300"));

    expect(await ventasConDiaEn(db, SIEMPRE)).toEqual([{ dealId, dia: hoyEnBogota() }]);
    expect(await vendidosEn(db, { desde: "2026-08-01", hasta: "2026-08-31" })).toEqual([]);
    const [primero] = await db.select({ a: dealEtapaHistorial.a, fecha: dealEtapaHistorial.fecha }).from(dealEtapaHistorial)
      .where(inArray(dealEtapaHistorial.id, primerosMovimientosDeVenta(db)));
    expect(primero.fecha.getTime()).toBeGreaterThan(new Date("2026-08-11").getTime());
  });

  it("Abonado que termina en Cierre Perdido sigue siendo una venta (ADR 0038)", async () => {
    const dealId = await nuevoDeal("atendido");
    await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    await db.insert(dealEtapaHistorial).values({ dealId, de: "ganado_parcial", a: "cierre_perdido", userId: closer });
    await db.update(deals).set({ etapa: "cierre_perdido" }).where(eq(deals.id, dealId));

    expect(await vendidos()).toEqual([dealId]);
    expect(await pasoVendido()).toEqual([dealId]);
  });

  it("Completo que vuelve a Abonado (A2) sigue vendido", async () => {
    const dealId = await nuevoDeal("atendido");
    await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    const segundo = await registrarAbono(db, comoCloser(), abono(dealId, "700"));
    expect(segundo.etapa).toBe("ganado_completo");
    await anularAbono(db, comoCloser(), { abonoId: segundo.abonoId, motivo: "Duplicado" });

    expect(await vendidos()).toEqual([dealId]);
    expect(await pasoVendido()).toEqual([dealId]);
  });

  it("en un empate de instante entre la venta y su reversa, el SQL y el embudo dicen lo mismo", async () => {
    const dealId = await nuevoDeal("atendido");
    const mismo = new Date("2026-09-02T15:00:00-05:00");
    await db.insert(dealEtapaHistorial).values([
      { dealId, de: null, a: "atendido", fecha: new Date("2026-09-01T15:00:00-05:00") },
      { dealId, de: "atendido", a: "ganado_parcial", fecha: mismo },
      { dealId, de: "ganado_parcial", a: "atendido", fecha: mismo },
    ]);

    expect(await vendidos()).toEqual([dealId]);
    expect(await pasoVendido()).toEqual(await vendidos());
  });

  it("una cortesía no llega al paso vendido del embudo por etapas (igual que vendidosEn)", async () => {
    const dealId = await nuevoDeal("ganado_completo", { cortesia: true });
    await db.insert(dealEtapaHistorial).values([
      { dealId, de: null, a: "atendido", fecha: new Date("2026-09-01T15:00:00-05:00") },
      { dealId, de: "atendido", a: "ganado_completo", userId: closer, fecha: new Date("2026-09-02T15:00:00-05:00") },
    ]);

    expect(await vendidos()).toEqual([]);
    expect(await pasoVendido()).toEqual([]);
  });
});
