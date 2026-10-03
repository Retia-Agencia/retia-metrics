import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
  cohorts,
  deals,
  leads,
  miembrosPrograma,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 071 — la server action `asignarLlamadaSueltaAccion` (decisión K2: la suelta se
 * asigna desde el Inbox). El actor SIEMPRE sale de la sesión; la reja de permisos vive en
 * `asignarLlamadaSuelta`. Aquí se prueba el caso que importa: un closer de OTRO programa,
 * que no ve el programa de la llamada, recibe un 404 (un programa ajeno responde como si no
 * existiera, ADR 0048) y la llamada NO se cuelga de ningún deal.
 *
 * `auth` y `next/headers` se mockean como en `tests/acciones-mi-dia.test.ts`; la base es
 * PGlite inyectada por el mock de `@/lib/db`.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

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
let closerDeA: string;
let closerDeB: string;
let callSuelta: string;
let dealAbierto: string;

const sesionCloserA = { user: { id: "", email: "ana@retiagrowth.com", rol: "closer", closerId: "Ana" } };
const sesionCloserB = { user: { id: "", email: "beto@retiagrowth.com", rol: "closer", closerId: "Beto" } };

async function acciones() {
  return import("@/app/(app)/p/[programa]/inbox/acciones");
}

beforeEach(async () => {
  auth.mockReset();
  ({ db, cerrar } = await crearBaseDePrueba());

  const [pa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "1000" }).returning();
  programaA = pa.id;
  const [pb] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "800" }).returning();
  programaB = pb.id;

  const [a] = await db.insert(users).values({ email: "ana@retiagrowth.com", rol: "closer", closerId: "Ana", nombre: "Ana" }).returning();
  closerDeA = a.id;
  sesionCloserA.user.id = closerDeA;
  const [b] = await db.insert(users).values({ email: "beto@retiagrowth.com", rol: "closer", closerId: "Beto", nombre: "Beto" }).returning();
  closerDeB = b.id;
  sesionCloserB.user.id = closerDeB;

  // Cada closer es miembro de SU programa, no del otro.
  await db.insert(miembrosPrograma).values([
    // Ana hospeda la cita en su Calendly (ADR 0076: una suelta la cuelga su host).
    { userId: closerDeA, programId: programaA, calendlyEmail: "ana@calendly.co" },
    { userId: closerDeB, programId: programaB },
  ]);

  const [cohorteA] = await db
    .insert(cohorts)
    .values({
      programId: programaA,
      codigo: "CA",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-11-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-10-30",
      estado: "activo",
    })
    .returning();

  // Un lead con deal abierto en el programa A.
  const [lead] = await db.insert(leads).values({ programId: programaA, emailNormalizado: "lead@correo.co", nombre: "Lead" }).returning();
  const [deal] = await db
    .insert(deals)
    .values({ leadId: lead.id, programId: programaA, cohortId: cohorteA.id, etapa: "agendado", ownerUserId: closerDeA,})
    .returning();
  dealAbierto = deal.id;

  // Una llamada suelta (sin deal) del programa A.
  const [call] = await db
    .insert(calls)
    .values({ programId: programaA, resultado: "agendada", emailLead: "lead@correo.co", origen: "calendly", huellaFila: "calendly:uuid-1", calendlyHostEmail: "ana@calendly.co" })
    .returning();
  callSuelta = call.id;
});

afterEach(async () => {
  await cerrar();
});

async function llamada(id: string) {
  const [c] = await db.select().from(calls).where(and(eq(calls.id, id), incluyendoAnulados(calls)));
  return c;
}

describe("asignarLlamadaSueltaAccion", () => {
  it("la closer HOST la asigna: la llamada queda colgada del deal", async () => {
    auth.mockResolvedValue(sesionCloserA);
    const { asignarLlamadaSueltaAccion } = await acciones();
    const r = await asignarLlamadaSueltaAccion({ callId: callSuelta, dealId: dealAbierto });
    expect(r.ok).toBe(true);
    expect((await llamada(callSuelta)).dealId).toBe(dealAbierto);
  });

  it("un closer del mismo programa que NO es el host es rechazado (403) y la base no se mueve (ADR 0076)", async () => {
    const [carla] = await db.insert(users).values({ email: "carla@retiagrowth.com", rol: "closer", closerId: "Carla", nombre: "Carla" }).returning();
    await db.insert(miembrosPrograma).values({ userId: carla.id, programId: programaA, calendlyEmail: "carla@calendly.co" });
    auth.mockResolvedValue({ user: { id: carla.id, email: "carla@retiagrowth.com", rol: "closer", closerId: "Carla" } });
    const { asignarLlamadaSueltaAccion } = await acciones();
    const r = await asignarLlamadaSueltaAccion({ callId: callSuelta, dealId: dealAbierto });
    expect(r.ok).toBe(false);
    expect((await llamada(callSuelta)).dealId).toBeNull();
    expect((await db.select().from(deals).where(eq(deals.id, dealAbierto)))[0].ownerUserId).toBe(closerDeA);
  });

  it("un closer de OTRO programa es rechazado (404) y la llamada NO se cuelga", async () => {
    auth.mockResolvedValue(sesionCloserB);
    const { asignarLlamadaSueltaAccion } = await acciones();
    const r = await asignarLlamadaSueltaAccion({ callId: callSuelta, dealId: dealAbierto });
    expect(r.ok).toBe(false);
    expect((await llamada(callSuelta)).dealId).toBeNull();
  });

  it("sin sesión no pasa nada (el guard de rol corta antes de tocar la base)", async () => {
    auth.mockResolvedValue(null);
    const { asignarLlamadaSueltaAccion } = await acciones();
    // `requireRole` lanza AuthenticationError fuera del try de `correr`: la promesa rechaza.
    await expect(asignarLlamadaSueltaAccion({ callId: callSuelta, dealId: dealAbierto })).rejects.toThrow();
    expect((await llamada(callSuelta)).dealId).toBeNull();
  });

  it("una llamada de la hoja sin deal no se asigna ni forjando la petición: 404 y no se cuelga (078)", async () => {
    const [deLaHoja] = await db
      .insert(calls)
      .values({ programId: programaA, resultado: "show", emailLead: "lead@correo.co", origen: "sheets", huellaFila: "sheets:a:Registro:1" })
      .returning();
    auth.mockResolvedValue(sesionCloserA);
    const { asignarLlamadaSueltaAccion } = await acciones();
    const r = await asignarLlamadaSueltaAccion({ callId: deLaHoja.id, dealId: dealAbierto });
    expect(r.ok).toBe(false);
    expect((await llamada(deLaHoja.id)).dealId).toBeNull();
  });
});
