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
import { agregarLlamada } from "@/lib/deals/llamadas";
import {
  asignarLlamadaSuelta,
  crearDealDesdeSuelta,
  registrarLlamadaDeCalendly,
  type CitaDeCalendly,
} from "@/lib/calendly/colgar-llamada";
import { aplicarReglaDeDeal } from "@/lib/ingesta/regla-de-deals";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { codigoDeDeal } from "@/lib/calendly/link-de-agenda";

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
  dealId = await abrirDeal(db, { leadId, programId, etapa: "registrado", actor: { tipo: "sistema" } });

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
    expect((await deal()).setterUserId).toBeNull();
    expect((await db.select().from(calls).where(eq(calls.dealId, dealId)))[0].closerUserId).toBe(maru);
    expect(await db.select().from(dealActividades)).toHaveLength(0);
  });

  it("si el deal era de otra closer, pasa a la host y queda la nota que avisa", async () => {
    await db.update(deals).set({ ownerUserId: andrea }).where(eq(deals.id, dealId));
    const r = await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: HOST_MARU }));
    expect(r).toMatchObject({ tipo: "colgada", duenoAnterior: andrea });
    expect((await deal()).ownerUserId).toBe(maru);
    expect((await deal()).setterUserId).toBe(andrea);
    const notas = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({ tipo: "nota", userId: null });
  });

  it("un re-agendamiento no pisa el crédito del setter", async () => {
    await db.update(deals).set({ ownerUserId: andrea }).where(eq(deals.id, dealId));
    await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: HOST_MARU }));
    await registrarLlamadaDeCalendly(db, programId, cita({ correoHost: "andrea@calendly.co" }));
    expect(await deal()).toMatchObject({ ownerUserId: andrea, setterUserId: andrea });
  });

  it("el código válido cuelga el deal aunque el correo sea distinto y guarda el raw", async () => {
    const r = await registrarLlamadaDeCalendly(db, programId, cita({
      correoInvitado: "otra@correo.co",
      utmContent: codigoDeDeal(dealId),
      nombreInvitado: "Ana Pérez",
      telefonoInvitado: "+57 300 123 4567",
    }));
    expect(r).toMatchObject({ tipo: "colgada", dealId });
    const [llamada] = await db.select().from(calls).where(eq(calls.dealId, dealId));
    expect(llamada.raw).toEqual({ nombre: "Ana Pérez", telefono: "+57 300 123 4567", utmContent: codigoDeDeal(dealId) });
  });

  it("un código ajeno o cerrado no casa y cae a la regla de correo", async () => {
    const [leadAjeno] = await db.insert(leads).values({ programId: otroProgramId, emailNormalizado: "ajeno@correo.co" }).returning();
    const dealAjeno = await abrirDeal(db, { leadId: leadAjeno.id, programId: otroProgramId, etapa: "registrado", actor: { tipo: "sistema" } });
    expect(await registrarLlamadaDeCalendly(db, programId, cita({ utmContent: codigoDeDeal(dealAjeno) }))).toMatchObject({ tipo: "colgada", dealId });

    const [leadCerrado] = await db.insert(leads).values({ programId, emailNormalizado: "cerrado@correo.co" }).returning();
    const [cerrado] = await db.insert(deals).values({ programId, leadId: leadCerrado.id, etapa: "cierre_perdido" }).returning();
    expect(await registrarLlamadaDeCalendly(db, programId, cita({ utmContent: codigoDeDeal(cerrado.id) }))).toMatchObject({ tipo: "colgada", dealId });
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
    const r = await registrarLlamadaDeCalendly(db, programId, cita({ correoInvitado: "otra@correo.co", correoHost: HOST_MARU }));
    expect(r).toMatchObject({ tipo: "suelta", motivo: "sin_lead" });
    const [llamada] = await db.select().from(calls);
    expect(llamada).toMatchObject({ dealId: null, programId, origen: "calendly", closerUserId: maru });
    expect((await deal()).etapa).toBe("registrado");
  });

  it("el programa es frontera: el mismo correo en OTRO programa no cuelga nada aqui", async () => {
    const r = await registrarLlamadaDeCalendly(db, otroProgramId, cita());
    expect(r).toMatchObject({ tipo: "suelta", motivo: "sin_lead" });
    expect((await deal()).etapa).toBe("registrado");
  });

  it("un correo que entro unido por telefono y nadie confirmo no decide", async () => {
    const [l] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: "beto@correo.co", nombre: "Beto" })
      .returning();
    await abrirDeal(db, { leadId: l.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
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
  async function suelta(host = HOST_MARU): Promise<string> {
    const r = await registrarLlamadaDeCalendly(
      db,
      programId,
      cita({ correoInvitado: "agenda-distinta@correo.co", correoHost: host }),
    );
    expect(r.tipo).toBe("suelta");
    return r.callId;
  }

  it("un closer del programa la cuelga del deal: Agendado, dueño la host y rastro con su nombre", async () => {
    const callId = await suelta();
    const r = await asignarLlamadaSuelta(db, { userId: maru, rol: "closer" }, { callId, dealId });
    expect(r).toMatchObject({ movioAAgendado: true });

    const d = await deal();
    expect(d.etapa).toBe("agendado");
    expect(d.ownerUserId).toBe(maru);
    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, callId), eq(changeLog.campo, "dealId")));
    expect(rastro).toHaveLength(1);
    expect(rastro[0]).toMatchObject({ userId: maru, valorAnterior: null, valorNuevo: dealId });
  });

  it("una llamada ya asignada no se reasigna: 404", async () => {
    const callId = await suelta();
    await asignarLlamadaSuelta(db, { userId: maru, rol: "closer" }, { callId, dealId });
    await expect(asignarLlamadaSuelta(db, { userId: maru, rol: "closer" }, { callId, dealId })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("un closer que no es host recibe 403 y la base no se mueve", async () => {
    const callId = await suelta();
    await expect(asignarLlamadaSuelta(db, { userId: andrea, rol: "closer" }, { callId, dealId })).rejects.toMatchObject({
      status: 403,
    });
    const [llamada] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(llamada.dealId).toBeNull();
    expect((await deal()).ownerUserId).toBeNull();
  });

  it("quien administra puede colgarla aunque no sea el host", async () => {
    const callId = await suelta();
    await expect(asignarLlamadaSuelta(db, { userId: gerente, rol: "gerente" }, { callId, dealId })).resolves.toMatchObject({ movioAAgendado: true });
  });

  it("sin host registrado solo quien administra puede colgarla", async () => {
    const callId = await suelta("externa@calendly.co");
    await expect(asignarLlamadaSuelta(db, { userId: maru, rol: "closer" }, { callId, dealId })).rejects.toMatchObject({ status: 403 });
    await expect(asignarLlamadaSuelta(db, { userId: gerente, rol: "gerente" }, { callId, dealId })).resolves.toMatchObject({ movioAAgendado: true });
  });

  it("al colgar una suelta completa el closer si la cuenta se vinculó después", async () => {
    const callId = await suelta("nueva@calendly.co");
    await db.update(miembrosPrograma).set({ calendlyEmail: "nueva@calendly.co" }).where(eq(miembrosPrograma.userId, maru));
    await asignarLlamadaSuelta(db, { userId: maru, rol: "closer" }, { callId, dealId });
    const [llamada] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(llamada.closerUserId).toBe(maru);
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
      etapa: "registrado",
      actor: { tipo: "sistema" },
    });
    await expect(
      asignarLlamadaSuelta(db, { userId: maru, rol: "closer" }, { callId, dealId: dealAjeno }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("crearDealDesdeSuelta", () => {
  async function sueltaDe(correo: string, programa = programId): Promise<string> {
    const r = await registrarLlamadaDeCalendly(
      db,
      programa,
      cita({ correoInvitado: correo, correoHost: HOST_MARU }),
    );
    expect(r.tipo).toBe("suelta");
    return r.callId;
  }

  it("crea lead y deal, cuelga la llamada y deja Agendado con la host como dueña", async () => {
    const callId = await sueltaDe("nueva@correo.co");
    const r = await crearDealDesdeSuelta(
      db,
      { userId: maru, rol: "closer" },
      { callId, nombre: "Nueva Persona", telefono: "+57 300 111 2233" },
    );

    const [lead] = await db.select().from(leads).where(eq(leads.id, r.leadId));
    const [d] = await db.select().from(deals).where(eq(deals.id, r.dealId));
    const [llamada] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(lead).toMatchObject({ emailNormalizado: "nueva@correo.co", nombre: "Nueva Persona" });
    expect(d).toMatchObject({ etapa: "agendado", ownerUserId: maru });
    expect(llamada).toMatchObject({ dealId: r.dealId, closerUserId: maru });
  });

  it("si el correo ya tiene deal abierto devuelve 409 y revierte toda la transacción", async () => {
    const correo = "conflicto@correo.co";
    const callId = await sueltaDe(correo);
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: correo }).returning();
    await abrirDeal(db, { leadId: lead.id, programId, etapa: "registrado", actor: { tipo: "sistema" } });
    const antes = {
      leads: (await db.select().from(leads)).length,
      deals: (await db.select().from(deals)).length,
      calls: (await db.select().from(calls)).length,
    };

    await expect(
      crearDealDesdeSuelta(db, { userId: maru, rol: "closer" }, { callId }),
    ).rejects.toMatchObject({ status: 409 });

    expect({
      leads: (await db.select().from(leads)).length,
      deals: (await db.select().from(deals)).length,
      calls: (await db.select().from(calls)).length,
    }).toEqual(antes);
    expect((await db.select().from(calls).where(eq(calls.id, callId)))[0].dealId).toBeNull();
  });

  it("una llamada de un programa fuera del alcance responde 404", async () => {
    const callId = await sueltaDe("ajena@correo.co", otroProgramId);
    await expect(
      crearDealDesdeSuelta(db, { userId: maru, rol: "closer" }, { callId }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reutiliza un lead existente que todavía no tiene deal abierto", async () => {
    const correo = "existente@correo.co";
    const [existente] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: correo, nombre: "Nombre anterior" })
      .returning();
    const callId = await sueltaDe(correo);
    const r = await crearDealDesdeSuelta(
      db,
      { userId: maru, rol: "closer" },
      { callId, nombre: "Nombre nuevo" },
    );
    expect(r.leadId).toBe(existente.id);
    expect(await db.select().from(leads).where(eq(leads.emailNormalizado, correo))).toHaveLength(1);
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
      { id: l.id, programId, emailNormalizado: "caro@correo.co", hechos: { esParcial: false, agendo: true, leadQuality: null } },
      { estado: "vigente", inicio: new Date("2026-10-02T15:00:00Z"), uuidInvitado: "uuid-caro", correoHost: HOST_MARU },
    );
    const [d] = await db.select().from(deals).where(eq(deals.id, r.dealAbiertoId!));
    expect(d).toMatchObject({ etapa: "agendado", ownerUserId: maru });
    expect(d.setterUserId).toBeNull();
    const [llamada] = await db.select().from(calls).where(eq(calls.dealId, d.id));
    expect(llamada).toMatchObject({ calendlyHostEmail: HOST_MARU, closerUserId: maru });
  });

  it("sin host registrada el deal nace sin dueño, como antes", async () => {
    const [l] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: "dani@correo.co", nombre: "Dani", calificacion: "con_calendly" })
      .returning();
    const r = await aplicarReglaDeDeal(
      db,
      { id: l.id, programId, emailNormalizado: "dani@correo.co", hechos: { esParcial: false, agendo: true, leadQuality: null } },
      { estado: "vigente", inicio: new Date("2026-10-02T15:00:00Z"), uuidInvitado: "uuid-dani", correoHost: "x@y.co" },
    );
    const [d] = await db.select().from(deals).where(eq(deals.id, r.dealAbiertoId!));
    expect(d.ownerUserId).toBeNull();
  });
});

describe("camino D: la closer agrega la cita a mano", () => {
  it("la llamada queda en su deal, conserva la dueña y no inventa setter", async () => {
    await db.update(deals).set({ ownerUserId: maru }).where(eq(deals.id, dealId));
    const r = await agregarLlamada(db, { userId: maru, rol: "closer" }, {
      dealId,
      fechaAgenda: new Date("2026-10-03T15:00:00Z"),
    });
    const [llamada] = await db.select().from(calls).where(eq(calls.id, r.callId));
    expect(llamada).toMatchObject({ dealId, origen: "crm", resultado: "agendada" });
    expect(await deal()).toMatchObject({ ownerUserId: maru, setterUserId: null, etapa: "agendado" });
  });
});
