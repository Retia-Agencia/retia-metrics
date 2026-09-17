import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { miembrosPrograma, productos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 017: las server actions de `/productos` (ADR 0016). Cada accion envuelve la
 * logica pura de `lib/catalogo/productos` y devuelve un resultado serializable
 * (`{ ok }` | `{ ok:false, error }`), igual que las acciones de programas (014),
 * catalogos (013) y usuarios (015).
 *
 * `auth` se mockea para simular la sesion; la base es PGlite en memoria, inyectada
 * en las acciones via un mock de `@/lib/db`. La barrera de rol deja pasar a gerente
 * y closer; la de acceso por programa (un closer solo toca sus programas) la enforza
 * la logica pura contra la base.
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
let programaA: string;
let programaB: string;

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

  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;

  // El closer solo es miembro activo del programa A.
  await db.insert(miembrosPrograma).values({ userId: closerId, programId: programaA, activo: true });
});

afterEach(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/productos/acciones");
}

const productoValido = (programId: string) => ({
  programId,
  nombre: "Programa completo",
  precioLista: "797.00",
  moneda: "USD" as const,
});

describe("acciones de productos — closer en su programa", () => {
  beforeEach(() => auth.mockResolvedValue(sesionCloser));

  it("un closer crea un producto en su programa y aparece en la base", async () => {
    const { crearProductoAccion } = await acciones();
    const res = await crearProductoAccion(productoValido(programaA));
    expect(res.ok).toBe(true);
    const [creado] = await db.select().from(productos).where(eq(productos.programId, programaA));
    expect(creado).toBeDefined();
  });

  it("un closer NO puede crear un producto en un programa donde no vende", async () => {
    const { crearProductoAccion } = await acciones();
    const res = await crearProductoAccion(productoValido(programaB));
    expect(res.ok).toBe(false);
  });
});

describe("acciones de productos — el gerente entra a cualquier programa", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  it("crea un producto en un programa donde el gerente no es miembro", async () => {
    const { crearProductoAccion } = await acciones();
    const res = await crearProductoAccion(productoValido(programaB));
    expect(res.ok).toBe(true);
  });

  it("un precio invalido devuelve ok:false con mensaje", async () => {
    const { crearProductoAccion } = await acciones();
    const res = await crearProductoAccion({ ...productoValido(programaA), precioLista: "0" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("un id que no es uuid al editar devuelve ok:false", async () => {
    const { editarProductoAccion } = await acciones();
    const res = await editarProductoAccion("no-uuid", productoValido(programaA));
    expect(res.ok).toBe(false);
  });

  it("desactiva y reactiva un producto", async () => {
    const { crearProductoAccion, desactivarProductoAccion, reactivarProductoAccion } =
      await acciones();
    await crearProductoAccion(productoValido(programaA));
    const [p] = await db.select().from(productos).where(eq(productos.programId, programaA));
    expect((await desactivarProductoAccion(p.id)).ok).toBe(true);
    expect((await reactivarProductoAccion(p.id)).ok).toBe(true);
  });
});
