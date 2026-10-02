import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
  changeLog,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { ErrorDeApp } from "@/lib/errors";
import { agregarLlamada, completarAgendada } from "@/lib/deals/llamadas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 057 — Las Calls cuelgan del deal.
 *
 * Cubre lo que solo existe con base:
 *  - una llamada nativa nace con `deal_id`, `program_id`, `cohort_id`, `closer_user_id`
 *    y `origen = "crm"`; NO puede existir sin deal;
 *  - solo quien trabaja leads (closer/developer) y es dueño del deal la registra; un
 *    gerente, un no-dueño y un deal sin dueño se rechazan;
 *  - un deal anulado o cerrado se rechaza;
 *  - la etapa se mueve a Agendado SOLO desde 1, 2, 3, 9 u 11, y deja fila en
 *    `deal_etapa_historial`; en 5, 6 y 7 no cambia;
 *  - completar la agendada del sistema pone fecha, link y closer;
 *  - cada escritura deja su fila en `change_log`.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let leadId: string;
let closer: string;
let otroCloser: string;
let gerente: string;
let developer: string;

const rolCloser = "closer" as const;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaCierreVentas: "2026-09-30",
    })
    .returning();
  cohortId = c.id;
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" })
    .returning();
  leadId = l.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  closer = u.id;
  const [u2] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer" }).returning();
  otroCloser = u2.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [d] = await db.insert(users).values({ email: "dev@retiagrowth.com", rol: "developer" }).returning();
  developer = d.id;
});

afterEach(async () => {
  await cerrar();
});

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [d] = await db
    .insert(deals)
    .values({ leadId, programId, cohortId, etapa, ownerUserId: closer, ...extra })
    .returning();
  return d.id;
}

function comoCloser() {
  return { userId: closer, rol: rolCloser };
}

const enUnaHora = () => new Date(Date.now() + 60 * 60 * 1000);

async function llamadasDe(dealId: string) {
  return db.select().from(calls).where(eq(calls.dealId, dealId));
}

async function historial(dealId: string) {
  return db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
}

async function bitacoraDeCall(callId: string) {
  return db
    .select()
    .from(changeLog)
    .where(and(eq(changeLog.tabla, "calls"), eq(changeLog.registroId, callId)));
}

async function capturar(p: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await p;
  } catch (e) {
    return e as ErrorDeApp;
  }
  throw new Error("se esperaba un error");
}

describe("agregarLlamada: la llamada nace del deal", () => {
  it("hereda deal, programa, cohorte y closer, con resultado agendada y origen crm", async () => {
    const dealId = await nuevoDeal("contactado");
    const fecha = enUnaHora();

    const { callId, movioAAgendado } = await agregarLlamada(db, comoCloser(), {
      dealId,
      fechaAgenda: fecha,
      linkCalendly: "https://calendly.com/maru/30min/abc",
    });

    expect(movioAAgendado).toBe(true);
    const [call] = await llamadasDe(dealId);
    expect(call).toMatchObject({
      id: callId,
      dealId,
      programId,
      cohortId,
      closerUserId: closer,
      emailLead: "ana@correo.co",
      resultado: "agendada",
      origen: "crm",
      linkCalendly: "https://calendly.com/maru/30min/abc",
    });
    expect(call.fechaAgenda?.getTime()).toBe(fecha.getTime());
  });

  it("deja rastro en change_log de cada campo escrito", async () => {
    const dealId = await nuevoDeal("contactado");
    const { callId } = await agregarLlamada(db, comoCloser(), { dealId, fechaAgenda: enUnaHora() });

    const filas = await bitacoraDeCall(callId);
    const campos = filas.map((f) => f.campo);
    expect(campos).toContain("dealId");
    expect(campos).toContain("closerUserId");
    expect(campos).toContain("fechaAgenda");
    expect(campos).toContain("resultado");
    // El actor de la sesión, no del input.
    expect(filas.every((f) => f.userId === closer)).toBe(true);
  });

  it("el developer puede registrar (trabajaLeads incluye developer)", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: developer });
    const { callId } = await agregarLlamada(db, { userId: developer, rol: "developer" }, {
      dealId,
      fechaAgenda: enUnaHora(),
    });
    const [call] = await llamadasDe(dealId);
    expect(call.id).toBe(callId);
    expect(call.closerUserId).toBe(developer);
  });
});

