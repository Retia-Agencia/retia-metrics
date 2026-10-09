import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { abrirDeal, moverEtapa } from "@/lib/deals/mover-etapa";
import { editarAcuerdoDePago, fechaLimiteMaxima, fechaEfectivaDePago } from "@/lib/deals/pago";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 061 (ADR 0053): el acuerdo de pago es una nota y una fecha límite, y el inicio de
 * clases de la cohorte del deal es SIEMPRE el tope (Mani, 28-sep).
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let closer: string;
let otroCloser: string;
let gerente: string;
let leadN = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-15",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-10",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
  const [u2] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer", closerId: "Jero" }).returning();
  otroCloser = u2.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
});

afterEach(async () => {
  await cerrar();
});

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: `l${++leadN}@correo.co` }).returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId, cohortId, etapa, ownerUserId: closer, ...extra })
    .returning();
  return d;
}

async function capturar(p: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await p;
  } catch (e) {
    return e as ErrorDeApp;
  }
  throw new Error("se esperaba un error");
}

const comoCloser = () => ({ userId: closer, rol: "closer" as const });

describe("fechaEfectivaDePago: una sola prioridad de fechas", () => {
  it.each([
    ["2026-10-01", "2026-10-15", "2026-11-01", "2026-10-01"],
    [null, "2026-10-15", "2026-11-01", "2026-10-15"],
    [null, null, "2026-11-01", "2026-11-01"],
    [null, null, null, null],
    ["2026-10-01", null, null, "2026-10-01"],
  ])("propia %s, cohorte %s y activa %s dan %s", (propia, cohorte, activa, esperada) => {
    expect(fechaEfectivaDePago(propia, cohorte, activa)).toBe(esperada);
  });
});

describe("fechaLimiteMaxima: el inicio de clases de la cohorte del deal", () => {
  it("usa la cohorte del deal; sin cohorte, la activa del programa; sin ninguna, null", async () => {
    const conCohorte = await nuevoDeal("compromiso_verbal");
    expect(await fechaLimiteMaxima(db, conCohorte)).toBe("2026-10-15");

    const [otra] = await db
      .insert(cohorts)
      .values({ programId, codigo: "C2", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-25", estado: "futuro" })
      .returning();
    const enOtra = await nuevoDeal("compromiso_verbal", { cohortId: otra.id });
    expect(await fechaLimiteMaxima(db, enOtra)).toBe("2026-12-01");

    const sinCohorte = await nuevoDeal("compromiso_verbal", { cohortId: null });
    expect(await fechaLimiteMaxima(db, sinCohorte)).toBe("2026-10-15");

    await db.update(cohorts).set({ estado: "cerrado" }).where(eq(cohorts.id, cohortId));
    expect(await fechaLimiteMaxima(db, sinCohorte)).toBeNull();
  });
});

describe("editarAcuerdoDePago", () => {
  it("bloquea el deal dentro de la transaccion antes de decidir si sigue editable", async () => {
    const d = await nuevoDeal("ganado_completo");
    const bloquear = vi.fn();
    const lectura = Object.assign(Promise.resolve([d]), { for: bloquear });
    bloquear.mockReturnValue(lectura);
    const tx = { select: () => ({ from: () => ({ where: () => lectura }) }) };
    const base = { transaction: (fn: (tx: unknown) => Promise<void>) => fn(tx) } as unknown as Db;

    const e = await capturar(editarAcuerdoDePago(base, comoCloser(), { dealId: d.id, acuerdoPago: "otra nota" }));
    expect(e.status).toBe(409);
    expect(bloquear).toHaveBeenCalledExactlyOnceWith("update");
    const [fila] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(fila.acuerdoPago).toBeNull();
  });

  it("guarda la nota y la fecha con su rastro, y la fecha no pasa del inicio de clases", async () => {
    const d = await nuevoDeal("compromiso_verbal");

    await editarAcuerdoDePago(db, comoCloser(), { dealId: d.id, acuerdoPago: "50% hoy y 50% antes de clases", fechaLimitePago: "2026-10-15" });

    const [f] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(f).toMatchObject({ acuerdoPago: "50% hoy y 50% antes de clases", fechaLimitePago: "2026-10-15" });
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, d.id)));
    expect(rastro.map((r) => r.campo).sort()).toEqual(["acuerdoPago", "fechaLimitePago"]);
    expect(rastro.every((r) => r.userId === closer)).toBe(true);

    const e = await capturar(editarAcuerdoDePago(db, comoCloser(), { dealId: d.id, fechaLimitePago: "2026-10-16" }));
    expect(e.status).toBe(422);
    expect(e.message).toContain("2026-10-15");
    const [igual] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(igual.fechaLimitePago).toBe("2026-10-15");
  });

  it("omitir un campo no lo toca; vacío borra la nota y null borra la fecha", async () => {
    const d = await nuevoDeal("compromiso_verbal", { acuerdoPago: "nota", fechaLimitePago: "2026-10-01" });
    await editarAcuerdoDePago(db, comoCloser(), { dealId: d.id, acuerdoPago: "otra nota" });
    let [f] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(f).toMatchObject({ acuerdoPago: "otra nota", fechaLimitePago: "2026-10-01" });
    await editarAcuerdoDePago(db, comoCloser(), { dealId: d.id, acuerdoPago: "  ", fechaLimitePago: null });
    [f] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(f).toMatchObject({ acuerdoPago: null, fechaLimitePago: null });
  });

  it("sin cohorte de referencia no hay tope", async () => {
    await db.update(cohorts).set({ estado: "cerrado" }).where(eq(cohorts.id, cohortId));
    const d = await nuevoDeal("compromiso_verbal", { cohortId: null });
    await editarAcuerdoDePago(db, comoCloser(), { dealId: d.id, fechaLimitePago: "2027-01-01" });
    const [f] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(f.fechaLimitePago).toBe("2027-01-01");
  });

  it("solo el dueño o un administrador; un deal anulado o cerrado no se edita", async () => {
    const d = await nuevoDeal("compromiso_verbal");
    expect((await capturar(editarAcuerdoDePago(db, { userId: otroCloser, rol: "closer" }, { dealId: d.id, acuerdoPago: "x" }))).status).toBe(403);
    await editarAcuerdoDePago(db, { userId: gerente, rol: "gerente" }, { dealId: d.id, acuerdoPago: "lo pone el gerente" });

    for (const etapa of ["ganado_completo", "cierre_perdido"] as const) {
      const c = await nuevoDeal(etapa);
      expect((await capturar(editarAcuerdoDePago(db, comoCloser(), { dealId: c.id, acuerdoPago: "x" }))).status).toBe(409);
    }
    const anulado = await nuevoDeal("compromiso_verbal", { anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "error" });
    expect((await capturar(editarAcuerdoDePago(db, comoCloser(), { dealId: anulado.id, acuerdoPago: "x" }))).status).toBe(409);
  });
});

