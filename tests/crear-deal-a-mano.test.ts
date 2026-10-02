import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, dealEtapaHistorial, deals, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 140 — crear un deal a mano. Se prueba por la server action real, invocada a mano
 * como la invoca un atacante (AGENTS.md: "un contrato que nadie mordio es una creencia"):
 *
 *  1. Sobre un lead sin deal abierto, el deal nace en la etapa de entrada, por el motor,
 *     con su fila de historial y su rastro en `change_log`.
 *  2. Sobre un lead con deal abierto, el rechazo trae el id del existente y la base no se
 *     mueve.
 *  3. Forjada contra un programa sin membresia, responde 404 y no escribe nada.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
let closerA: string;
let gerente: string;
let developer: string;
let leadN = 0;

const sesion = (id: string, rol: string, closerId: string | null) => ({ user: { id, email: `${id}@x.co`, rol, closerId } });
const acciones = () => import("@/app/(app)/p/[programa]/deals/acciones");

beforeEach(async () => {
  auth.mockReset();
  ({ db, cerrar } = await crearBaseDePrueba());
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "1000" }).returning();
  programaA = a.id;
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500" }).returning();
  programaB = b.id;
  const [c] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closerA = c.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [d] = await db.insert(users).values({ email: "dev@retiagrowth.com", rol: "developer", closerId: "Dev" }).returning();
  developer = d.id;
  // Maru vende solo en A. El developer no tiene ninguna membresia: no se le restringe nada.
  await db.insert(miembrosPrograma).values({ userId: closerA, programId: programaA, activo: true });
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function nuevoLead(programId: string) {
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: `lead${++leadN}@correo.co`, nombre: `Lead ${leadN}` }).returning();
  return l.id;
}

async function dealsDe(leadId: string) {
  return db.select().from(deals).where(and(eq(deals.leadId, leadId), incluyendoAnulados(deals)));
}

/** Una foto de todo lo que una escritura podria mover. */
async function foto() {
  const [d, l, h, c] = await Promise.all([
    db.select({ id: deals.id }).from(deals).where(incluyendoAnulados(deals)),
    db.select({ id: leads.id }).from(leads),
    db.select({ id: dealEtapaHistorial.id }).from(dealEtapaHistorial),
    db.select({ id: changeLog.id }).from(changeLog),
  ]);
  return { deals: d.length, leads: l.length, historial: h.length, changeLog: c.length };
}

describe("crear un deal sobre un lead sin deal abierto", () => {
  it("nace en En gestión (ADR 0071 punto 6), con el closer de dueño, su historial y su rastro", async () => {
    const leadId = await nuevoLead(programaA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: true, leadCreado: false });
    const dealId = (r as { dealId: string }).dealId;
    const [d] = await dealsDe(leadId);
    expect(d).toMatchObject({ id: dealId, etapa: "en_gestion", ownerUserId: closerA, creadoPor: closerA, programId: programaA });

    const historial = await db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
    expect(historial).toEqual([expect.objectContaining({ de: null, a: "en_gestion", userId: closerA })]);

    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, dealId)));
    expect(rastro.length).toBeGreaterThan(0);
    expect(rastro.every((f) => f.userId === closerA)).toBe(true);
  });

  it("el actor sale de la sesion: un `userId` u `ownerUserId` en el cuerpo se ignora", async () => {
    const leadId = await nuevoLead(programaA);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).crearDeal({
      programId: programaA,
      lead: { tipo: "existente", leadId },
      userId: gerente,
      ownerUserId: gerente,
      etapa: "ganado_parcial",
    } as never);

    expect(r).toMatchObject({ ok: true });
    const [d] = await dealsDe(leadId);
    expect(d.ownerUserId).toBe(closerA);
    expect(d.etapa).toBe("en_gestion");
  });

  // ADR 0071 punto 6: "con quien lo crea como dueño", y `abrirDeal` lo aplica a toda persona.
  // Con un gerente choca con el ADR 0003 (administra, no vende): duda abierta del ticket 140.
  it("un gerente lo crea y queda de dueño, como lo decide el motor", async () => {
    const leadId = await nuevoLead(programaB);
    auth.mockResolvedValue(sesion(gerente, "gerente", null));

    const r = await (await acciones()).crearDeal({ programId: programaB, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: true });
    const [d] = await dealsDe(leadId);
    expect(d.ownerUserId).toBe(gerente);
    expect(d.creadoPor).toBe(gerente);
  });

  it("el developer crea en un programa donde no tiene membresia, y queda de dueño", async () => {
    const leadId = await nuevoLead(programaB);
    auth.mockResolvedValue(sesion(developer, "developer", "Dev"));

    const r = await (await acciones()).crearDeal({ programId: programaB, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: true });
    const [d] = await dealsDe(leadId);
    expect(d.ownerUserId).toBe(developer);
  });

  it("con un lead nuevo, lo crea primero con el alta manual (entrada crm) y abre el deal sobre él", async () => {
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).crearDeal({
      programId: programaA,
      lead: { tipo: "nuevo", correo: "  Nuevo@Correo.co ", nombre: "Nuevo", telefono: "" },
    });

    expect(r).toMatchObject({ ok: true, leadCreado: true });
    const [l] = await db.select().from(leads).where(eq(leads.emailNormalizado, "nuevo@correo.co"));
    expect(l).toMatchObject({ programId: programaA, entrada: "crm", nombre: "Nuevo" });
    const [d] = await dealsDe(l.id);
    expect(d).toMatchObject({ etapa: "en_gestion", ownerUserId: closerA });
  });

  it("reaplicar tras un Cierre Perdido abre un deal nuevo: el cerrado no ocupa el cupo", async () => {
    const leadId = await nuevoLead(programaA);
    await db.insert(deals).values({ leadId, programId: programaA, etapa: "cierre_perdido" });
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: true });
    expect(await dealsDe(leadId)).toHaveLength(2);
  });
});

