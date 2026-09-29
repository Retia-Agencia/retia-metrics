import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
  changeLog,
  dealActividades,
  deals,
  leadContactos,
  leads,
  miembrosPrograma,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { esViolacionCheck, esViolacionUnica } from "@/lib/db/errores";
import { abrirDeal, moverEtapa } from "@/lib/deals/mover-etapa";
import { asignarLlamadaSuelta, registrarLlamadaDeCalendly, type CitaDeCalendly } from "@/lib/calendly/colgar-llamada";
import { aplicarReglaDeDeal } from "@/lib/ingesta/regla-de-deals";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * El escritor de las llamadas de Calendly (ticket 096, ADR 0049), contra PGlite: lee la
 * base, le pregunta al emparejador y escribe. Las reglas finas del emparejador tienen su
 * propio test puro (`calendly-emparejador.test.ts`); aqui se prueba que lo que decide
 * llega a la base, con rastro y por el motor.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let leadId: string;
let dealId: string;
let maru: string;
let andrea: string;
let gerente: string;

const HOST_MARU = "maru.tactical@calendly.co";

let n = 0;
function cita(parcial: Partial<CitaDeCalendly> = {}): CitaDeCalendly {
  n += 1;
  return {
    uuidInvitado: `uuid-${n}`,
    inicio: new Date("2026-10-02T15:00:00.000Z"),
    correoInvitado: "Ana@Correo.co ",
    correoHost: null,
    ...parcial,
  };
}

async function deal() {
  const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
  return d;
}

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

  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" })
    .returning();
  leadId = l.id;
  dealId = await abrirDeal(db, { leadId, programId, etapa: "pendiente_setteo", actor: { tipo: "sistema" } });

  const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  maru = m.id;
  const [a] = await db.insert(users).values({ email: "andrea@retiagrowth.com", rol: "closer" }).returning();
  andrea = a.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  await db.insert(miembrosPrograma).values([
    { userId: maru, programId, calendlyEmail: HOST_MARU },
    { userId: andrea, programId, calendlyEmail: "andrea@calendly.co" },
  ]);
});

afterEach(async () => {
  await cerrar();
});

describe("registrarLlamadaDeCalendly: colgada", () => {
  it("el correo del lead cuelga la llamada de su deal, que pasa a Agendado, con rastro", async () => {
    const r = await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: "nadie@calendly.co" }));
    expect(r).toMatchObject({ tipo: "colgada", dealId, movioAAgendado: true, duenoAnterior: null });

    expect((await deal()).etapa).toBe("agendado");
    const [llamada] = await db.select().from(calls).where(eq(calls.dealId, dealId));
    expect(llamada).toMatchObject({
      origen: "calendly",
      resultado: "agendada",
      emailLead: "ana@correo.co",
      calendlyHostEmail: "nadie@calendly.co",
      closerUserId: null,
    });
    const rastro = await db.select().from(changeLog).where(eq(changeLog.registroId, llamada.id));
    expect(rastro.map((c) => c.campo)).toContain("dealId");
  });

  it("la host registrada se queda el deal sin dueño, sin nota", async () => {
    const r = await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: "MARU.tactical@calendly.co" }));
    expect(r).toMatchObject({ tipo: "colgada", duenoAnterior: null });
    expect((await deal()).ownerUserId).toBe(maru);
    expect(await db.select().from(dealActividades)).toHaveLength(0);
  });

  it("si el deal era de otra closer, pasa a la host y queda la nota que avisa", async () => {
    await db.update(deals).set({ ownerUserId: andrea }).where(eq(deals.id, dealId));
    const r = await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: HOST_MARU }));
    expect(r).toMatchObject({ tipo: "colgada", duenoAnterior: andrea });
    expect((await deal()).ownerUserId).toBe(maru);
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({ tipo: "nota", userId: null });
  });

  it("una host que no esta registrada no toca al dueño", async () => {
    await db.update(deals).set({ ownerUserId: andrea }).where(eq(deals.id, dealId));
    await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: "externa@calendly.co" }));
    expect((await deal()).ownerUserId).toBe(andrea);
  });

  it("una host con membresia INACTIVA no cuenta como registrada", async () => {
    await db.update(miembrosPrograma).set({ activo: false }).where(eq(miembrosPrograma.userId, maru));
    await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: HOST_MARU }));
    expect((await deal()).ownerUserId).toBeNull();
  });

  it("sobre un deal Atendido es una segunda llamada y la etapa no retrocede", async () => {
    await db.insert(calls).values({ dealId, programId, fechaAgenda: new Date("2026-09-30T15:00:00Z"), origen: "crm" });
    await moverEtapa(db, { dealId, a: "agendado", actor: { tipo: "sistema" } });
    await db.update(calls).set({ linkGrain: "https://grain.com/x", resultado: "show" }).where(eq(calls.dealId, dealId));
    await moverEtapa(db, { dealId, a: "atendido", actor: { tipo: "sistema" } });

    const r = await registrarLlamadaDeCalendly(db, programId, cita());
    expect(r).toMatchObject({ tipo: "colgada", movioAAgendado: false });
    expect((await deal()).etapa).toBe("atendido");
    expect(await db.select().from(calls).where(eq(calls.dealId, dealId))).toHaveLength(2);
  });

  it("la misma cita dos veces no duplica la llamada", async () => {
    const c = cita();
    const primera = await registrarLlamadaDeCalendly(db, programId, c);
    const segunda = await registrarLlamadaDeCalendly(db, programId, c);
    expect(segunda).toEqual({ tipo: "repetida", callId: (primera as { callId: string }).callId });
    expect(await db.select().from(calls)).toHaveLength(1);
  });
});

