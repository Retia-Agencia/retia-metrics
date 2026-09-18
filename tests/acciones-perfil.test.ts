import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 031 — la server action del perfil propio.
 *
 * El test que MAS importa es el negativo: un closer (o un developer proyectado a vista
 * `closer` por `rolDeVista`) NO puede escribirse un `closerId`, ni llamando la accion
 * directo. Es lo que impide que alguien se atribuya las llamadas historicas de otra
 * closer escribiendo su nombre en un campo de texto. Ademas: un gerente y un developer
 * SI pueden cargarse el suyo, y el id SIEMPRE sale de la sesion (mandar un id ajeno no
 * cambia a otro usuario).
 *
 * `auth` se mockea para la sesion; la base es PGlite inyectada via mock de `@/lib/db`.
 * `next/headers` se mockea porque `rolDeVista` lee la cookie de vista (ticket 028).
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

// La cookie de vista la lee `rolDeVista` via `next/headers`, que fuera de un request
// real lanza. `ponerVista` fija el valor para un test; por defecto no hay cookie.
let cookieDeVista: string | undefined;
function ponerVista(v: string | undefined) {
  cookieDeVista = v;
}
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "vista" && cookieDeVista !== undefined
        ? { name: nombre, value: cookieDeVista }
        : undefined,
  }),
}));

let cerrar: () => Promise<void>;
let gerenteId: string;
let closerId: string;
let developerId: string;

beforeEach(async () => {
  auth.mockReset();
  cookieDeVista = undefined;
  ({ db, cerrar } = await crearBaseDePrueba());
  const insertados = await db
    .insert(users)
    .values([
      { email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" },
      { email: "closer@retiagrowth.com", rol: "closer", nombre: "Closer", closerId: "Dana" },
      { email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" },
    ])
    .returning();
  gerenteId = insertados.find((u) => u.rol === "gerente")!.id;
  closerId = insertados.find((u) => u.rol === "closer")!.id;
  developerId = insertados.find((u) => u.rol === "developer")!.id;
});

afterEach(async () => {
  await cerrar();
});

async function accion() {
  return import("@/app/(app)/perfil/acciones");
}

async function closerIdEnBase(id: string): Promise<string | null> {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  return u.closerId;
}

describe("guardarCloserIdPropioAccion — quien PUEDE", () => {
  it("un gerente se carga su propio closerId", async () => {
    auth.mockResolvedValue({ user: { id: gerenteId, email: "gerente@retiagrowth.com", rol: "gerente" } });
    const { guardarCloserIdPropioAccion } = await accion();
    const res = await guardarCloserIdPropioAccion({ closerId: "GerenteCloser" });
    expect(res.ok).toBe(true);
    expect(await closerIdEnBase(gerenteId)).toBe("GerenteCloser");
  });

  it("un developer se carga su propio closerId", async () => {
    auth.mockResolvedValue({ user: { id: developerId, email: "dev@retiagrowth.com", rol: "developer" } });
    const { guardarCloserIdPropioAccion } = await accion();
    const res = await guardarCloserIdPropioAccion({ closerId: "Mani" });
    expect(res.ok).toBe(true);
    expect(await closerIdEnBase(developerId)).toBe("Mani");
  });
});

describe("guardarCloserIdPropioAccion — quien NO PUEDE (el test que importa)", () => {
  it("un closer NO puede escribirse un closerId, ni llamando la accion directo", async () => {
    auth.mockResolvedValue({ user: { id: closerId, email: "closer@retiagrowth.com", rol: "closer" } });
    const { guardarCloserIdPropioAccion } = await accion();
    const res = await guardarCloserIdPropioAccion({ closerId: "Andrea" });
    expect(res.ok).toBe(false);
    // La fila del closer NO cambio: sigue con su closerId original.
    expect(await closerIdEnBase(closerId)).toBe("Dana");
  });

  it("un developer proyectado a vista closer tampoco puede (rolDeVista estrecha)", async () => {
    auth.mockResolvedValue({ user: { id: developerId, email: "dev@retiagrowth.com", rol: "developer" } });
    ponerVista("closer");
    const { guardarCloserIdPropioAccion } = await accion();
    const res = await guardarCloserIdPropioAccion({ closerId: "Andrea" });
    expect(res.ok).toBe(false);
    // No se escribio nada.
    expect(await closerIdEnBase(developerId)).toBeNull();
  });
});

describe("guardarCloserIdPropioAccion — el id sale de la sesion, nunca del cliente", () => {
  it("un usuario no puede escribir el closerId de OTRO (el objetivo es su propia fila)", async () => {
    // El developer (que SI puede editar) actua; la accion solo edita SU fila, sin
    // importar que otro id exista. No hay parametro de id, asi que la fila del closer
    // no se toca.
    auth.mockResolvedValue({ user: { id: developerId, email: "dev@retiagrowth.com", rol: "developer" } });
    const { guardarCloserIdPropioAccion } = await accion();
    const res = await guardarCloserIdPropioAccion({ closerId: "SoloMio" });
    expect(res.ok).toBe(true);
    // La fila del developer cambio; la del closer NO.
    expect(await closerIdEnBase(developerId)).toBe("SoloMio");
    expect(await closerIdEnBase(closerId)).toBe("Dana");
  });
});
