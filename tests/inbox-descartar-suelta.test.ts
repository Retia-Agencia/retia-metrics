import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  calls,
  cohorts,
  deals,
  leads,
  miembrosPrograma,
  programs,
  users,
  changeLog,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Descartar una suelta (`descartarLlamadaSueltaAccion`): se ANULA con motivo y rastro; misma reja que colgarla. Ver tambien la accion de asignar: `asignarLlamadaSueltaAccion` (decisión K2: la suelta se
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

let vaciar: () => Promise<void>;
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

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  auth.mockReset();

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

afterAll(async () => {
  await cerrar();
});

async function llamada(id: string) {
  const [c] = await db.select().from(calls).where(and(eq(calls.id, id), incluyendoAnulados(calls)));
  return c;
}

describe("descartarLlamadaSueltaAccion", () => {
  it("la closer host la descarta: queda anulada con su nombre y motivo, con rastro", async () => {
    auth.mockResolvedValue(sesionCloserA);
    const { descartarLlamadaSueltaAccion } = await acciones();
    const r = await descartarLlamadaSueltaAccion({ callId: callSuelta, motivo: "cita de prueba" });
    expect(r.ok).toBe(true);
    const c = await llamada(callSuelta);
    expect(c.anuladoEn).not.toBeNull();
    expect(c.anuladoPor).toBe(closerDeA);
    expect(c.motivoAnulacion).toBe("cita de prueba");
    const rastro = await db.select().from(changeLog).where(eq(changeLog.registroId, callSuelta));
    expect(rastro.some((f) => f.campo === "motivoAnulacion")).toBe(true);
  });

  it("sin motivo de 5 letras se rechaza y la llamada sigue suelta", async () => {
    auth.mockResolvedValue(sesionCloserA);
    const { descartarLlamadaSueltaAccion } = await acciones();
    const r = await descartarLlamadaSueltaAccion({ callId: callSuelta, motivo: "no" });
    expect(r.ok).toBe(false);
    expect((await llamada(callSuelta)).anuladoEn).toBeNull();
  });

  it("un closer de OTRO programa recibe 404 y la llamada no se toca", async () => {
    auth.mockResolvedValue(sesionCloserB);
    const { descartarLlamadaSueltaAccion } = await acciones();
    const r = await descartarLlamadaSueltaAccion({ callId: callSuelta, motivo: "cita de prueba" });
    expect(r.ok).toBe(false);
    expect((await llamada(callSuelta)).anuladoEn).toBeNull();
  });

  it("una llamada que ya tiene deal no se descarta por aqui", async () => {
    await db.update(calls).set({ dealId: dealAbierto }).where(eq(calls.id, callSuelta));
    auth.mockResolvedValue(sesionCloserA);
    const { descartarLlamadaSueltaAccion } = await acciones();
    const r = await descartarLlamadaSueltaAccion({ callId: callSuelta, motivo: "cita de prueba" });
    expect(r.ok).toBe(false);
    expect((await llamada(callSuelta)).anuladoEn).toBeNull();
  });
});
