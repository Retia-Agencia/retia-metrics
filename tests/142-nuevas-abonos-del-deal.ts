import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { abonos, areas, cohorts, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { anularAbono, registrarAbono } from "@/lib/deals/abonos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("contratos nuevos de abonos del ticket 142", () => {
let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let closer: string;
let areaId: string;
let n = 0;
const actor = () => ({ userId: closer, rol: "closer" as const });
beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const p = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning())[0];
  programId = p.id;
  cohortId = (await db.insert(cohorts).values({ programId, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-30", estado: "activo", fechaInicioVentas: "2026-09-01" }).returning())[0].id;
  closer = (await db.insert(users).values({ email: "closer@retia.co", rol: "closer", closerId: "Closer" }).returning())[0].id;
  areaId = (await db.insert(areas).values({ nombre: "Referidos" }).returning())[0].id;
});
afterEach(async () => cerrar());

async function nuevo(etapa: EtapaDeal) {
  const lead = (await db.insert(leads).values({ programId, emailNormalizado: `p${n++}@retia.co` }).returning())[0];
  return (await db.insert(deals).values({ leadId: lead.id, programId, cohortId, etapa, ownerUserId: closer, valorVendidoUsd: "1000", areaDeclaradaId: areaId }).returning())[0];
}
const datos = (dealId: string, monto: string) => ({ dealId, fecha: "2026-10-02", monto, moneda: "USD" as const, comprobanteUrl: "https://retia.co/comprobante.png" });
const etapa = async (id: string) => (await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, id)))[0].etapa;

describe("el dinero mueve las etapas ganadas", () => {
  it.each(["contactado", "calificado", "atendido", "compromiso_verbal"] as const)("desde %s, pago parcial entra a Ganado Pago Parcial", async (origen) => {
    const d = await nuevo(origen);
    const r = await registrarAbono(db, actor(), datos(d.id, "300"));
    expect(r).toMatchObject({ etapa: "ganado_parcial", saldo: 700, movioElDeal: true });
  });

  it("pago completo entra a Ganado Pagado Completo y un segundo pago termina el parcial", async () => {
    const directo = await nuevo("atendido");
    expect((await registrarAbono(db, actor(), datos(directo.id, "1000"))).etapa).toBe("ganado_completo");
    const parcial = await nuevo("compromiso_verbal");
    expect((await registrarAbono(db, actor(), datos(parcial.id, "300"))).etapa).toBe("ganado_parcial");
    expect((await registrarAbono(db, actor(), datos(parcial.id, "700"))).etapa).toBe("ganado_completo");
  });

  it("anular aplica A2 y luego A1 hacia la etapa previa", async () => {
    const d = await nuevo("compromiso_verbal");
    const r = await registrarAbono(db, actor(), datos(d.id, "1000"));
    const anulado = await anularAbono(db, actor(), { abonoId: r.abonoId, motivo: "Error de digitación" });
    expect(anulado).toMatchObject({ etapa: "compromiso_verbal", movioElDeal: true });
    expect((await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, d.id))).map((h) => h.a)).toEqual([
      "ganado_completo", "ganado_parcial", "compromiso_verbal",
    ]);
  });

  it("un Ganado Pago Parcial conserva caja aunque después se pierda", async () => {
    const d = await nuevo("atendido");
    const r = await registrarAbono(db, actor(), datos(d.id, "300"));
    expect(await etapa(d.id)).toBe("ganado_parcial");
    expect(await db.select().from(abonos).where(eq(abonos.id, r.abonoId))).toHaveLength(1);
  });
});
});
