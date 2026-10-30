import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, changeLog, deals, leadContactos, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { reconciliarCalendly } from "@/lib/calendly/reconciliar";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => {
  await vaciar();
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797" }).returning();
  programId = programa.id;
  const [fuente] = await db.insert(sources).values({ programId, nombre: "Formulario" }).returning();
  sourceId = fuente.id;
});
afterAll(async () => cerrar());

async function escenario(args: { correo?: string; uuid?: string; etapa?: "registrado" | "calificado" | "potencial"; llamada?: boolean }) {
  const correo = args.correo ?? "santiago.fr10@hotmail.com";
  const uuid = args.uuid ?? "uuid-santiago";
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: correo }).returning();
  const dealId = await abrirDeal(db, { leadId: lead.id, programId, etapa: args.etapa ?? "calificado", actor: { tipo: "sistema" } });
  await db.insert(submissions).values({
    sourceId,
    leadId: lead.id,
    token: `token-${uuid}-${correo}`,
    respuestas: { agenda: `https://calendly.com/d/abc/entrevista/invitees/${uuid}` },
  });
  if (args.llamada !== false) {
    await db.insert(calls).values({
      programId,
      dealId: null,
      emailLead: "correo-distinto@calendly.co",
      fechaAgenda: new Date("2026-10-08T14:00:00Z"),
      origen: "calendly",
      resultado: "agendada",
      huellaFila: `calendly:${uuid}`,
    });
  }
  return { leadId: lead.id, dealId, uuid };
}

describe("reconciliarCalendly", () => {
  it("I1/I2: reproduce Santiago y Sandra: el UUID cuelga la suelta aunque el correo sea otro y mueve por el motor", async () => {
    const caso = await escenario({});
    const resumen = await reconciliarCalendly(db, programId, { leadIds: [caso.leadId] });
    expect(resumen).toMatchObject({ colgadas: 1 });
    expect((await db.select().from(calls))[0].dealId).toBe(caso.dealId);
    expect((await db.select().from(deals).where(eq(deals.id, caso.dealId)))[0].etapa).toBe("agendado");
    expect(await db.select().from(changeLog).where(and(eq(changeLog.tabla, "calls"), eq(changeLog.campo, "dealId")))).toHaveLength(1);
  });

  it("I3: reintentar no duplica rastro, llamada ni movimiento", async () => {
    await escenario({});
    await reconciliarCalendly(db, programId);
    await reconciliarCalendly(db, programId);
    expect(await db.select().from(calls)).toHaveLength(1);
    expect(await db.select().from(changeLog).where(and(eq(changeLog.tabla, "calls"), eq(changeLog.campo, "dealId")))).toHaveLength(1);
  });

  it("un UUID presente en envíos de dos deals queda suelto y avisa la duda", async () => {
    const primero = await escenario({ uuid: "uuid-dudoso" });
    await escenario({ correo: "otra@correo.co", uuid: "uuid-dudoso", llamada: false });
    const resumen = await reconciliarCalendly(db, programId);
    expect(resumen.dudas).toBeGreaterThan(0);
    expect((await db.select().from(calls).where(eq(calls.huellaFila, "calendly:uuid-dudoso")))[0].dealId).toBeNull();
    expect((await db.select().from(deals).where(eq(deals.id, primero.dealId)))[0].etapa).toBe("calificado");
  });

  it("sin UUID solo usa un correo confirmado; nunca uno unido por teléfono sin confirmar", async () => {
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "principal@correo.co" }).returning();
    const dealId = await abrirDeal(db, { leadId: lead.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
    await db.insert(leadContactos).values({ leadId: lead.id, programId, tipo: "correo", valor: "agenda@correo.co", confirmado: false });
    const [llamada] = await db.insert(calls).values({ programId, emailLead: "agenda@correo.co", origen: "calendly", resultado: "agendada" }).returning();
    await reconciliarCalendly(db, programId);
    expect((await db.select().from(calls).where(eq(calls.id, llamada.id)))[0].dealId).toBeNull();
    await db.update(leadContactos).set({ confirmado: true }).where(eq(leadContactos.leadId, lead.id));
    await reconciliarCalendly(db, programId);
    expect((await db.select().from(calls).where(eq(calls.id, llamada.id)))[0].dealId).toBe(dealId);
  });

  it("la frontera de programa impide que el mismo UUID cruce", async () => {
    const caso = await escenario({ uuid: "uuid-frontera", llamada: false });
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1500" }).returning();
    const [llamada] = await db.insert(calls).values({ programId: otro.id, origen: "calendly", resultado: "agendada", huellaFila: "calendly:uuid-frontera" }).returning();
    await reconciliarCalendly(db, otro.id);
    expect((await db.select().from(calls).where(eq(calls.id, llamada.id)))[0].dealId).toBeNull();
    expect((await db.select().from(deals).where(eq(deals.id, caso.dealId)))[0].etapa).toBe("calificado");
  });

  it("I2: una llamada ya colgada repara un deal bajo sin escribir la etapa a mano", async () => {
    const caso = await escenario({});
    await db.update(calls).set({ dealId: caso.dealId }).where(eq(calls.huellaFila, `calendly:${caso.uuid}`));
    const resumen = await reconciliarCalendly(db, programId);
    expect(resumen.dealsReparados).toBe(1);
    expect((await db.select().from(deals).where(eq(deals.id, caso.dealId)))[0].etapa).toBe("agendado");
  });
});
