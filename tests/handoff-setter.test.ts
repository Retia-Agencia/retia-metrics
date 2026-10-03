import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, changeLog, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { linkEnviadoSinCita, marcarLinkEnviado } from "@/lib/deals/handoff";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let dealId: string;
let ownerId: string;
let otroId: string;
let programId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "handoff", nombre: "Handoff", ticketUsd: "1000" }).returning();
  programId = programa.id;
  const [owner] = await db.insert(users).values({ email: "setter@retia.co", rol: "closer" }).returning();
  const [otro] = await db.insert(users).values({ email: "otro@retia.co", rol: "closer" }).returning();
  ownerId = owner.id;
  otroId = otro.id;
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "lead@correo.co" }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId: ownerId, etapa: "calificado" }).returning();
  dealId = deal.id;
});

afterEach(async () => cerrar());

describe("marcarLinkEnviado", () => {
  it("escribe handoff_en y su change_log con el actor", async () => {
    await marcarLinkEnviado(db, { userId: ownerId, rol: "closer" }, dealId);
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal.handoffEn).toBeInstanceOf(Date);
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.registroId, dealId), eq(changeLog.campo, "handoffEn")));
    expect(rastro).toHaveLength(1);
    expect(rastro[0].userId).toBe(ownerId);
  });

  it("rechaza a un closer que no es dueño y deja el deal quieto", async () => {
    await expect(marcarLinkEnviado(db, { userId: otroId, rol: "closer" }, dealId)).rejects.toMatchObject({ status: 403 });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].handoffEn).toBeNull();
  });

  it("rechaza cuando ya hay una llamada vigente agendada", async () => {
    await db.insert(calls).values({ programId, dealId, origen: "crm", resultado: "agendada" });
    await expect(marcarLinkEnviado(db, { userId: ownerId, rol: "closer" }, dealId)).rejects.toMatchObject({ status: 409 });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].handoffEn).toBeNull();
  });
});

describe("linkEnviadoSinCita", () => {
  const viernes = new Date("2026-10-02T15:00:00.000Z");

  it.each(["2026-10-02", "2026-10-03", "2026-10-04"])("viernes todavía no alerta el %s", (hoy) => {
    expect(linkEnviadoSinCita({ handoffEn: viernes, tieneCitaVigente: false, hoy })).toBe(false);
  });

  it("alerta el lunes y se limpia cuando existe una cita vigente", () => {
    expect(linkEnviadoSinCita({ handoffEn: viernes, tieneCitaVigente: false, hoy: "2026-10-05" })).toBe(true);
    expect(linkEnviadoSinCita({ handoffEn: viernes, tieneCitaVigente: true, hoy: "2026-10-05" })).toBe(false);
  });
});
