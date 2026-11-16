import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { cohorts, comprasPasarela, enlacesPago, integraciones, plataformasPago, programs, sobresCrudos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import fixture from "./fixtures/hotmart-purchase-approved-doc.json";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({ get db() { return holder.db; } }));
const HOTTOK = "hottok-seguro";

describe("POST /api/webhooks/pagos/[fuente]", () => {
  let db: Db; let vaciar: () => Promise<void>; let cerrar: () => Promise<void>; let integracionId: string;
  beforeAll(async () => ({ db, vaciar, cerrar } = await crearBaseReutilizable()));
  beforeEach(async () => {
    await vaciar(); holder.db = db;
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "webhook-pagos", nombre: "Webhook Pagos", ticketUsd: "149" }).returning();
    const [integracion] = await db.insert(integraciones).values({ programId: programa.id, tipo: "hotmart", secretos: { hottok: HOTTOK } }).returning();
    integracionId = integracion.id;
    const [hotmart] = await db.select().from(plataformasPago).where(eq(plataformasPago.nombre, "Hotmart"));
    await db.insert(enlacesPago).values({ programId: programa.id, plataformaId: hotmart.id, nombre: "Oferta", monto: "149", moneda: "USD", url: "https://pay.hotmart.com/X?off=n82b9jqz" });
    await db.insert(cohorts).values({ programId: programa.id, codigo: "P7", metaCupos: 20, precioUsd: "149", fechaInicioClases: "2010-01-01", fechaInicioVentas: "2008-01-01", fechaCierreVentas: "2011-01-01", estado: "futuro" });
  });
  afterAll(async () => { holder.db = null; await cerrar(); });
  const invocar = async (id: string, body: unknown, hottok: string | null = HOTTOK) => {
    const headers = new Headers({ "content-type": "application/json" }); if (hottok !== null) headers.set("x-hotmart-hottok", hottok);
    const { POST } = await import("@/app/api/webhooks/pagos/[fuente]/route");
    return POST(new Request("https://app.retia.co/api/webhooks/pagos/x", { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ fuente: id }) });
  };

  it("hottok bueno responde 200 y guarda sobre y compra", async () => {
    expect((await invocar(integracionId, fixture)).status).toBe(200);
    expect(await db.select().from(sobresCrudos)).toHaveLength(1);
    expect(await db.select().from(comprasPasarela)).toEqual([expect.objectContaining({ estado: "sin_emparejar" })]);
  });
  it.each([["malo"], [null]] as const)("hottok malo o ausente no guarda nada", async (hottok) => {
    expect((await invocar(integracionId, fixture, hottok)).status).toBe(401);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0); expect(await db.select().from(comprasPasarela)).toHaveLength(0);
  });
  it("la misma transacción deja una compra", async () => {
    await invocar(integracionId, fixture); await invocar(integracionId, fixture);
    expect(await db.select().from(sobresCrudos)).toHaveLength(2); expect(await db.select().from(comprasPasarela)).toHaveLength(1);
  });
  it("un reembolso se guarda pero no crea compra", async () => {
    expect((await invocar(integracionId, { ...fixture, event: "PURCHASE_REFUNDED" })).status).toBe(200);
    expect(await db.select().from(sobresCrudos)).toHaveLength(1); expect(await db.select().from(comprasPasarela)).toHaveLength(0);
  });
  it("una integración desconocida responde 404", async () => {
    expect((await invocar(crypto.randomUUID(), fixture)).status).toBe(404);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
  });
});