describe("el tope también rige donde nace la fecha: el motor y el alta del deal", () => {
  it("moverEtapa con una fecha pasada del inicio de clases se rechaza y no escribe nada", async () => {
    const d = await nuevoDeal("contactado");
    const e = await capturar(
      moverEtapa(db, { dealId: d.id, a: "compromiso_verbal", actor: { tipo: "usuario", userId: closer, rol: "closer" }, datos: {fechaLimitePago: "2026-10-16" } }),
    );
    expect(e.status).toBe(422);
    const [f] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(f).toMatchObject({ etapa: "contactado", fechaLimitePago: null });
  });

  it("con la fecha justo en el inicio de clases el movimiento pasa", async () => {
    const d = await nuevoDeal("contactado");
    await moverEtapa(db, { dealId: d.id, a: "compromiso_verbal", actor: { tipo: "usuario", userId: closer, rol: "closer" }, datos: {fechaLimitePago: "2026-10-15" } });
    const [f] = await db.select().from(deals).where(eq(deals.id, d.id));
    expect(f.etapa).toBe("compromiso_verbal");
  });

  it("abrirDeal en Compromiso Verbal con la fecha pasada del inicio de clases se rechaza", async () => {
    const [l] = await db.insert(leads).values({ programId, emailNormalizado: "nuevo@correo.co" }).returning();
    const e = await capturar(
      abrirDeal(db, { leadId: l.id, programId, etapa: "compromiso_verbal", actor: { tipo: "usuario", userId: closer, rol: "closer" }, cohortId, fechaLimitePago: "2026-10-20" }),
    );
    expect(e.status).toBe(422);
    expect(await db.select().from(deals).where(eq(deals.leadId, l.id))).toHaveLength(0);
  });
});
