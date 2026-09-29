import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, cohorts, dealActividades, deals, leads, productos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { cambiarCohorte, desmarcarOnboarded, marcarOnboarded } from "@/lib/deals/estudiante";
import { ErrorDeApp } from "@/lib/errors";
import { estudiantesDe } from "@/lib/queries/estudiantes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 063: el onboarding es un timestamp que marca el closer dueño o quien administra, y
 * el cambio de cohorte de un estudiante lleva quién y por qué. Students es una consulta.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let agosto: string;
let septiembre: string;
let octubre: string;
let productoId: string;
let closer: string;
let otroCloser: string;
let gerente: string;
let developer: string;
let leadN = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const base = { programId, metaCupos: 10, precioUsd: "1000" };
  const [a] = await db
    .insert(cohorts)
    .values({ ...base, codigo: "Agosto", fechaInicioClases: "2026-08-15", fechaInicioVentas: "2026-07-01", fechaCierreVentas: "2026-08-10", estado: "cerrado" })
    .returning();
  agosto = a.id;
  const [s] = await db
    .insert(cohorts)
    .values({ ...base, codigo: "Septiembre", fechaInicioClases: "2026-09-15", fechaInicioVentas: "2026-08-11", fechaCierreVentas: "2026-09-10", estado: "activo" })
    .returning();
  septiembre = s.id;
  const [o] = await db
    .insert(cohorts)
    .values({ ...base, codigo: "Octubre", fechaInicioClases: "2026-10-15", fechaCierreVentas: "2026-10-10", estado: "futuro" })
    .returning();
  octubre = o.id;
  const [prod] = await db.insert(productos).values({ programId, nombre: "Programa", precioLista: "1000" }).returning();
  productoId = prod.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
  const [u2] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer", closerId: "Jero" }).returning();
  otroCloser = u2.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [d] = await db.insert(users).values({ email: "dev@retiagrowth.com", rol: "developer" }).returning();
  developer = d.id;
});

afterEach(async () => {
  await cerrar();
});

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}, programa = programId) {
  const [l] = await db.insert(leads).values({ programId: programa, emailNormalizado: `l${++leadN}@correo.co`, nombre: `Lead ${leadN}` }).returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId: programa, cohortId: septiembre, etapa, ownerUserId: closer, productoId, ...extra })
    .returning();
  return d.id;
}

