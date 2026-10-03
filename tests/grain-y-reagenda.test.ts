import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  areas,
  calls,
  changeLog,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { ErrorDeApp } from "@/lib/errors";
import { agregarLlamada, marcarFallida, pegarGrain } from "@/lib/deals/llamadas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Tickets 058 y 059 — Pegar el Grain **es** decir que la llamada sucedió, y una
 * llamada fallida (no_show / cancelada) manda el deal a Pendiente Re-agenda.
 *
 * Cubre lo que solo existe con base:
 *  - pegar el Grain deja `show`, `link_grain`, `fecha_llamada` (solo si estaba vacía)
 *    y mueve el deal a Atendido, todo en una operación, con fila de historial;
 *  - quitar/corregir el link no mueve el deal por su cuenta;
 *  - no_show y cancelada (dos valores distintos) mueven a Re-agenda: T8 desde Agendado
 *    (sistema, sin motivo) y T29 desde Atendido (closer, con motivo);
 *  - una Call nueva con fecha sobre un deal en Re-agenda lo devuelve a Agendado;
 *  - las rejas: no-dueño, deal anulado/cerrado, llamada anulada;
 *  - cada escritura deja fila en `change_log`, cada movimiento en `deal_etapa_historial`.
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
let motivoReagenda: string;

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
  const [m] = await db.insert(motivos).values({ nombre: "Cita fallida", tipo: "reagenda" }).returning();
  motivoReagenda = m.id;
});

afterEach(async () => {
  await cerrar();
});

/** Desde Atendido toda respuesta pide el área (143): estos casos prueban el motivo, no el área. */
async function conArea(): Promise<Partial<typeof deals.$inferInsert>> {
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  return { areaDeclaradaId: area.id };
}

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [d] = await db
    .insert(deals)
    .values({ leadId, programId, cohortId, etapa, ownerUserId: closer, ...extra })
    .returning();
  return d.id;
}

/**
 * Una llamada agendada del deal, con fecha (para que `tieneLlamadaConFecha` se cumpla
 * donde haga falta) y sin `fecha_llamada` (para probar que el Grain la llena).
 */
async function agendadaDe(dealId: string, extra: Partial<typeof calls.$inferInsert> = {}) {
  const [call] = await db
    .insert(calls)
    .values({
      dealId,
      programId,
      cohortId,
      emailLead: "ana@correo.co",
      closerUserId: closer,
      fechaAgenda: new Date(Date.now() + 60 * 60 * 1000),
      resultado: "agendada",
      origen: "crm",
      ...extra,
    })
    .returning();
  return call;
}

function comoCloser() {
  return { userId: closer, rol: rolCloser };
}

const enUnaHora = () => new Date(Date.now() + 60 * 60 * 1000);

async function etapaDe(dealId: string) {
  const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId));
  return d.etapa;
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

async function callPorId(callId: string) {
  const [c] = await db.select().from(calls).where(eq(calls.id, callId));
  return c;
}

async function capturar(p: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await p;
  } catch (e) {
    return e as ErrorDeApp;
  }
  throw new Error("se esperaba un error");
}

// ───────────────────────────────────────────────────────────── 058 · pegarGrain

