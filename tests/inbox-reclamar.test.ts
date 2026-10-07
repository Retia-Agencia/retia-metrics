import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, cohorts, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { reclamarDeal } from "@/lib/deals/reclamar";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 070, parte B: `reclamarDeal`. El closer que ve el lead primero lo toma; el nuevo
 * dueño es SIEMPRE el actor de la sesión, nunca el input. Un `id` de dueño metido en el
 * cuerpo se ignora porque ni se lee. El gerente no puede (no trabaja leads); el developer sí.
 * Dos reclamos simultáneos: el segundo pierde con 409.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let leadN = 0;
let closer: string;
let otroCloser: string;
let gerente: string;
let developer: string;

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
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
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
  const [d] = await db.insert(users).values({ email: "dev@retiagrowth.com", rol: "developer" }).returning();
  developer = d.id;
  await db.insert(miembrosPrograma).values([
    { userId: closer, programId },
    { userId: otroCloser, programId },
  ]);
}, 60_000);

afterEach(async () => {
  await cerrar();
});

const comoCloser = () => ({ userId: closer, rol: "closer" as const });
const comoOtroCloser = () => ({ userId: otroCloser, rol: "closer" as const });
const comoGerente = () => ({ userId: gerente, rol: "gerente" as const });
const comoDeveloper = () => ({ userId: developer, rol: "developer" as const });

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: `lead${++leadN}@correo.co`, nombre: `Lead ${leadN}` })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId, cohortId, etapa, ownerUserId: null,...extra })
    .returning();
  return d.id;
}

async function deal(dealId: string) {
  const [d] = await db.select().from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  return d;
}

async function rastro(dealId: string) {
  return db.select().from(changeLog).where(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, dealId)));
}

async function capturar(p: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await p;
  } catch (e) {
    return e as ErrorDeApp;
  }
  throw new Error("se esperaba un error");
}

describe("reclamarDeal", () => {
  it("un closer con membresía reclama y queda como dueño con novedad", async () => {
    const dealId = await nuevoDeal("registrado");
    await reclamarDeal(db, comoCloser(), { dealId });

    expect(await deal(dealId)).toMatchObject({ ownerUserId: closer });
    expect((await deal(dealId)).ownerNovedadEn).toBeInstanceOf(Date);
    const filas = await rastro(dealId);
    expect(filas).toHaveLength(2);
    expect(filas).toContainEqual(expect.objectContaining({ campo: "ownerUserId", valorAnterior: null, valorNuevo: closer, userId: closer }));
    expect(filas).toContainEqual(expect.objectContaining({ campo: "ownerNovedadEn", valorAnterior: null, userId: closer }));
  });

  it("el developer también puede reclamar (nunca rol === '...' a mano)", async () => {
    const dealId = await nuevoDeal("registrado");
    await reclamarDeal(db, comoDeveloper(), { dealId });
    expect((await deal(dealId)).ownerUserId).toBe(developer);
  });

  it("el gerente NO puede reclamar: administra pero no trabaja leads (ADR 0003)", async () => {
    const dealId = await nuevoDeal("registrado");
    const e = await capturar(reclamarDeal(db, comoGerente(), { dealId }));
    expect(e.status).toBe(403);
    expect((await deal(dealId)).ownerUserId).toBeNull();
    expect(await rastro(dealId)).toHaveLength(0);
  });

  it("un closer SIN membresía activa en el programa no puede reclamar", async () => {
    const dealId = await nuevoDeal("registrado");
    await db.update(miembrosPrograma).set({ activo: false }).where(eq(miembrosPrograma.userId, closer));
    const e = await capturar(reclamarDeal(db, comoCloser(), { dealId }));
    expect(e.status).toBe(403);
    expect((await deal(dealId)).ownerUserId).toBeNull();

    // Un closer de OTRO programa (sin ninguna membresía en éste) tampoco.
    const [ajeno] = await db.insert(users).values({ email: "otro@retiagrowth.com", rol: "closer", closerId: "Otro" }).returning();
    const e2 = await capturar(reclamarDeal(db, { userId: ajeno.id, rol: "closer" }, { dealId }));
    expect(e2.status).toBe(403);
    expect((await deal(dealId)).ownerUserId).toBeNull();
  });

  it("el dueño sale de la SESIÓN: un ownerUserId ajeno en el cuerpo se ignora (ni se lee)", async () => {
    const dealId = await nuevoDeal("registrado");
    // El esquema no tiene `ownerUserId`: aunque se cuele, el nuevo dueño es el actor.
    await reclamarDeal(db, comoCloser(), { dealId, ownerUserId: otroCloser } as never);
    expect((await deal(dealId)).ownerUserId).toBe(closer);
  });

  it("un segundo reclamo sobre un deal que YA tiene dueño se rechaza con 409 'Ya lo reclamó otra persona'", async () => {
    const dealId = await nuevoDeal("registrado");
    await reclamarDeal(db, comoCloser(), { dealId });
    const e = await capturar(reclamarDeal(db, comoOtroCloser(), { dealId }));
    expect(e.status).toBe(409);
    expect(e.message).toMatch(/Ya lo reclamó otra persona/);
    // No se movió: sigue siendo del primero, y no hay una segunda fila de rastro del dueño.
    expect((await deal(dealId)).ownerUserId).toBe(closer);
    expect(await rastro(dealId)).toHaveLength(2);
  });

  it("un deal anulado no se reclama", async () => {
    const dealId = await nuevoDeal("registrado", {
      anuladoEn: new Date(),
      anuladoPor: gerente,
      motivoAnulacion: "lo registré mal",
    });
    const e = await capturar(reclamarDeal(db, comoCloser(), { dealId }));
    expect(e.status).toBe(409);
    expect((await deal(dealId)).ownerUserId).toBeNull();
  });

  it("un deal inexistente da 404", async () => {
    const e = await capturar(reclamarDeal(db, comoCloser(), { dealId: "00000000-0000-0000-0000-000000000000" }));
    expect(e.status).toBe(404);
  });

  it("se puede reclamar un Agendado sin dueño (Unclaimed), no solo un Pendiente Setteo", async () => {
    const dealId = await nuevoDeal("agendado");
    await reclamarDeal(db, comoCloser(), { dealId });
    expect((await deal(dealId)).ownerUserId).toBe(closer);
  });
});