async function fila(dealId: string) {
  const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
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

describe("marcarOnboarded", () => {
  it("el closer dueño lo marca en un Abonado y en un Completo, con timestamp y rastro", async () => {
    for (const etapa of ["abonado", "completo"] as const) {
      const dealId = await nuevoDeal(etapa);
      const antes = Date.now();
      const { onboardedAt } = await marcarOnboarded(db, comoCloser(), { dealId });
      expect(onboardedAt.getTime()).toBeGreaterThanOrEqual(antes - 1000);
      expect((await fila(dealId)).onboardedAt).not.toBeNull();
      const rastro = await db.select().from(changeLog).where(and(eq(changeLog.registroId, dealId), eq(changeLog.campo, "onboardedAt")));
      expect(rastro).toHaveLength(1);
      expect(rastro[0].userId).toBe(closer);
    }
  });

  it("el gerente y el developer también pueden, sin ser dueños", async () => {
    const a = await nuevoDeal("abonado");
    const b = await nuevoDeal("completo");
    await marcarOnboarded(db, { userId: gerente, rol: "gerente" }, { dealId: a });
    await marcarOnboarded(db, { userId: developer, rol: "developer" }, { dealId: b });
    expect((await fila(a)).onboardedAt).not.toBeNull();
    expect((await fila(b)).onboardedAt).not.toBeNull();
  });

  it("otro closer no; marcar dos veces no pisa la fecha original", async () => {
    const dealId = await nuevoDeal("abonado");
    expect((await capturar(marcarOnboarded(db, { userId: otroCloser, rol: "closer" }, { dealId }))).status).toBe(403);
    expect((await fila(dealId)).onboardedAt).toBeNull();

    await marcarOnboarded(db, comoCloser(), { dealId });
    const primera = (await fila(dealId)).onboardedAt!;
    expect((await capturar(marcarOnboarded(db, comoCloser(), { dealId }))).status).toBe(409);
    expect((await fila(dealId)).onboardedAt!.getTime()).toBe(primera.getTime());
  });

  it("solo un estudiante: un deal en Atendido, perdido o anulado se rechaza", async () => {
    for (const etapa of ["atendido", "compromiso_verbal", "cierre_perdido"] as const) {
      expect((await capturar(marcarOnboarded(db, comoCloser(), { dealId: await nuevoDeal(etapa) }))).status).toBe(409);
    }
    const anulado = await nuevoDeal("abonado", { anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "error" });
    expect((await capturar(marcarOnboarded(db, comoCloser(), { dealId: anulado }))).status).toBe(409);
  });
});

describe("desmarcarOnboarded", () => {
  it("borra la marca con su rastro (valor anterior y quién) y se puede volver a marcar", async () => {
    const dealId = await nuevoDeal("abonado");
    await marcarOnboarded(db, comoCloser(), { dealId });
    await desmarcarOnboarded(db, comoCloser(), { dealId });
    expect((await fila(dealId)).onboardedAt).toBeNull();
    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.registroId, dealId), eq(changeLog.campo, "onboardedAt")))
      .orderBy(changeLog.detectadoEn);
    expect(rastro).toHaveLength(2);
    expect(rastro[1]).toMatchObject({ valorNuevo: null, userId: closer });
    expect(rastro[1].valorAnterior).not.toBeNull();
    await marcarOnboarded(db, comoCloser(), { dealId });
    expect((await fila(dealId)).onboardedAt).not.toBeNull();
  });

  it("lo hacen el gerente y el developer; otro closer no; sin marca es 409", async () => {
    const dealId = await nuevoDeal("completo");
    expect((await capturar(desmarcarOnboarded(db, comoCloser(), { dealId }))).status).toBe(409);
    await marcarOnboarded(db, comoCloser(), { dealId });
    expect((await capturar(desmarcarOnboarded(db, { userId: otroCloser, rol: "closer" }, { dealId }))).status).toBe(403);
    await desmarcarOnboarded(db, { userId: gerente, rol: "gerente" }, { dealId });
    expect((await fila(dealId)).onboardedAt).toBeNull();
    await marcarOnboarded(db, comoCloser(), { dealId });
    await desmarcarOnboarded(db, { userId: developer, rol: "developer" }, { dealId });
    expect((await fila(dealId)).onboardedAt).toBeNull();
  });

  it("se puede quitar aunque el deal ya no sea estudiante (una anulación lo sacó de Abonado)", async () => {
    const dealId = await nuevoDeal("abonado", { onboardedAt: new Date() });
    await db.update(deals).set({ etapa: "atendido" }).where(eq(deals.id, dealId));
    await desmarcarOnboarded(db, comoCloser(), { dealId });
    expect((await fila(dealId)).onboardedAt).toBeNull();
    // Y un deal anulado no se toca.
    const anulado = await nuevoDeal("abonado", { onboardedAt: new Date(), anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "error" });
    expect((await capturar(desmarcarOnboarded(db, comoCloser(), { dealId: anulado }))).status).toBe(409);
  });
});