describe("pegarGrain: pegar el link es decir que la llamada sucedió", () => {
  it("desde Agendado deja show, link, fecha y deal en Atendido, en una operación, con historial", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    expect(call.fechaLlamada).toBeNull();

    const { movioAAtendido, etapa } = await pegarGrain(db, comoCloser(), {
      callId: call.id,
      linkGrain: "https://grain.com/share/highlight/abc",
    });

    expect(movioAAtendido).toBe(true);
    expect(etapa).toBe("atendido");
    expect(await etapaDe(dealId)).toBe("atendido");

    const guardada = await callPorId(call.id);
    expect(guardada.resultado).toBe("show");
    expect(guardada.linkGrain).toBe("https://grain.com/share/highlight/abc");
    expect(guardada.fechaLlamada).not.toBeNull();

    expect(await historial(dealId)).toMatchObject([{ de: "agendado", a: "atendido", userId: null }]);
  });

  it("desde Agendado con Re-agenda pendiente también mueve a Atendido", async () => {
    const dealId = await nuevoDeal("agendado", { pendiente: "reagenda" });
    const call = await agendadaDe(dealId);

    const { movioAAtendido, etapa } = await pegarGrain(db, comoCloser(), {
      callId: call.id,
      linkGrain: "https://grain.com/share/x",
    });

    expect(movioAAtendido).toBe(true);
    expect(etapa).toBe("atendido");
    expect(await historial(dealId)).toMatchObject([{ de: "agendado", a: "atendido", pendienteDe: "reagenda", pendienteA: null }]);
  });

  it("no pisa la fecha de llamada si ya estaba", async () => {
    const dealId = await nuevoDeal("agendado");
    const yaTenia = new Date("2026-09-20T15:00:00-05:00");
    const call = await agendadaDe(dealId, { fechaLlamada: yaTenia });

    await pegarGrain(db, comoCloser(), { callId: call.id, linkGrain: "https://grain.com/share/y" });

    const guardada = await callPorId(call.id);
    expect(guardada.fechaLlamada?.getTime()).toBe(yaTenia.getTime());
  });

  it("si el deal ya está en Atendido, no se mueve pero el Grain y el show se escriben", async () => {
    const dealId = await nuevoDeal("atendido");
    const call = await agendadaDe(dealId);

    const { movioAAtendido, etapa } = await pegarGrain(db, comoCloser(), {
      callId: call.id,
      linkGrain: "https://grain.com/share/z",
    });

    expect(movioAAtendido).toBe(false);
    expect(etapa).toBe("atendido");
    expect(await etapaDe(dealId)).toBe("atendido");
    const guardada = await callPorId(call.id);
    expect(guardada.resultado).toBe("show");
    expect(guardada.linkGrain).toBe("https://grain.com/share/z");
    expect(await historial(dealId)).toHaveLength(0);
  });

  it("deja rastro en change_log de link_grain, resultado y fecha_llamada", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);

    await pegarGrain(db, comoCloser(), { callId: call.id, linkGrain: "https://grain.com/share/w" });

    const campos = (await bitacoraDeCall(call.id)).map((f) => f.campo);
    expect(campos).toContain("linkGrain");
    expect(campos).toContain("resultado");
    expect(campos).toContain("fechaLlamada");
  });

  it("el developer puede pegar el Grain aunque el deal sea de otro (esAdministrador)", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    const call = await agendadaDe(dealId);

    const { movioAAtendido } = await pegarGrain(
      db,
      { userId: developer, rol: "developer" },
      { callId: call.id, linkGrain: "https://grain.com/share/dev" },
    );

    expect(movioAAtendido).toBe(true);
    expect(await etapaDe(dealId)).toBe("atendido");
  });
});

