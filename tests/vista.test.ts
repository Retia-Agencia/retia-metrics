import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { proyectarRol, esVistaValida, VISTA_POR_DEFECTO } from "@/lib/auth/vista";
import type { Session } from "next-auth";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";

/**
 * `proyectarRol` es la parte PURA de `rolDeVista` (sin cookie): dado el rol real y la
 * vista, con que rol se proyecta y se guarda. La regla dura del ticket 028 es que la
 * vista solo ESTRECHA, nunca ensancha.
 */
describe("proyectarRol (ticket 028)", () => {
  it("un developer se proyecta segun la vista", () => {
    expect(proyectarRol("developer", "todo")).toBe("developer");
    expect(proyectarRol("developer", "gerente")).toBe("gerente");
    expect(proyectarRol("developer", "closer")).toBe("closer");
  });

  it("un no-developer IGNORA la vista: devuelve su rol real (no ensancha)", () => {
    // Un closer con cualquier vista sigue siendo closer: no gana acceso de gerente.
    expect(proyectarRol("closer", "gerente")).toBe("closer");
    expect(proyectarRol("closer", "todo")).toBe("closer");
    expect(proyectarRol("closer", "closer")).toBe("closer");
    // Un gerente con cualquier vista sigue siendo gerente.
    expect(proyectarRol("gerente", "closer")).toBe("gerente");
    expect(proyectarRol("gerente", "todo")).toBe("gerente");
  });

  it("sin rol no hay proyeccion", () => {
    expect(proyectarRol(null, "gerente")).toBeNull();
  });

  it("la vista por defecto es 'todo', la mas ancha", () => {
    expect(VISTA_POR_DEFECTO).toBe("todo");
    expect(proyectarRol("developer", VISTA_POR_DEFECTO)).toBe("developer");
  });

  it("solo 'todo', 'gerente' y 'closer' son vistas validas", () => {
    expect(esVistaValida("todo")).toBe(true);
    expect(esVistaValida("gerente")).toBe(true);
    expect(esVistaValida("closer")).toBe(true);
    expect(esVistaValida("developer")).toBe(false); // no es un valor de la cookie
    expect(esVistaValida("")).toBe(false);
    expect(esVistaValida(undefined)).toBe(false);
  });
});

/**
 * `sesionEfectiva` (ticket 172): un developer que suplanta a un closer de verdad obtiene
 * una sesión con el id, rol y closerId del suplantado y `suplantadoPor` apuntando a él.
 * La cookie se valida contra `users` EN CADA lectura; cualquier estado inválido vuelve a
 * la sesión real. La vista solo estrecha: un closer real con la cookie puesta no suplanta.
 */
let cookieVista: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nombre: string) =>
      nombre === "vista" && cookieVista !== undefined ? { name: nombre, value: cookieVista } : undefined,
  }),
}));

describe("sesionEfectiva: ver como un closer de verdad (ticket 172)", () => {
  let base: BaseDePrueba;
  let db: Db;
  let developerId: string;
  let closerId: string;
  let closerInactivoId: string;
  let otroGerenteId: string;

  beforeAll(async () => {
    base = await crearBaseDePrueba();
    db = base.db;
  }, 60_000);
  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    cookieVista = undefined;
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
    const [ci] = await db
      .insert(users)
      .values({ email: "ex@retiagrowth.com", rol: "closer", nombre: "Ex Closer", closerId: "Ex", activo: false })
      .returning();
    closerInactivoId = ci.id;
    const [g] = await db
      .insert(users)
      .values({ email: "ger@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
      .returning();
    otroGerenteId = g.id;
  });
  afterEach(() => {
    cookieVista = undefined;
  });

  const sesionDe = (id: string, rol: Session["user"]["rol"], nombre: string): Session =>
    ({ user: { id, rol, closerId: null, name: nombre, email: `${id}@x.co` } }) as Session;

  async function efectiva(session: Session): Promise<Session> {
    const { sesionEfectiva } = await import("@/lib/auth/vista");
    return sesionEfectiva(session, db);
  }

  it("un developer con cookie closer:<id> válida suplanta: id, rol y closerId del closer + suplantadoPor", async () => {
    cookieVista = `closer:${closerId}`;
    const res = await efectiva(sesionDe(developerId, "developer", "Dev Real"));
    expect(res.user.id).toBe(closerId);
    expect(res.user.rol).toBe("closer");
    expect(res.user.closerId).toBe("Nico");
    expect(res.user.suplantadoPor).toEqual({ id: developerId, nombre: "Dev Real" });
  });

  it("un id inexistente vuelve a la sesión real (no suplanta)", async () => {
    cookieVista = "closer:00000000-0000-0000-0000-000000000000";
    const res = await efectiva(sesionDe(developerId, "developer", "Dev Real"));
    expect(res.user.id).toBe(developerId);
    expect(res.user.suplantadoPor).toBeUndefined();
  });

  it("un closer inactivo no se puede suplantar", async () => {
    cookieVista = `closer:${closerInactivoId}`;
    const res = await efectiva(sesionDe(developerId, "developer", "Dev Real"));
    expect(res.user.id).toBe(developerId);
    expect(res.user.suplantadoPor).toBeUndefined();
  });

  it("no se puede suplantar a quien no es closer (un gerente)", async () => {
    cookieVista = `closer:${otroGerenteId}`;
    const res = await efectiva(sesionDe(developerId, "developer", "Dev Real"));
    expect(res.user.id).toBe(developerId);
    expect(res.user.suplantadoPor).toBeUndefined();
  });

  it("un CLOSER real con la cookie closer:<id> puesta a mano NO suplanta (la vista solo estrecha)", async () => {
    cookieVista = `closer:${closerId}`;
    const real = sesionDe(otroGerenteId, "closer", "Un Closer"); // rol closer, no acceso total
    const res = await efectiva(real);
    expect(res.user.id).toBe(otroGerenteId);
    expect(res.user.suplantadoPor).toBeUndefined();
  });

  it("sin cookie, el developer es él mismo", async () => {
    cookieVista = undefined;
    const res = await efectiva(sesionDe(developerId, "developer", "Dev Real"));
    expect(res.user.id).toBe(developerId);
    expect(res.user.suplantadoPor).toBeUndefined();
  });
});