describe("cambiarCohorte", () => {
  it("mueve al estudiante con quién y por qué, y la venta cuenta donde asiste", async () => {
    const dealId = await nuevoDeal("completo", { cohortId: agosto });
    await cambiarCohorte(db, comoCloser(), { dealId, cohortId: septiembre, motivo: "No pudo empezar en agosto" });

    expect((await fila(dealId)).cohortId).toBe(septiembre);
    const cambio = await db.select().from(changeLog).where(and(eq(changeLog.registroId, dealId), eq(changeLog.campo, "cohortId")));
    expect(cambio).toHaveLength(1);
    expect(cambio[0]).toMatchObject({ valorAnterior: agosto, valorNuevo: septiembre, userId: closer });
    const [nota] = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
    expect(nota).toMatchObject({ tipo: "nota", userId: closer });
    expect(nota.nota).toContain("Agosto → Septiembre");
    expect(nota.nota).toContain("No pudo empezar en agosto");

    // Students es una consulta: cada cohorte lista a quien le da clase.
    expect((await estudiantesDe(db, programId, { cohortId: septiembre })).map((e) => e.dealId)).toEqual([dealId]);
    expect(await estudiantesDe(db, programId, { cohortId: agosto })).toHaveLength(0);
  });

  it("el motivo es obligatorio", async () => {
    const dealId = await nuevoDeal("abonado");
    expect((await capturar(cambiarCohorte(db, comoCloser(), { dealId, cohortId: octubre, motivo: "   " }))).status).toBe(400);
    expect((await fila(dealId)).cohortId).toBe(septiembre);
  });

  it("solo a cohortes futuras o activas, del mismo programa y distintas de la actual", async () => {
    const dealId = await nuevoDeal("abonado");
    expect((await capturar(cambiarCohorte(db, comoCloser(), { dealId, cohortId: agosto, motivo: "x" }))).status).toBe(422);
    expect((await capturar(cambiarCohorte(db, comoCloser(), { dealId, cohortId: septiembre, motivo: "x" }))).status).toBe(422);
    const [otroProg] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const [ajena] = await db
      .insert(cohorts)
      .values({ programId: otroProg.id, codigo: "Q1", metaCupos: 10, precioUsd: "1500", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-25", estado: "futuro" })
      .returning();
    expect((await capturar(cambiarCohorte(db, comoCloser(), { dealId, cohortId: ajena.id, motivo: "x" }))).status).toBe(422);
    expect((await fila(dealId)).cohortId).toBe(septiembre);
    expect(await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId))).toHaveLength(0);
  });

  it("solo un estudiante, y solo el dueño o un administrador", async () => {
    const enContacto = await nuevoDeal("atendido");
    expect((await capturar(cambiarCohorte(db, comoCloser(), { dealId: enContacto, cohortId: octubre, motivo: "x" }))).status).toBe(409);
    const dealId = await nuevoDeal("abonado");
    expect((await capturar(cambiarCohorte(db, { userId: otroCloser, rol: "closer" }, { dealId, cohortId: octubre, motivo: "x" }))).status).toBe(403);
    await cambiarCohorte(db, { userId: gerente, rol: "gerente" }, { dealId, cohortId: octubre, motivo: "Lo pidió el estudiante" });
    expect((await fila(dealId)).cohortId).toBe(octubre);
  });

  it("si la fecha límite de pago pasa del inicio de clases de la cohorte nueva, se baja a ese inicio", async () => {
    const dealId = await nuevoDeal("abonado", { cohortId: octubre, fechaLimitePago: "2026-10-15" });
    const r = await cambiarCohorte(db, comoCloser(), { dealId, cohortId: septiembre, motivo: "Adelanta su inicio" });
    expect(r.fechaLimiteAjustada).toBe("2026-09-15");
    expect((await fila(dealId)).fechaLimitePago).toBe("2026-09-15");
    const [nota] = await db.select().from(dealActividades).where(eq(dealActividades.dealId, dealId));
    expect(nota.nota).toContain("2026-10-15");
    expect(nota.nota).toContain("2026-09-15");
  });

  it("una fecha límite que sí cabe no se toca", async () => {
    const dealId = await nuevoDeal("abonado", { cohortId: septiembre, fechaLimitePago: "2026-09-01" });
    const r = await cambiarCohorte(db, comoCloser(), { dealId, cohortId: octubre, motivo: "Prefiere octubre" });
    expect(r.fechaLimiteAjustada).toBeNull();
    expect((await fila(dealId)).fechaLimitePago).toBe("2026-09-01");
  });
});

describe("estudiantesDe: Students es una consulta sobre la etapa", () => {
  it("solo Abonado y Completo vigentes, de UN programa", async () => {
    const abonado = await nuevoDeal("abonado");
    const completo = await nuevoDeal("completo");
    await nuevoDeal("atendido");
    await nuevoDeal("cierre_perdido");
    await nuevoDeal("abonado", { anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "error" });
    const [otroProg] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    await nuevoDeal("abonado", { cohortId: null, productoId: null }, otroProg.id);

    const lista = await estudiantesDe(db, programId);
    expect(lista.map((e) => e.dealId).sort()).toEqual([abonado, completo].sort());
    expect(lista.every((e) => e.codigoCohorte === "Septiembre")).toBe(true);
  });

  it("una cohorte de otro programa no devuelve a nadie del programa pedido", async () => {
    await nuevoDeal("abonado");
    const [otroProg] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const [ajena] = await db
      .insert(cohorts)
      .values({ programId: otroProg.id, codigo: "Q1", metaCupos: 10, precioUsd: "1500", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-25", estado: "futuro" })
      .returning();
    expect(await estudiantesDe(db, programId, { cohortId: ajena.id })).toHaveLength(0);
  });

  it("refleja el onboarding", async () => {
    const dealId = await nuevoDeal("abonado");
    await marcarOnboarded(db, comoCloser(), { dealId });
    const [e] = await estudiantesDe(db, programId);
    expect(e.onboardedAt).not.toBeNull();
  });
});