describe("pegarGrain: rechazos", () => {
  it("un no-dueño se rechaza con 403 y no escribe nada", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    const call = await agendadaDe(dealId);
    const err = await capturar(
      pegarGrain(db, { userId: otroCloser, rol: "closer" }, { callId: call.id, linkGrain: "https://grain.com/x" }),
    );
    expect(err.status).toBe(403);
    const guardada = await callPorId(call.id);
    expect(guardada.linkGrain).toBeNull();
    expect(guardada.resultado).toBe("agendada");
    expect(await etapaDe(dealId)).toBe("agendado");
  });

  it("un gerente no puede (administra pero no trabaja leads)", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    const err = await capturar(
      pegarGrain(db, { userId: gerente, rol: "gerente" }, { callId: call.id, linkGrain: "https://grain.com/x" }),
    );
    expect(err.status).toBe(403);
  });

  it("una llamada anulada se rechaza con 404", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    await db
      .update(calls)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" })
      .where(eq(calls.id, call.id));
    const err = await capturar(pegarGrain(db, comoCloser(), { callId: call.id, linkGrain: "https://grain.com/x" }));
    expect(err.status).toBe(404);
  });

  it("un deal anulado se rechaza y no escribe nada", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    await db
      .update(deals)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" })
      .where(eq(deals.id, dealId));
    const err = await capturar(pegarGrain(db, comoCloser(), { callId: call.id, linkGrain: "https://grain.com/x" }));
    expect(err.status).toBe(409);
    const guardada = await callPorId(call.id);
    expect(guardada.linkGrain).toBeNull();
  });

  it("un deal cerrado se rechaza", async () => {
    for (const etapa of ["ganado_completo", "cierre_perdido"] as EtapaDeal[]) {
      const dealId = await nuevoDeal(etapa);
      const call = await agendadaDe(dealId);
      const err = await capturar(pegarGrain(db, comoCloser(), { callId: call.id, linkGrain: "https://grain.com/x" }));
      expect(err.status).toBe(409);
    }
  });

  it("un link que no es URL es entrada inválida (400)", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    const err = await capturar(pegarGrain(db, comoCloser(), { callId: call.id, linkGrain: "no-es-url" }));
    expect(err.status).toBe(400);
  });

  it("una llamada inexistente se rechaza con 404", async () => {
    const err = await capturar(
      pegarGrain(db, comoCloser(), {
        callId: "00000000-0000-0000-0000-000000000000",
        linkGrain: "https://grain.com/x",
      }),
    );
    expect(err.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────── 059 · marcarFallida → Re-agenda

describe("marcarFallida: no_show y cancelada mandan a Pendiente Re-agenda", () => {
  for (const resultado of ["no_show", "cancelada"] as const) {
    it(`${resultado} desde Agendado mueve a Re-agenda (T8, sistema) con historial`, async () => {
      const dealId = await nuevoDeal("agendado");
      const call = await agendadaDe(dealId);

      const { etapa } = await marcarFallida(db, comoCloser(), { callId: call.id, resultado });

      expect(etapa).toBe("agendado");
      expect(await etapaDe(dealId)).toBe("agendado");
      expect(await callPorId(call.id).then((c) => c.resultado)).toBe(resultado);
      expect(await historial(dealId)).toMatchObject([
        { de: "agendado", a: "agendado", pendienteDe: null, pendienteA: "reagenda", userId: null },
      ]);
    });
  }

  it("no_show y cancelada siguen siendo dos valores distintos (ADR 0015)", async () => {
    // Dos leads distintos: un lead no puede tener dos deals abiertos en el mismo
    // programa (deals_uno_abierto_por_lead_y_programa_idx).
    const [l2] = await db
      .insert(leads)
      .values({ programId, emailNormalizado: "beto@correo.co", nombre: "Beto" })
      .returning();

    const [d1row] = await db
      .insert(deals)
      .values({ leadId, programId, cohortId, etapa: "agendado", ownerUserId: closer })
      .returning();
    const c1 = await agendadaDe(d1row.id);
    await marcarFallida(db, comoCloser(), { callId: c1.id, resultado: "no_show" });

    const [d2row] = await db
      .insert(deals)
      .values({ leadId: l2.id, programId, cohortId, etapa: "agendado", ownerUserId: closer })
      .returning();
    const [c2] = await db
      .insert(calls)
      .values({
        dealId: d2row.id,
        programId,
        cohortId,
        emailLead: "beto@correo.co",
        closerUserId: closer,
        fechaAgenda: enUnaHora(),
        resultado: "agendada",
        origen: "crm",
      })
      .returning();
    await marcarFallida(db, comoCloser(), { callId: c2.id, resultado: "cancelada" });

    expect(await callPorId(c1.id).then((c) => c.resultado)).toBe("no_show");
    expect(await callPorId(c2.id).then((c) => c.resultado)).toBe("cancelada");
  });

  it("desde Agendado una llamada fallida deja Re-agenda pendiente", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);

    const { etapa } = await marcarFallida(db, comoCloser(), {
      callId: call.id,
      resultado: "no_show",
    });

    expect(etapa).toBe("agendado");
    expect(await historial(dealId)).toMatchObject([
      { de: "agendado", a: "agendado", pendienteDe: null, pendienteA: "reagenda", userId: null },
    ]);
  });

  it("desde Atendido con motivo se queda en Atendido con Re-agenda, y lo firma el closer (PR2)", async () => {
    const dealId = await nuevoDeal("atendido", await conArea());
    const call = await agendadaDe(dealId, { resultado: "show", fechaLlamada: enUnaHora() });

    const { etapa } = await marcarFallida(db, comoCloser(), { callId: call.id, resultado: "cancelada", motivoId: motivoReagenda });

    expect(etapa).toBe("atendido");
    expect(await historial(dealId)).toMatchObject([
      { de: "atendido", a: "atendido", pendienteDe: null, pendienteA: "reagenda", userId: closer, motivoId: motivoReagenda },
    ]);
  });

  it("desde Atendido sin motivo se rechaza (PR2 exige motivo) y no mueve", async () => {
    const dealId = await nuevoDeal("atendido", await conArea());
    const call = await agendadaDe(dealId, { resultado: "show", fechaLlamada: enUnaHora() });

    const err = await capturar(marcarFallida(db, comoCloser(), { callId: call.id, resultado: "cancelada" }));

    expect(err.status).toBe(422);
    expect(await etapaDe(dealId)).toBe("atendido");
    // El resultado se escribió dentro de la transacción y se deshizo al rechazar el
    // movimiento: la llamada sigue como estaba.
    expect(await callPorId(call.id).then((c) => c.resultado)).toBe("show");
  });

  it("deja rastro en change_log del resultado", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    await marcarFallida(db, comoCloser(), { callId: call.id, resultado: "no_show" });
    const campos = (await bitacoraDeCall(call.id)).map((f) => f.campo);
    expect(campos).toContain("resultado");
  });

  it("el developer puede marcar fallida un deal de otro (esAdministrador)", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    const call = await agendadaDe(dealId);
    const { etapa } = await marcarFallida(
      db,
      { userId: developer, rol: "developer" },
      { callId: call.id, resultado: "cancelada" },
    );
    expect(etapa).toBe("agendado");
  });
});