describe("registrarLlamadaDeCalendly: suelta", () => {
  it("un correo que ningun lead del programa tiene deja la llamada suelta", async () => {
    const r = await registrarLlamadaDeCalendly(db, programId, cita({ correoInvitado: "otra@correo.co" }));
    expect(r).toMatchObject({ tipo: "suelta", motivo: "sin_lead" });
    const [llamada] = await db.select().from(calls);
    expect(llamada).toMatchObject({ dealId: null, programId, origen: "calendly" });
    expect((await deal()).etapa).toBe("pendiente_setteo");
  });

  it("el programa es frontera: el mismo correo en OTRO programa no cuelga nada aqui", async () => {
    const r = await registrarLlamadaDeCalendly(db, otroProgramId, cita());
    expect(r).toMatchObject({ tipo: "suelta", motivo: "sin_lead" });
    expect((await deal()).etapa).toBe("pendiente_setteo");
  });

  it("un correo que entro unido por telefono y nadie confirmo no decide", async () => {
    const [l] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: "beto@correo.co", nombre: "Beto" })
      .returning();
    await abrirDeal(db, { leadId: l.id, programId, etapa: "pendiente_setteo", actor: { tipo: "sistema" } });
    await db
      .insert(leadContactos)
      .values({ leadId: l.id, programId, tipo: "correo", valor: "beto.alt@correo.co", confirmado: false });

    const r = await registrarLlamadaDeCalendly(db, programId, cita({ correoInvitado: "beto.alt@correo.co" }));
    expect(r).toMatchObject({ tipo: "suelta", motivo: "sin_lead" });

    await db.update(leadContactos).set({ confirmado: true }).where(eq(leadContactos.leadId, l.id));
    const r2 = await registrarLlamadaDeCalendly(db, programId, cita({ correoInvitado: "beto.alt@correo.co" }));
    expect(r2).toMatchObject({ tipo: "colgada" });
  });

  it("un lead sin deal abierto deja la llamada suelta", async () => {
    await db.update(deals).set({ anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "error" });
    const r = await registrarLlamadaDeCalendly(db, programId, cita());
    expect(r).toMatchObject({ tipo: "suelta", motivo: "sin_deal_abierto" });
  });
});

