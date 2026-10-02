import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { registrarActividad } from "@/lib/deals/actividades";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closer: string;
let n = 0;
const actor = () => ({ userId: closer, rol: "closer" as const });
beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning())[0].id;
  closer = (await db.insert(users).values({ email: "closer@retia.co", rol: "closer" }).returning())[0].id;
});
afterEach(async () => cerrar());
async function nuevo(etapa: "potencial" | "registrado" | "en_gestion") {
  const lead = (await db.insert(leads).values({ programId, emailNormalizado: `a${n++}@retia.co` }).returning())[0];
  return (await db.insert(deals).values({ leadId: lead.id, programId, etapa }).returning())[0];
}

describe("registrarActividad", () => {
  it("el primer contacto de un Registrado asigna dueño y escribe E1 y E2 en orden", async () => {
    const d = await nuevo("registrado");
    await registrarActividad(db, actor(), { dealId: d.id, tipo: "contacto", canal: "WhatsApp", nota: "Respondió" });
    const actual = (await db.select().from(deals).where(eq(deals.id, d.id)))[0];
    expect(actual).toMatchObject({ ownerUserId: closer, etapa: "contactado" });
    const h = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, d.id));
    expect(h.map((x) => [x.de, x.a, x.userId])).toEqual([
      ["registrado", "en_gestion", null], ["en_gestion", "contactado", null],
    ]);
    expect(h[1].fecha.getTime()).toBeGreaterThanOrEqual(h[0].fecha.getTime());
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, d.id))).toEqual(expect.arrayContaining([expect.objectContaining({ campo: "ownerUserId", userId: closer })]));
  });

  it("un intento mueve Potencial solo a En gestión", async () => {
    const d = await nuevo("potencial");
    await registrarActividad(db, actor(), { dealId: d.id, tipo: "intento", canal: "Llamada", nota: "No respondió" });
    expect((await db.select().from(deals).where(eq(deals.id, d.id)))[0].etapa).toBe("en_gestion");
  });

  it("una nota asigna dueño si falta, pero no mueve etapa", async () => {
    const d = await nuevo("registrado");
    await registrarActividad(db, actor(), { dealId: d.id, tipo: "nota", nota: "Dato interno" });
    expect((await db.select().from(deals).where(eq(deals.id, d.id)))[0]).toMatchObject({ ownerUserId: closer, etapa: "registrado" });
    expect(await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, d.id))).toEqual([]);
  });

  it("un intento en En gestión se queda en En gestión", async () => {
    const d = await nuevo("en_gestion");
    await db.update(deals).set({ ownerUserId: closer }).where(eq(deals.id, d.id));
    await registrarActividad(db, actor(), { dealId: d.id, tipo: "intento", canal: "Llamada", nota: "Sin respuesta" });
    expect((await db.select().from(deals).where(eq(deals.id, d.id)))[0].etapa).toBe("en_gestion");
  });
});