describe("agregarLlamada: el efecto sobre la etapa (decisión 24-sep)", () => {
  const AVANZAN: { etapa: EtapaDeal; pendiente?: "reagenda" | "seguimiento" | "proxima_cohorte" }[] = [
    { etapa: "registrado" },
    { etapa: "contactado" },
    { etapa: "agendado", pendiente: "reagenda" },
    { etapa: "calificado", pendiente: "proxima_cohorte" },
    { etapa: "atendido", pendiente: "seguimiento" },
  ];

  for (const { etapa, pendiente } of AVANZAN) {
    it(`desde ${etapa} pasa a Agendado y deja fila de historial`, async () => {
      const dealId = await nuevoDeal(etapa, { pendiente });
      const { movioAAgendado } = await agregarLlamada(db, comoCloser(), {
        dealId,
        fechaAgenda: enUnaHora(),
      });
      expect(movioAAgendado).toBe(true);
      const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId));
      expect(d.etapa).toBe("agendado");
      expect(await historial(dealId)).toMatchObject([{ de: etapa, a: "agendado", userId: closer }]);
    });
  }

  const NO_CAMBIAN: EtapaDeal[] = ["atendido", "compromiso_verbal", "ganado_parcial"];

  for (const etapa of NO_CAMBIAN) {
    it(`desde ${etapa} la etapa no cambia pero la llamada queda`, async () => {
      const dealId = await nuevoDeal(etapa);
      const { movioAAgendado } = await agregarLlamada(db, comoCloser(), {
        dealId,
        fechaAgenda: enUnaHora(),
      });
      expect(movioAAgendado).toBe(false);
      const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId));
      expect(d.etapa).toBe(etapa);
      expect(await llamadasDe(dealId)).toHaveLength(1);
      expect(await historial(dealId)).toHaveLength(0);
    });
  }

  it("desde agendado la etapa no cambia (no hay flecha agendado→agendado por closer)", async () => {
    const dealId = await nuevoDeal("agendado");
    const { movioAAgendado } = await agregarLlamada(db, comoCloser(), {
      dealId,
      fechaAgenda: enUnaHora(),
    });
    expect(movioAAgendado).toBe(false);
    const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId));
    expect(d.etapa).toBe("agendado");
    expect(await llamadasDe(dealId)).toHaveLength(1);
  });
});