describe("asignarLlamadaSuelta", () => {
  async function suelta(): Promise<string> {
    const r = await registrarLlamadaDeCalendly(
      db,
      programId,
      cita({ correoInvitado: "agenda-distinta@correo.co", correoHost: HOST_MARU }),
    );
    expect(r.tipo).toBe("suelta");
    return r.callId;
  }

  it("un closer del programa la cuelga del deal: Agendado, dueño la host y rastro con su nombre", async () => {
    const callId = await suelta();
    const r = await asignarLlamadaSuelta(db, { userId: andrea, rol: "closer" }, { callId, dealId });
    expect(r).toMatchObject({ movioAAgendado: true });

    const d = await deal();
    expect(d.etapa).toBe("agendado");
    expect(d.ownerUserId).toBe(maru);
    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, callId), eq(changeLog.campo, "dealId")));
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({ userId: andrea, valorAnterior: null, valorNuevo: dealId });
  });

  it("una llamada ya asignada no se reasigna: 404", async () => {
    const callId = await suelta();
    await asignarLlamadaSuelta(db, { userId: andrea, rol: "closer" }, { callId, dealId });
    await expect(asignarLlamadaSuelta(db, { userId: andrea, rol: "closer" }, { callId, dealId })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("un gerente administra pero no registra: 403, y la base no se mueve", async () => {
    const callId = await suelta();
    await expect(asignarLlamadaSuelta(db, { userId: gerente, rol: "gerente" }, { callId, dealId })).rejects.toMatchObject({
      status: 403,
    });
    const [llamada] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(llamada.dealId).toBeNull();
  });

  it("un closer sin membresia en el programa recibe 404", async () => {
    const callId = await suelta();
    const [ajena] = await db.insert(users).values({ email: "ajena@retiagrowth.com", rol: "closer" }).returning();
    await expect(asignarLlamadaSuelta(db, { userId: ajena.id, rol: "closer" }, { callId, dealId })).rejects.toBeInstanceOf(
      ErrorDeApp,
    );
    const [llamada] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(llamada.dealId).toBeNull();
  });

  it("un deal de otro programa no la recibe (ADR 0043)", async () => {
    const callId = await suelta();
    const [l] = await db
      .insert(leads)
      .values({ programId: otroProgramId, emailNormalizado: "ana@correo.co", nombre: "Ana" })
      .returning();
    const dealAjeno = await abrirDeal(db, {
      leadId: l.id,
      programId: otroProgramId,
      etapa: "pendiente_setteo",
      actor: { tipo: "sistema" },
    });
    await expect(
      asignarLlamadaSuelta(db, { userId: andrea, rol: "closer" }, { callId, dealId: dealAjeno }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("las garantias de la base (migracion 0038)", () => {
  it("una llamada del CRM no queda sin deal; la suelta de Calendly y la de la hoja si", async () => {
    const error = await db
      .insert(calls)
      .values({ programId, origen: "crm" })
      .then(() => null, (e: unknown) => e);
    expect(esViolacionCheck(error)).toBe(true);
    await db.insert(calls).values({ programId, origen: "calendly", huellaFila: "calendly:x" });
    await db.insert(calls).values({ programId, origen: "sheets" });
  });

  it("dos closers no reclaman la misma cuenta de Calendly en un programa", async () => {
    const [otra] = await db.insert(users).values({ email: "otra@retiagrowth.com", rol: "closer" }).returning();
    const error = await db
      .insert(miembrosPrograma)
      .values({ userId: otra.id, programId, calendlyEmail: "MARU.TACTICAL@calendly.co" })
      .then(() => null, (e: unknown) => e);
    expect(esViolacionUnica(error)).toBe(true);
    // En OTRO programa la misma cuenta si cabe: la frontera es el programa.
    await db.insert(miembrosPrograma).values({ userId: otra.id, programId: otroProgramId, calendlyEmail: HOST_MARU });
  });
});

describe("el 052 con la host de la cita", () => {
  it("un envio Con Calendly abre el deal con la closer host como dueña y guarda el host", async () => {
    const [l] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: "caro@correo.co", nombre: "Caro", calificacion: "con_calendly" })
      .returning();
    const r = await aplicarReglaDeDeal(
      db,
      { id: l.id, programId, emailNormalizado: "caro@correo.co", calificacion: "con_calendly" },
      { estado: "vigente", inicio: new Date("2026-10-02T15:00:00Z"), uuidInvitado: "uuid-caro", correoHost: HOST_MARU },
    );
    const [d] = await db.select().from(deals).where(eq(deals.id, r.dealAbiertoId!));
    expect(d).toMatchObject({ etapa: "agendado", ownerUserId: maru });
    const [llamada] = await db.select().from(calls).where(eq(calls.dealId, d.id));
    expect(llamada.calendlyHostEmail).toBe(HOST_MARU);
  });

  it("sin host registrada el deal nace sin dueño, como antes", async () => {
    const [l] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: "dani@correo.co", nombre: "Dani", calificacion: "con_calendly" })
      .returning();
    const r = await aplicarReglaDeDeal(
      db,
      { id: l.id, programId, emailNormalizado: "dani@correo.co", calificacion: "con_calendly" },
      { estado: "vigente", inicio: new Date("2026-10-02T15:00:00Z"), uuidInvitado: "uuid-dani", correoHost: "x@y.co" },
    );
    const [d] = await db.select().from(deals).where(eq(deals.id, r.dealAbiertoId!));
    expect(d.ownerUserId).toBeNull();
  });
});
