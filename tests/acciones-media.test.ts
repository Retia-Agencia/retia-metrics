import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, creadores, piezas, programs, usuariosProgramasAlcance, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Tickets 316 y 317: las server actions de media se muerden forjando la peticion. La barrera de
 * rol y el alcance son de servidor; el programa de una pieza sale de su creador y el actor, de la
 * sesion, nunca del input. `auth` esta mockeado y la base PGlite se inyecta.
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
let vaciar: () => Promise<void>;
let programA: string;
let programB: string;
let ids: Record<"media" | "acotado" | "closer" | "paid", string>;

const sesion = (rol: string, id: string) => ({ user: { id, email: `${rol}@retia.co`, rol, closerId: null } });

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  auth.mockReset();
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "a", nombre: "A", ticketUsd: "797" }).returning();
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "b", nombre: "B", ticketUsd: "1500" }).returning();
  programA = a.id;
  programB = b.id;
  const [m, ac, c, p] = await db
    .insert(users)
    .values([
      { email: "media@retia.co", rol: "media", nombre: "Media" },
      { email: "acotado@retia.co", rol: "media", nombre: "Acotado" },
      { email: "closer@retia.co", rol: "closer", nombre: "Closer" },
      { email: "paid@retia.co", rol: "paid_trafficker", nombre: "Paid" },
    ])
    .returning();
  ids = { media: m.id, acotado: ac.id, closer: c.id, paid: p.id };
  await db.insert(usuariosProgramasAlcance).values({ userId: ac.id, programId: programB });
});

async function acciones() {
  return import("@/app/(app)/media/acciones");
}

describe("las acciones de media", () => {
  it("un closer y un paid trafficker reciben ok:false y la base no se mueve", async () => {
    const a = await acciones();
    for (const [rol, id] of [["closer", ids.closer], ["paid_trafficker", ids.paid]] as const) {
      auth.mockResolvedValue(sesion(rol, id));
      const r1 = await a.crearCreadorAccion({ nombre: "X", slug: "x", programId: programA });
      const r2 = await a.crearTipoDePiezaAccion("Reel");
      expect(r1.ok).toBe(false);
      expect(r2.ok).toBe(false);
    }
    expect(await db.select().from(creadores)).toEqual([]);
    expect(await db.select().from(changeLog)).toEqual([]);
  });

  it("media crea creador, tipo y pieza; el programa sale del creador aunque el input traiga otro", async () => {
    const a = await acciones();
    auth.mockResolvedValue(sesion("media", ids.media));
    expect(await a.crearCreadorAccion({ nombre: "Ana", slug: "ana", programId: programA })).toEqual({ ok: true });
    expect(await a.crearTipoDePiezaAccion("Reel")).toEqual({ ok: true });
    const [creador] = await db.select().from(creadores);
    const [tipo] = await db.select({ id: (await import("@/lib/db/schema")).tiposPieza.id }).from((await import("@/lib/db/schema")).tiposPieza);
    const forjado = { creadorId: creador.id, tipoId: tipo.id, red: "instagram", fechaPublicacion: "2026-10-30", programId: programB, creadaPor: ids.closer } as never;
    expect(await a.crearPiezaAccion(forjado)).toEqual({ ok: true });
    const [pieza] = await db.select().from(piezas);
    expect(pieza.programId).toBe(programA);
    expect(pieza.creadaPor).toBe(ids.media);
  });

  it("media acotado a B no toca nada de A ni de un creador sin programa", async () => {
    const a = await acciones();
    auth.mockResolvedValue(sesion("media", ids.media));
    await a.crearCreadorAccion({ nombre: "Ana", slug: "ana", programId: programA });
    await a.crearTipoDePiezaAccion("Reel");
    const [creador] = await db.select().from(creadores);
    const [{ id: tipoId }] = await db.select({ id: (await import("@/lib/db/schema")).tiposPieza.id }).from((await import("@/lib/db/schema")).tiposPieza);

    auth.mockResolvedValue(sesion("media", ids.acotado));
    const r = await a.crearPiezaAccion({ creadorId: creador.id, tipoId, red: "instagram", fechaPublicacion: "2026-10-30" });
    expect(r.ok).toBe(false);
    expect((await a.crearCreadorAccion({ nombre: "S", slug: "s" })).ok).toBe(false);
    expect(await db.select().from(piezas).where(eq(piezas.creadorId, creador.id))).toEqual([]);
  });

  it("sin sesion no hay accion", async () => {
    const a = await acciones();
    auth.mockResolvedValue(null);
    const r = await a.crearTipoDePiezaAccion("Reel").catch((e: unknown) => ({ ok: false, error: String(e) }));
    expect(r.ok).toBe(false);
  });
});