describe("agregarLlamada: rechazos", () => {
  it("un deal inexistente se rechaza con 404", async () => {
    const err = await capturar(
      agregarLlamada(db, comoCloser(), {
        dealId: "00000000-0000-0000-0000-000000000000",
        fechaAgenda: enUnaHora(),
      }),
    );
    expect(err.status).toBe(404);
  });

  it("un deal anulado se rechaza", async () => {
    const dealId = await nuevoDeal("contactado");
    await db
      .update(deals)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error de dedo" })
      .where(eq(deals.id, dealId));
    const err = await capturar(agregarLlamada(db, comoCloser(), { dealId, fechaAgenda: enUnaHora() }));
    expect(err.status).toBe(409);
    expect(await llamadasDe(dealId)).toHaveLength(0);
  });

  it("un deal cerrado (completo / cierre_perdido) se rechaza", async () => {
    for (const etapa of ["ganado_completo", "cierre_perdido"] as EtapaDeal[]) {
      const dealId = await nuevoDeal(etapa);
      const err = await capturar(agregarLlamada(db, comoCloser(), { dealId, fechaAgenda: enUnaHora() }));
      expect(err.status).toBe(409);
      expect(await llamadasDe(dealId)).toHaveLength(0);
    }
  });

  it("un no-dueño se rechaza con 403 y no escribe nada", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    const err = await capturar(
      agregarLlamada(db, { userId: otroCloser, rol: "closer" }, { dealId, fechaAgenda: enUnaHora() }),
    );
    expect(err.status).toBe(403);
    expect(await llamadasDe(dealId)).toHaveLength(0);
  });

  it("un deal sin dueño se rechaza (reclamar es el ticket 070)", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: null });
    const err = await capturar(agregarLlamada(db, comoCloser(), { dealId, fechaAgenda: enUnaHora() }));
    expect(err.status).toBe(409);
    expect(await llamadasDe(dealId)).toHaveLength(0);
  });

  it("un gerente no registra llamadas (administra pero no trabaja leads)", async () => {
    const dealId = await nuevoDeal("contactado");
    const err = await capturar(
      agregarLlamada(db, { userId: gerente, rol: "gerente" }, { dealId, fechaAgenda: enUnaHora() }),
    );
    expect(err.status).toBe(403);
    expect(await llamadasDe(dealId)).toHaveLength(0);
  });

  it("sin fecha de agenda es entrada inválida (400)", async () => {
    const dealId = await nuevoDeal("contactado");
    const err = await capturar(
      // @ts-expect-error probamos el borde: falta la fecha
      agregarLlamada(db, comoCloser(), { dealId }),
    );
    expect(err.status).toBe(400);
  });
});

describe("completarAgendada: el dueño completa la agendada del sistema", () => {
  /** La llamada agendada sin closer que crea el sistema (regla de Calendly). */
  async function agendadaDelSistema(dealId: string) {
    const [call] = await db
      .insert(calls)
      .values({
        dealId,
        programId,
        cohortId,
        emailLead: "ana@correo.co",
        resultado: "agendada",
        origen: "calendly",
        closerUserId: null,
        huellaFila: "calendly:abc",
      })
      .returning();
    return call.id;
  }

  it("pone fecha, link y queda como closer, con rastro en change_log", async () => {
    const dealId = await nuevoDeal("agendado");
    const callId = await agendadaDelSistema(dealId);
    const fecha = enUnaHora();

    await completarAgendada(db, comoCloser(), {
      callId,
      fechaAgenda: fecha,
      linkCalendly: "https://calendly.com/maru/30min/xyz",
    });

    const [call] = await db.select().from(calls).where(eq(calls.id, callId));
    expect(call.closerUserId).toBe(closer);
    expect(call.fechaAgenda?.getTime()).toBe(fecha.getTime());
    expect(call.linkCalendly).toBe("https://calendly.com/maru/30min/xyz");

    const filas = await bitacoraDeCall(callId);
    const campos = filas.map((f) => f.campo);
    expect(campos).toContain("closerUserId");
    expect(campos).toContain("fechaAgenda");
    expect(filas.every((f) => f.userId === closer)).toBe(true);
  });

  it("una llamada ya reclamada no se re-completa", async () => {
    const dealId = await nuevoDeal("agendado");
    const [call] = await db
      .insert(calls)
      .values({
        dealId,
        programId,
        cohortId,
        resultado: "agendada",
        origen: "crm",
        closerUserId: closer,
      })
      .returning();
    const err = await capturar(
      completarAgendada(db, comoCloser(), { callId: call.id, fechaAgenda: enUnaHora() }),
    );
    expect(err.status).toBe(409);
  });

  it("un no-dueño no completa la agendada del deal", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    const callId = await agendadaDelSistema(dealId);
    const err = await capturar(
      completarAgendada(db, { userId: otroCloser, rol: "closer" }, { callId, fechaAgenda: enUnaHora() }),
    );
    expect(err.status).toBe(403);
  });

  it("una llamada inexistente se rechaza con 404", async () => {
    const err = await capturar(
      completarAgendada(db, comoCloser(), {
        callId: "00000000-0000-0000-0000-000000000000",
        fechaAgenda: enUnaHora(),
      }),
    );
    expect(err.status).toBe(404);
  });
});

import "./142-nuevas-llamadas-del-deal";
