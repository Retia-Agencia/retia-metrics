import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, cohorts, deals, eventosMeta, integraciones, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let vaciar: () => Promise<void>;
let cerrar: () => Promise<void>;
let secuencia = 0;

beforeAll(async () => ({ db, vaciar, cerrar } = await crearBaseReutilizable()));
beforeEach(async () => { await vaciar(); });
afterAll(async () => cerrar());

async function nuevo(input: { encendido: boolean; cortesia?: boolean }) {
  secuencia += 1;
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: `capi-${secuencia}`, nombre: `CAPI ${secuencia}`, ticketUsd: "1000",
  }).returning();
  await db.insert(integraciones).values({
    programId: programa.id, tipo: "meta_capi", secretos: { token: `token-${secuencia}` },
    config: { datasetId: `${secuencia}`, encendido: input.encendido },
  });
  const [dueno] = await db.insert(users).values({ email: `dueno-${secuencia}@retia.co`, rol: "closer" }).returning();
  const [cohorte] = await db.insert(cohorts).values({
    programId: programa.id, codigo: `C${secuencia}`, estado: "activo", metaCupos: 10,
    precioUsd: "1000", fechaInicioVentas: "2026-10-01", fechaInicioClases: "2026-12-01",
    fechaCierreVentas: "2026-11-30",
  }).returning();
  const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: `p${secuencia}@retia.co` }).returning();
  const [deal] = await db.insert(deals).values({
    programId: programa.id, leadId: lead.id, cortesia: input.cortesia ?? false,
    valorVendidoUsd: "1000", etapa: "contactado", ownerUserId: dueno.id,
    cohortId: cohorte.id, fechaLimitePago: "2026-11-20",
  }).returning();
  return deal;
}

async function abonarYAvanzar(deal: typeof deals.$inferSelect, monto: string, a: "ganado_parcial" | "ganado_completo") {
  await db.insert(abonos).values({ dealId: deal.id, programId: deal.programId, fecha: "2026-10-20", monto });
  await moverEtapa(db, { dealId: deal.id, a, actor: { tipo: "sistema" } });
}

describe("disparo de Purchase", () => {
  it("Abonado y luego Completo deja una sola fila; Completo directo también", async () => {
    const parcial = await nuevo({ encendido: true });
    await abonarYAvanzar(parcial, "300", "ganado_parcial");
    await db.insert(abonos).values({ dealId: parcial.id, programId: parcial.programId, fecha: "2026-10-20", monto: "700" });
    await moverEtapa(db, { dealId: parcial.id, a: "ganado_completo", actor: { tipo: "sistema" } });
    expect(await db.select().from(eventosMeta)).toHaveLength(1);

    const completo = await nuevo({ encendido: true });
    await abonarYAvanzar(completo, "1000", "ganado_completo");
    const filas = await db.select().from(eventosMeta);
    expect(filas).toHaveLength(2);
    expect(filas.map((fila) => fila.eventId)).toEqual(expect.arrayContaining([parcial.id, completo.id]));
  });

  it.each([
    [{ encendido: true, cortesia: true }, "cortesia"],
    [{ encendido: false }, "programa_apagado"],
  ] as const)("registra la omisión %s", async (input, razon) => {
    const deal = await nuevo(input);
    await abonarYAvanzar(deal, "1000", "ganado_completo");
    expect((await db.select().from(eventosMeta))[0]).toMatchObject({ estado: "omitido", razon });
  });
});
