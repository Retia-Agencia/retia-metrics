import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 015: las server actions de `/ajustes/usuarios`. Cada accion envuelve la
 * logica pura de `lib/catalogo/usuarios` y devuelve un resultado serializable
 * (`{ ok }` | `{ ok:false, error }`), igual que las acciones de catalogos (013): una
 * excepcion no viaja al cliente con su tipo.
 *
 * `auth` se mockea para simular la sesion; la base es PGlite en memoria, inyectada
 * en las acciones via un mock de `@/lib/db`. Un closer NUNCA pasa (ADR 0003).
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

// Las acciones usan la `db` de la app; en el test se apunta a la de PGlite.
let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

// revalidatePath no hace nada util fuera de una request de Next.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;
let gerenteId: string;
let programaAId: string;

const sesionGerente = {
  user: { id: "", email: "gerente@retiagrowth.com", rol: "gerente", closerId: null },
};
const sesionCloser = {
  user: { id: "u-2", email: "closer@retiagrowth.com", rol: "closer", closerId: "andrea" },
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
  const [p] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" })
    .returning();
  programaAId = p.id;
});

afterEach(async () => {
  await cerrar();
});

async function acciones() {
  return import("@/app/(app)/ajustes/usuarios/acciones");
}

describe("acciones de usuarios — barrera de rol (ADR 0003)", () => {
  it("un closer es rechazado en crear, editar, desactivar y reactivar", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearUsuarioAccion, editarUsuarioAccion, desactivarUsuarioAccion, reactivarUsuarioAccion } =
      await acciones();

    const UUID = "00000000-0000-0000-0000-000000000000";
    for (const llamada of [
      () =>
        crearUsuarioAccion({
          email: "x@retiagrowth.com",
          rol: "gerente",
          closerId: "",
          programas: [],
        }),
      () =>
        editarUsuarioAccion(UUID, {
          email: "x@retiagrowth.com",
          rol: "gerente",
          closerId: "",
          programas: [],
        }),
      () => desactivarUsuarioAccion(UUID),
      () => reactivarUsuarioAccion(UUID),
    ]) {
      const res = await llamada();
      expect(res.ok).toBe(false);
    }
  });
});

describe("acciones de usuarios — el gerente administra", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  it("crea un closer con closerId y programa", async () => {
    const { crearUsuarioAccion } = await acciones();
    const res = await crearUsuarioAccion({
      email: "andrea@retiagrowth.com",
      nombre: "Andrea",
      rol: "closer",
      closerId: "Andrea",
      programas: [programaAId],
    });
    expect(res.ok).toBe(true);

    const [creado] = await db
      .select()
      .from(users)
      .where(eq(users.email, "andrea@retiagrowth.com"));
    expect(creado).toBeDefined();
    const membresias = await db
      .select()
      .from(miembrosPrograma)
      .where(eq(miembrosPrograma.userId, creado.id));
    expect(membresias).toHaveLength(1);
  });

  it("un closer sin closerId devuelve ok:false con mensaje", async () => {
    const { crearUsuarioAccion } = await acciones();
    const res = await crearUsuarioAccion({
      email: "malo@retiagrowth.com",
      rol: "closer",
      closerId: "",
      programas: [programaAId],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0);
  });

  it("un gerente no puede desactivarse a si mismo", async () => {
    const { desactivarUsuarioAccion } = await acciones();
    const res = await desactivarUsuarioAccion(gerenteId);
    expect(res.ok).toBe(false);
    const [u] = await db.select().from(users).where(eq(users.id, gerenteId));
    expect(u.activo).toBe(true);
  });
});
