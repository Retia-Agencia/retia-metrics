import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { dealActividades, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { intentosEnEtapaPorDeal } from "@/lib/queries/intentos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closer: string;
let secuencia = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA,
    slug: "p",
    nombre: "P",
    ticketUsd: "1000",
  }).returning();
  programId = programa.id;
  const [usuario] = await db.insert(users).values({
    email: "closer@retia.test",
    rol: "closer",
    closerId: "Closer",
  }).returning();
  closer = usuario.id;
});

afterEach(async () => {
  await cerrar();
});

async function crearDeal(etapa: EtapaDeal, createdAt = new Date("2026-09-01T12:00:00-05:00")) {
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: `persona-${++secuencia}@retia.test`,
  }).returning();
  const [deal] = await db.insert(deals).values({ leadId: lead.id, programId, etapa, createdAt }).returning();
  return deal;
}

async function contar(deal: { id: string; etapa: EtapaDeal; createdAt: Date }) {
  return intentosEnEtapaPorDeal(db, [{ dealId: deal.id, etapa: deal.etapa, createdAt: deal.createdAt }]);
}

describe("intentosEnEtapaPorDeal", () => {
  it("cuenta dos y tres intentos de la etapa actual", async () => {
    const dos = await crearDeal("contactado");
    const tres = await crearDeal("contactado");
    await db.insert(dealActividades).values([
      { dealId: dos.id, tipo: "intento" },
      { dealId: dos.id, tipo: "intento" },
      { dealId: tres.id, tipo: "intento" },
      { dealId: tres.id, tipo: "intento" },
      { dealId: tres.id, tipo: "intento" },
    ]);

    const conteos = await intentosEnEtapaPorDeal(db, [
      { dealId: dos.id, etapa: dos.etapa, createdAt: dos.createdAt },
      { dealId: tres.id, etapa: tres.etapa, createdAt: tres.createdAt },
    ]);
    expect(conteos.get(dos.id)).toBe(2);
    expect(conteos.get(tres.id)).toBe(3);
  });

  it("reinicia el conteo al entrar a otra etapa", async () => {
    const deal = await crearDeal("en_gestion");
    await db.insert(dealActividades).values([
      { dealId: deal.id, tipo: "intento", fecha: new Date("2026-09-02T09:00:00-05:00") },
      { dealId: deal.id, tipo: "intento", fecha: new Date("2026-09-02T10:00:00-05:00") },
      { dealId: deal.id, tipo: "intento", fecha: new Date("2026-09-02T11:00:00-05:00") },
    ]);
    const entrada = new Date("2026-09-03T12:00:00-05:00");
    await db.update(deals).set({ etapa: "contactado" }).where(eq(deals.id, deal.id));
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, de: "en_gestion", a: "contactado", fecha: entrada });

    const conteos = await intentosEnEtapaPorDeal(db, [{ dealId: deal.id, etapa: "contactado", createdAt: deal.createdAt }]);
    expect(conteos.get(deal.id)).toBeUndefined();
  });

  it("un cambio solo de pendiente no reinicia el conteo", async () => {
    const deal = await crearDeal("contactado");
    await db.insert(dealActividades).values([
      { dealId: deal.id, tipo: "intento", fecha: new Date("2026-09-02T09:00:00-05:00") },
      { dealId: deal.id, tipo: "intento", fecha: new Date("2026-09-02T10:00:00-05:00") },
      { dealId: deal.id, tipo: "intento", fecha: new Date("2026-09-02T11:00:00-05:00") },
    ]);
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      de: "contactado",
      a: "contactado",
      pendienteA: "seguimiento",
      fecha: new Date("2026-09-03T12:00:00-05:00"),
    });

    expect((await contar(deal)).get(deal.id)).toBe(3);
  });

  it("ignora contactos, notas y los intentos de otro deal", async () => {
    const deal = await crearDeal("contactado");
    const otro = await crearDeal("contactado");
    await db.insert(dealActividades).values([
      { dealId: deal.id, tipo: "intento" },
      { dealId: deal.id, tipo: "contacto", userId: closer },
      { dealId: deal.id, tipo: "nota" },
      { dealId: otro.id, tipo: "intento" },
      { dealId: otro.id, tipo: "intento" },
      { dealId: otro.id, tipo: "intento" },
    ]);

    expect((await contar(deal)).get(deal.id)).toBe(1);
  });
});
