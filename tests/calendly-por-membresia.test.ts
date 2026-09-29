import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { calls, leads, miembrosPrograma, programs, users, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionCheck, esViolacionUnica } from "@/lib/db/errores";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Migración 0038 (ticket 096, ADR 0049, A5): la cuenta de Calendly vive en la membresía
 * (closer × programa), la llamada suelta es la única sin deal, y el programa guarda la clave
 * con la que Calendly firma su webhook. Las garantías viven en la base (ADR 0005), y cada una
 * se prueba en los dos sentidos: rechaza lo malo y deja pasar lo bueno.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let maru: string;
let jero: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [q] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
  otroProgramId = q.id;
  const [a] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  maru = a.id;
  const [b] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer", closerId: "Jero" }).returning();
  jero = b.id;
});

afterEach(async () => {
  await cerrar();
});

async function capturar(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("se esperaba un error");
}

describe("miembros_programa.calendly_email: una cuenta, un closer por programa", () => {
  it("dos closers no pueden reclamar la misma cuenta en un programa, aunque cambien mayúsculas", async () => {
    await db.insert(miembrosPrograma).values({ userId: maru, programId, calendlyEmail: "maru.calendly@gmail.com" });
    const e = await capturar(db.insert(miembrosPrograma).values({ userId: jero, programId, calendlyEmail: "MARU.Calendly@gmail.com" }));
    expect(esViolacionUnica(e)).toBe(true);
  });

  it("la misma cuenta SÍ puede estar en dos programas distintos", async () => {
    await db.insert(miembrosPrograma).values({ userId: maru, programId, calendlyEmail: "maru.calendly@gmail.com" });
    await db.insert(miembrosPrograma).values({ userId: maru, programId: otroProgramId, calendlyEmail: "maru.calendly@gmail.com" });
    expect(await db.select().from(miembrosPrograma)).toHaveLength(2);
  });

  it("varios closers sin cuenta configurada (nulos) no chocan entre sí", async () => {
    await db.insert(miembrosPrograma).values({ userId: maru, programId });
    await db.insert(miembrosPrograma).values({ userId: jero, programId });
    expect(await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.programId, programId))).toHaveLength(2);
  });
});

describe("calls: la llamada del CRM siempre tiene deal; la suelta de Calendly no", () => {
  const base = () => ({ programId, resultado: "agendada" as const });

  it("una llamada de Calendly sin deal (suelta) entra, con el host", async () => {
    const [c] = await db
      .insert(calls)
      .values({ ...base(), origen: "calendly", huellaFila: "calendly:abc", calendlyHostEmail: "maru.calendly@gmail.com" })
      .returning();
    expect(c.dealId).toBeNull();
    expect(c.calendlyHostEmail).toBe("maru.calendly@gmail.com");
  });

  it("una llamada NATIVA del CRM sin deal se rechaza: la base lo garantiza, no solo agregarLlamada", async () => {
    const e = await capturar(db.insert(calls).values({ ...base(), origen: "crm" }));
    expect(esViolacionCheck(e)).toBe(true);
  });

  it("la historia de la hoja sin deal todavía entra (la migración E7 decide qué hacer con ella)", async () => {
    const [c] = await db.insert(calls).values({ ...base(), origen: "sheets" }).returning();
    expect(c.dealId).toBeNull();
  });

  it("una llamada con deal entra con cualquier origen", async () => {
    const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co" }).returning();
    const [d] = await db.insert(deals).values({ leadId: l.id, programId, etapa: "agendado" }).returning();
    for (const origen of ["sheets", "crm", "calendly"]) {
      await db.insert(calls).values({ ...base(), origen, dealId: d.id });
    }
    expect(await db.select().from(calls).where(eq(calls.dealId, d.id))).toHaveLength(3);
  });

  it("asignar una suelta a un deal sigue permitido", async () => {
    const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co" }).returning();
    const [d] = await db.insert(deals).values({ leadId: l.id, programId, etapa: "agendado" }).returning();
    const [c] = await db.insert(calls).values({ ...base(), origen: "calendly", huellaFila: "calendly:xyz" }).returning();
    await db.update(calls).set({ dealId: d.id }).where(eq(calls.id, c.id));
    expect((await db.select().from(calls).where(eq(calls.id, c.id)))[0].dealId).toBe(d.id);
  });
});

describe("programs.calendly_signing_key", () => {
  it("nace nula y se puede escribir", async () => {
    const [antes] = await db.select({ k: programs.calendlySigningKey }).from(programs).where(eq(programs.id, programId));
    expect(antes.k).toBeNull();
    await db.update(programs).set({ calendlySigningKey: "clave-de-prueba" }).where(eq(programs.id, programId));
    const [despues] = await db.select({ k: programs.calendlySigningKey }).from(programs).where(eq(programs.id, programId));
    expect(despues.k).toBe("clave-de-prueba");
  });
});