describe("sobre un lead con deal abierto", () => {
  it("el rechazo enlaza al deal existente y la base no se mueve", async () => {
    const leadId = await nuevoLead(programaA);
    const [abierto] = await db
      .insert(deals)
      .values({ leadId, programId: programaA, etapa: "agendado", ownerUserId: closerA })
      .returning();
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const antes = await foto();

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: false, status: 409, dealExistenteId: abierto.id });
    expect((r as { error: string }).error).toMatch(/ya tiene un deal abierto/);
    expect(await foto()).toEqual(antes);
  });

  it("tambien si el lead llega por correo en el alta manual: el dedup lo encuentra y enlaza su deal", async () => {
    const leadId = await nuevoLead(programaA);
    const [abierto] = await db.insert(deals).values({ leadId, programId: programaA, etapa: "en_gestion" }).returning();
    const [l] = await db.select().from(leads).where(eq(leads.id, leadId));
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const antes = await foto();

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "nuevo", correo: l.emailNormalizado } });

    expect(r).toMatchObject({ ok: false, dealExistenteId: abierto.id });
    expect(await foto()).toEqual(antes);
  });

  it("un deal anulado no ocupa el cupo (ADR 0038): se crea el correcto", async () => {
    const leadId = await nuevoLead(programaA);
    await db.insert(deals).values({
      leadId,
      programId: programaA,
      etapa: "en_gestion",
      anuladoEn: new Date(),
      anuladoPor: closerA,
      motivoAnulacion: "lead equivocado",
    });
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: true });
  });
});

describe("forjada contra un programa sin membresia", () => {
  it("con un lead existente del programa ajeno responde 404 y no escribe", async () => {
    const leadId = await nuevoLead(programaB);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const antes = await foto();

    const r = await (await acciones()).crearDeal({ programId: programaB, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(await foto()).toEqual(antes);
  });

  it("con un lead nuevo tampoco crea el lead", async () => {
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const antes = await foto();

    const r = await (await acciones()).crearDeal({ programId: programaB, lead: { tipo: "nuevo", correo: "colado@correo.co" } });

    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(await foto()).toEqual(antes);
  });

  it("mezclar el programa propio con un lead del ajeno tambien es 404: el programa es frontera", async () => {
    const leadAjeno = await nuevoLead(programaB);
    auth.mockResolvedValue(sesion(closerA, "closer", "Maru"));
    const antes = await foto();

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "existente", leadId: leadAjeno } });

    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(await foto()).toEqual(antes);
  });

  it("sin sesion no entra", async () => {
    const leadId = await nuevoLead(programaA);
    auth.mockResolvedValue(null);
    const antes = await foto();

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "existente", leadId } });

    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(await foto()).toEqual(antes);
  });

  it("un gerente no crea leads (ADR 0003): 403 y nada escrito", async () => {
    auth.mockResolvedValue(sesion(gerente, "gerente", null));
    const antes = await foto();

    const r = await (await acciones()).crearDeal({ programId: programaA, lead: { tipo: "nuevo", correo: "x@correo.co" } });

    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(await foto()).toEqual(antes);
  });
});