describe("marcarFallida: rechazos", () => {
  it("un no-dueño se rechaza con 403 y no escribe nada", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    const call = await agendadaDe(dealId);
    const err = await capturar(
      marcarFallida(db, { userId: otroCloser, rol: "closer" }, { callId: call.id, resultado: "no_show" }),
    );
    expect(err.status).toBe(403);
    expect(await callPorId(call.id).then((c) => c.resultado)).toBe("agendada");
    expect(await etapaDe(dealId)).toBe("agendado");
  });

  it("un deal anulado se rechaza", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    await db
      .update(deals)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" })
      .where(eq(deals.id, dealId));
    const err = await capturar(marcarFallida(db, comoCloser(), { callId: call.id, resultado: "no_show" }));
    expect(err.status).toBe(409);
  });

  it("una llamada anulada se rechaza con 404", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    await db
      .update(calls)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" })
      .where(eq(calls.id, call.id));
    const err = await capturar(marcarFallida(db, comoCloser(), { callId: call.id, resultado: "no_show" }));
    expect(err.status).toBe(404);
  });

  it("un resultado que no es fallido es entrada inválida (400)", async () => {
    const dealId = await nuevoDeal("agendado");
    const call = await agendadaDe(dealId);
    const err = await capturar(
      // @ts-expect-error probamos el borde: show no es un resultado fallido
      marcarFallida(db, comoCloser(), { callId: call.id, resultado: "show" }),
    );
    expect(err.status).toBe(400);
  });
});

// ─────────────────────── 059 · una Call nueva sobre un deal en Re-agenda lo devuelve

describe("una Call nueva con fecha sobre un deal en Re-agenda lo devuelve a Agendado", () => {
  it("agregarLlamada desde Agendado con Re-agenda pendiente limpia el pendiente", async () => {
    const dealId = await nuevoDeal("agendado", { pendiente: "reagenda" });

    const { movioAAgendado } = await agregarLlamada(db, comoCloser(), {
      dealId,
      fechaAgenda: enUnaHora(),
    });

    expect(movioAAgendado).toBe(true);
    expect(await etapaDe(dealId)).toBe("agendado");
    expect(await historial(dealId)).toMatchObject([
      { de: "agendado", a: "agendado", pendienteDe: "reagenda", pendienteA: null, userId: closer },
    ]);
  });
});
