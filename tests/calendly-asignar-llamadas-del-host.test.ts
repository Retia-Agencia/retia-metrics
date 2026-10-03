import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { calls, changeLog, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { asignarLlamadasDelHost } from "@/lib/calendly/rellenar-closer";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Al vincular una cuenta de Calendly a una membresia (ADR 0049, ADR 0074), las citas que esa
 * host ya hospedaba se le atribuyen y los deals abiertos con cita a futuro pasan a ella.
 * Aqui, contra PGlite, se comprueba que ESE escritor lo hace: atribuye con rastro, respeta la
 * frontera del programa, no toca lo anulado, y mueve el dueño del deal dejando setter al anterior.
 */

const HOST = "maru.tactical@calendly.co";
const FUTURO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PASADO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let maru: string;
let andrea: string;
let gerente: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical", ticketUsd: "1500" })
    .returning();
  programId = p.id;
  const [o] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "797" })
    .returning();
  otroProgramId = o.id;

  const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  maru = m.id;
  const [a] = await db.insert(users).values({ email: "andrea@retiagrowth.com", rol: "closer" }).returning();
  andrea = a.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  // La membresia existe sin cuenta: la vinculacion es el acto que estamos probando.
  await db.insert(miembrosPrograma).values({ userId: maru, programId });
});

afterEach(async () => {
  await cerrar();
});

async function nuevoLeadConDeal(email: string, etapa: "registrado" | "ganado_completo" = "registrado") {
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: email, nombre: email }).returning();
  const dealId = await abrirDeal(db, { leadId: l.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
  if (etapa !== "registrado") {
    await db.update(deals).set({ etapa }).where(eq(deals.id, dealId));
  }
  return dealId;
}

describe("asignarLlamadasDelHost", () => {
  it("atribuye la llamada que casa por host y deja rastro de closerUserId", async () => {
    const dealId = await nuevoLeadConDeal("ana@correo.co");
    const [c] = await db
      .insert(calls)
      .values({
        programId,
        dealId,
        origen: "calendly",
        calendlyHostEmail: "MARU.tactical@calendly.co",
        emailLead: "ana@correo.co",
        fechaAgenda: PASADO,
        closerUserId: null,
      })
      .returning();

    await db.transaction(async (tx) => {
      await asignarLlamadasDelHost(tx, { programId, correo: HOST, userId: maru, actorId: gerente });
    });

    const [despues] = await db.select().from(calls).where(eq(calls.id, c.id));
    expect(despues.closerUserId).toBe(maru);
    const rastro = await db.select().from(changeLog).where(eq(changeLog.registroId, c.id));
    expect(rastro.map((r) => r.campo)).toContain("closerUserId");
    expect(rastro.find((r) => r.campo === "closerUserId")?.userId).toBe(gerente);
    // Una cita pasada no mueve el deal.
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].ownerUserId).toBeNull();
  });

  it("no toca una llamada de OTRO programa con el mismo correo de host", async () => {
    const [l] = await db
      .insert(leads)
      .values({ programId: otroProgramId, emailNormalizado: "beto@correo.co", nombre: "Beto" })
      .returning();
    const dealOtro = await abrirDeal(db, {
      leadId: l.id,
      programId: otroProgramId,
      etapa: "registrado",
      actor: { tipo: "sistema" },
    });
    const [c] = await db
      .insert(calls)
      .values({
        programId: otroProgramId,
        dealId: dealOtro,
        origen: "calendly",
        calendlyHostEmail: HOST,
        emailLead: "beto@correo.co",
        fechaAgenda: PASADO,
        closerUserId: null,
      })
      .returning();

    await db.transaction(async (tx) => {
      await asignarLlamadasDelHost(tx, { programId, correo: HOST, userId: maru, actorId: gerente });
    });

    expect((await db.select().from(calls).where(eq(calls.id, c.id)))[0].closerUserId).toBeNull();
  });

  it("no toca una llamada anulada", async () => {
    const dealId = await nuevoLeadConDeal("ana@correo.co");
    const [c] = await db
      .insert(calls)
      .values({
        programId,
        dealId,
        origen: "calendly",
        calendlyHostEmail: HOST,
        emailLead: "ana@correo.co",
        fechaAgenda: PASADO,
        closerUserId: null,
        anuladoEn: new Date(),
        anuladoPor: gerente,
        motivoAnulacion: "error de dedo",
      })
      .returning();

    await db.transaction(async (tx) => {
      await asignarLlamadasDelHost(tx, { programId, correo: HOST, userId: maru, actorId: gerente });
    });

    expect((await db.select().from(calls).where(eq(calls.id, c.id)))[0].closerUserId).toBeNull();
  });

  it("una cita a futuro sobre un deal abierto pasa el deal a la host y deja al dueño anterior como setter", async () => {
    const dealId = await nuevoLeadConDeal("ana@correo.co");
    await db.update(deals).set({ ownerUserId: andrea }).where(eq(deals.id, dealId));
    const [c] = await db
      .insert(calls)
      .values({
        programId,
        dealId,
        origen: "calendly",
        calendlyHostEmail: HOST,
        emailLead: "ana@correo.co",
        fechaAgenda: FUTURO,
        closerUserId: null,
      })
      .returning();

    await db.transaction(async (tx) => {
      await asignarLlamadasDelHost(tx, { programId, correo: HOST, userId: maru, actorId: gerente });
    });

    expect((await db.select().from(calls).where(eq(calls.id, c.id)))[0].closerUserId).toBe(maru);
    const [despues] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(despues.ownerUserId).toBe(maru);
    expect(despues.setterUserId).toBe(andrea);
  });

  it("una cita a futuro sobre un deal CERRADO no mueve el dueño", async () => {
    const dealId = await nuevoLeadConDeal("ana@correo.co", "ganado_completo");
    await db.update(deals).set({ ownerUserId: andrea }).where(eq(deals.id, dealId));
    const [c] = await db
      .insert(calls)
      .values({
        programId,
        dealId,
        origen: "calendly",
        calendlyHostEmail: HOST,
        emailLead: "ana@correo.co",
        fechaAgenda: FUTURO,
        closerUserId: null,
      })
      .returning();

    await db.transaction(async (tx) => {
      await asignarLlamadasDelHost(tx, { programId, correo: HOST, userId: maru, actorId: gerente });
    });

    // El closer igual se atribuye; el dueño del deal cerrado no se toca.
    expect((await db.select().from(calls).where(eq(calls.id, c.id)))[0].closerUserId).toBe(maru);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].ownerUserId).toBe(andrea);
  });
});
