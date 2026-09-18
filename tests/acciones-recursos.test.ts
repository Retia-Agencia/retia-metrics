import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { categoriasRecurso, plataformasPago, programs, recursos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 023: las server actions de `/recursos`. A diferencia de `/productos`
 * (ADR 0016, ambos roles), crear/reemplazar/desactivar recursos y enlaces de pago
 * es SOLO gerente: el ticket lo pide y no hay ADR que lo abra. Un closer recibe 403
 * del servidor (ok:false), no solo un boton escondido. Mismo patron que
 * `tests/acciones-productos.test.ts`: `auth` mockeado, base PGlite inyectada.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;
let gerenteId: string;
let closerId: string;
let programa: string;
let categoria: string;
let plataforma: string;

const sesionGerente = {
  user: { id: "", email: "gerente@retiagrowth.com", rol: "gerente", closerId: null },
};
const sesionCloser = {
  user: { id: "", email: "closer@retiagrowth.com", rol: "closer", closerId: "Ana" },
};

beforeEach(async () => {
  auth.mockReset();
  ({ db, cerrar } = await crearBaseDePrueba());

  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
  sesionGerente.user.id = gerenteId;

  const [c] = await db
    .insert(users)
    .values({ email: "closer@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
    .returning();
  closerId = c.id;
  sesionCloser.user.id = closerId;

  const [p] = await db
    .insert(programs)
    .values({ slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797.00" })
    .returning();
  programa = p.id;

  const [cat] = await db.insert(categoriasRecurso).values({ nombre: "Brochure" }).returning();
  categoria = cat.id;

  // PayPal ya viene sembrada por la migracion 0003; se reusa en vez de insertarla.
  const [pl] = await db
    .select()
    .from(plataformasPago)
    .where(eq(plataformasPago.nombre, "PayPal"));
  plataforma = pl.id;
});

afterEach(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/recursos/acciones");
}

const recursoValido = () => ({
  programId: programa,
  categoriaId: categoria,
  titulo: "Brochure Comunicarte",
  url: "https://drive.google.com/brochure",
});

const enlaceValido = () => ({
  programId: programa,
  plataformaId: plataforma,
  monto: "797.00",
  moneda: "USD" as const,
  url: "https://paypal.com/pago",
});

describe("acciones de recursos — un closer es rechazado por el servidor", () => {
  beforeEach(() => auth.mockResolvedValue(sesionCloser));

  it("crear recurso devuelve ok:false para un closer", async () => {
    const { crearRecursoAccion } = await acciones();
    const res = await crearRecursoAccion(recursoValido());
    expect(res.ok).toBe(false);
    // Nada se escribio en la base.
    const filas = await db.select().from(recursos);
    expect(filas).toHaveLength(0);
  });

  it("reemplazar recurso devuelve ok:false para un closer", async () => {
    const { reemplazarRecursoAccion } = await acciones();
    const res = await reemplazarRecursoAccion(
      "3f8a1c2e-0000-4000-8000-000000000001",
      "https://drive.google.com/v2",
    );
    expect(res.ok).toBe(false);
  });

  it("desactivar recurso devuelve ok:false para un closer", async () => {
    const { desactivarRecursoAccion } = await acciones();
    const res = await desactivarRecursoAccion("3f8a1c2e-0000-4000-8000-000000000001");
    expect(res.ok).toBe(false);
  });

  it("crear enlace de pago devuelve ok:false para un closer", async () => {
    const { crearEnlacePagoAccion } = await acciones();
    const res = await crearEnlacePagoAccion(enlaceValido());
    expect(res.ok).toBe(false);
  });

  it("reemplazar enlace de pago devuelve ok:false para un closer", async () => {
    const { reemplazarEnlacePagoAccion } = await acciones();
    const res = await reemplazarEnlacePagoAccion(
      "3f8a1c2e-0000-4000-8000-000000000001",
      "https://paypal.com/v2",
    );
    expect(res.ok).toBe(false);
  });

  it("desactivar enlace de pago devuelve ok:false para un closer", async () => {
    const { desactivarEnlacePagoAccion } = await acciones();
    const res = await desactivarEnlacePagoAccion("3f8a1c2e-0000-4000-8000-000000000001");
    expect(res.ok).toBe(false);
  });
});

describe("acciones de recursos — el gerente pasa", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  it("crea un recurso y aparece en la base", async () => {
    const { crearRecursoAccion } = await acciones();
    const res = await crearRecursoAccion(recursoValido());
    expect(res.ok).toBe(true);
    const [creado] = await db.select().from(recursos).where(eq(recursos.programId, programa));
    expect(creado).toBeDefined();
    expect(creado.titulo).toBe("Brochure Comunicarte");
  });

  it("reemplaza un recurso conservando el historial", async () => {
    const { crearRecursoAccion, reemplazarRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoValido());
    const [creado] = await db.select().from(recursos).where(eq(recursos.programId, programa));
    const res = await reemplazarRecursoAccion(creado.id, "https://drive.google.com/v2");
    expect(res.ok).toBe(true);
    // Dos filas: la vieja (no vigente) y la nueva (vigente).
    const filas = await db.select().from(recursos).where(eq(recursos.programId, programa));
    expect(filas).toHaveLength(2);
  });

  it("desactiva un recurso", async () => {
    const { crearRecursoAccion, desactivarRecursoAccion } = await acciones();
    await crearRecursoAccion(recursoValido());
    const [creado] = await db.select().from(recursos).where(eq(recursos.programId, programa));
    expect((await desactivarRecursoAccion(creado.id)).ok).toBe(true);
  });

  it("una url http:// (no https) devuelve ok:false con mensaje", async () => {
    const { crearRecursoAccion } = await acciones();
    const res = await crearRecursoAccion({ ...recursoValido(), url: "http://inseguro.com" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("crea un enlace de pago", async () => {
    const { crearEnlacePagoAccion } = await acciones();
    const res = await crearEnlacePagoAccion(enlaceValido());
    expect(res.ok).toBe(true);
  });
});
