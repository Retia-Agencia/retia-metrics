import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { cohorts, enlacesPago, plataformasPago, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { resolverCohorte, traducirCompra } from "@/lib/pagos/traducir";
import type { EventoHotmart } from "@/lib/pagos/hotmart";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const APROBADA = Date.parse("2026-11-16T12:00:00-05:00");
const compra = (off: string | null, value = 99, currency = "USD"): EventoHotmart["data"]["purchase"] => ({
  transaction: `tx-${off ?? "sin"}-${currency}`, approved_date: APROBADA,
  full_price: { value, currency_value: currency }, price: { value: 777, currency_value: "USD" },
  ...(off === null ? {} : { offer: { code: off } }), status: "APPROVED",
});

describe("traducir una compra de Hotmart", () => {
  let db: Db; let vaciar: () => Promise<void>; let cerrar: () => Promise<void>;
  let programId: string; let enlaces: Record<string, string>;
  beforeAll(async () => ({ db, vaciar, cerrar } = await crearBaseReutilizable()));
  beforeEach(async () => {
    await vaciar();
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "lider-arte", nombre: "LíderArte", ticketUsd: "149" }).returning();
    programId = programa.id;
    const [plataforma] = await db.select().from(plataformasPago).where(eq(plataformasPago.nombre, "Hotmart"));
    const filas = await db.insert(enlacesPago).values([
      { programId, plataformaId: plataforma.id, nombre: "P6", monto: "99", moneda: "USD", url: "https://pay.hotmart.com/A?off=aaa" },
      { programId, plataformaId: plataforma.id, nombre: "P7", monto: "99", moneda: "USD", url: "https://pay.hotmart.com/B?x=1&off=bbb" },
      { programId, plataformaId: plataforma.id, nombre: "Separar", monto: "49", moneda: "USD", url: "https://pay.hotmart.com/C?off=ccc" },
    ]).returning();
    enlaces = { aaa: filas[0].id, bbb: filas[1].id, ccc: filas[2].id };
    await db.insert(cohorts).values({ programId, codigo: "P7", metaCupos: 20, precioUsd: "149", fechaInicioClases: "2026-12-01", fechaInicioVentas: "2026-11-01", fechaCierreVentas: "2026-11-30", estado: "futuro" });
  });
  afterAll(async () => cerrar());

  it.each([["aaa", 99], ["bbb", 99], ["ccc", 49]] as const)("resuelve off=%s y conserva lo reportado", async (off, pagado) => {
    const r = await traducirCompra(db, programId, compra(off, pagado));
    expect(r).toMatchObject({ enlacePagoId: enlaces[off], monto: pagado, moneda: "USD", estado: "sin_emparejar", motivoRevision: null });
  });
  it("no usa el precio del enlace como monto ni descuento", async () => {
    expect(await traducirCompra(db, programId, compra("ccc", 17))).toMatchObject({ monto: 17, moneda: "USD" });
  });
  it("manda una oferta desconocida a revisión", async () => {
    expect(await traducirCompra(db, programId, compra("zzz"))).toMatchObject({ estado: "en_revision", motivoRevision: "oferta_desconocida" });
  });
  it("una compra sin oferta queda en revisión antes de mirar moneda o cohorte", async () => {
    expect(await traducirCompra(db, programId, compra(null, 99, "BRL"))).toMatchObject({ estado: "en_revision", motivoRevision: "sin_oferta" });
  });
  it("prioriza moneda no soportada después de resolver la oferta", async () => {
    expect(await traducirCompra(db, programId, compra("aaa", 99, "BRL"))).toMatchObject({ estado: "en_revision", motivoRevision: "moneda_no_soportada", enlacePagoId: enlaces.aaa });
  });
  it("distingue cero cohortes vendiendo en la base", async () => {
    await db.delete(cohorts);
    expect(await traducirCompra(db, programId, compra("aaa"))).toMatchObject({ motivoRevision: "sin_cohorte" });
  });
  it("no escoge si la consulta devuelve dos cohortes", () => {
    expect(resolverCohorte([{ id: "a" }, { id: "b" }])).toEqual({ cohortId: null, motivoRevision: "cohorte_ambigua" });
  });
});
