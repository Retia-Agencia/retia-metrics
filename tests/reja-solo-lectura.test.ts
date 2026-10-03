import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 172 — la reja de SOLO LECTURA de la suplantación ("ver como"), en UN solo lugar:
 * `requireSession`. Una server action (que Next marca con la cabecera `next-action`) se
 * rechaza con 403 y el mensaje "Estás viendo como {nombre}: solo lectura" mientras la
 * vista suplanta a un closer. Las lecturas (sin `next-action`) pasan. `cambiarVista`
 * puede SALIR aunque la vista esté suplantando, porque usa `requireSesionReal`.
 *
 * `auth` se mockea (sesión del developer real); la base es PGlite para que `sesionEfectiva`
 * valide el closer de verdad. `next/headers` se mockea con una cookie y una cabecera
 * controlables.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let cookieVista: string | undefined;
let nextAction: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "vista" && cookieVista !== undefined ? { name: nombre, value: cookieVista } : undefined,
    set: vi.fn(),
  }),
  headers: async () => ({
    get: (nombre: string) => (nombre === "next-action" ? (nextAction ?? null) : null),
  }),
}));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

describe("reja de solo lectura al suplantar (ticket 172)", () => {
  let base: BaseDePrueba;
  let developerId: string;
  let closerId: string;

  beforeAll(async () => {
    base = await crearBaseDePrueba();
    db = base.db;
  }, 60_000);
  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    auth.mockReset();
    cookieVista = undefined;
    nextAction = undefined;
    await db.delete(users);
    const [dev] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev Real" })
      .returning();
    developerId = dev.id;
    const [c] = await db
      .insert(users)
      .values({ email: "nico@retiagrowth.com", rol: "closer", nombre: "Nicolás", closerId: "Nico" })
      .returning();
    closerId = c.id;
    auth.mockResolvedValue({
      user: { id: developerId, rol: "developer", closerId: null, name: "Dev Real", email: "dev@retiagrowth.com" },
    });
  });
  afterEach(() => {
    cookieVista = undefined;
    nextAction = undefined;
  });

  it("una ESCRITURA (cabecera next-action) bajo suplantación lanza 403 con el mensaje de solo lectura", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = "accion-forjada"; // Next marca así una server action.
    const { requireSession } = await import("@/lib/auth/guards");
    await expect(requireSession()).rejects.toMatchObject({
      status: 403,
      message: "Estás viendo como Nicolás: solo lectura.",
    });
  });

  it("una LECTURA (sin next-action) bajo suplantación pasa con la sesión del closer", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = undefined;
    const { requireSession } = await import("@/lib/auth/guards");
    const session = await requireSession();
    expect(session.user.id).toBe(closerId);
    expect(session.user.rol).toBe("closer");
    expect(session.user.suplantadoPor).toMatchObject({ id: developerId });
  });

  it("sin suplantar, una escritura del developer pasa (la reja solo aplica a la vista suplantada)", async () => {
    cookieVista = undefined;
    nextAction = "accion-forjada";
    const { requireSession } = await import("@/lib/auth/guards");
    const session = await requireSession();
    expect(session.user.id).toBe(developerId);
    expect(session.user.suplantadoPor).toBeUndefined();
  });

  it("requireSesionReal ignora la suplantación: devuelve al developer real (así 'Salir' funciona)", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = "accion-forjada";
    const { requireSesionReal } = await import("@/lib/auth/guards");
    const session = await requireSesionReal();
    expect(session.user.id).toBe(developerId);
    expect(session.user.rol).toBe("developer");
    expect(session.user.suplantadoPor).toBeUndefined();
  });

  it("cambiarVista('todo') funciona aunque la vista esté suplantando (sale de la vista)", async () => {
    cookieVista = `closer:${closerId}`;
    nextAction = "accion-forjada";
    const { cambiarVista } = await import("@/app/(app)/acciones-vista");
    // No lanza: usa el rol REAL (developer) y escribe la cookie.
    await expect(cambiarVista("todo")).resolves.toBeUndefined();
  });
});
