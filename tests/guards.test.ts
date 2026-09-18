import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prueba de punta a punta de la barrera de roles: se invoca el route handler real
 * con distintas sesiones. Si alguien afloja requireRole, este test falla.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

/**
 * La cookie de vista (ticket 028) la lee `rolDeVista` via `next/headers`, que fuera de
 * un request real lanza. Se mockea con un store controlable: `ponerVista` fija el
 * valor de la cookie para un test, y por defecto no hay cookie (vista `todo`).
 */
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

const sesionGerente = {
  user: { id: "u-1", email: "gerente@retia.co", rol: "gerente", closerId: null },
};
const sesionCloser = {
  user: { id: "u-2", email: "closer@retia.co", rol: "closer", closerId: "andrea" },
};
const sesionDeveloper = {
  user: { id: "u-3", email: "dev@retia.co", rol: "developer", closerId: null },
};

beforeEach(() => {
  auth.mockReset();
  cookieDeVista = undefined;
});

describe("GET /api/admin/ping — endpoint solo de gerente", () => {
  it("un closer recibe 403 desde el servidor", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { GET } = await import("@/app/api/admin/ping/route");
    const res = await GET();
    expect(res.status).toBe(403);
    // El cuerpo no debe filtrar nada del recurso protegido.
    await expect(res.json()).resolves.not.toHaveProperty("gerente");
  });

  it("sin sesion recibe 401", async () => {
    auth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/ping/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("el gerente entra", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { GET } = await import("@/app/api/admin/ping/route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
  });

  it("el developer tambien entra a un endpoint de gerente (ADR 0025)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    const { GET } = await import("@/app/api/admin/ping/route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
  });
});

/**
 * No hay ninguna ruta HTTP exclusiva de closer hoy, asi que la barrera de rol se
 * prueba directo sobre `requireRole("closer")`: un gerente no pasa (disjuncion,
 * ADR 0003), pero un developer si (acceso total, ADR 0025). Se invoca el guard real
 * con la sesion mockeada, igual que los handlers.
 */
describe("requireRole('closer') — barrera exclusiva de closer", () => {
  it("un gerente NO pasa (siguen disjuntos, ADR 0003)", async () => {
    auth.mockResolvedValue(sesionGerente);
    const { requireRole, AuthorizationError } = await import("@/lib/auth/guards");
    await expect(requireRole("closer")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("un developer pasa una ruta exclusiva de closer (ADR 0025)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    const { requireRole } = await import("@/lib/auth/guards");
    const session = await requireRole("closer");
    expect(session.user.rol).toBe("developer");
  });

  it("un developer tambien pasa requireRole('gerente')", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    const { requireRole } = await import("@/lib/auth/guards");
    const session = await requireRole("gerente");
    expect(session.user.rol).toBe("developer");
  });
});

/**
 * "Ver como" (ticket 028): la vista estrecha tambien la GUARDA, no solo la
 * proyeccion. `requireRole` se evalua contra `rolDeVista`, asi que la cookie del
 * developer cambia que barreras pasa. Estrechar nunca otorga: un no-developer con la
 * cookie puesta a mano no cambia nada.
 */
describe("la vista estrecha la guarda (ticket 028)", () => {
  it("developer en vista 'closer' NO pasa requireRole('gerente')", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("closer");
    const { requireRole, AuthorizationError } = await import("@/lib/auth/guards");
    await expect(requireRole("gerente")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("developer en vista 'closer' SI pasa requireRole('closer')", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("closer");
    const { requireRole } = await import("@/lib/auth/guards");
    const session = await requireRole("closer");
    expect(session.user.rol).toBe("developer");
  });

  it("developer en vista 'gerente' NO pasa requireRole('closer') (ADR 0003 recuperado)", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("gerente");
    const { requireRole, AuthorizationError } = await import("@/lib/auth/guards");
    await expect(requireRole("closer")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("developer en vista 'gerente' SI pasa requireRole('gerente')", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("gerente");
    const { requireRole } = await import("@/lib/auth/guards");
    const session = await requireRole("gerente");
    expect(session.user.rol).toBe("developer");
  });

  it("developer en vista 'todo' (por defecto) pasa TODA guarda", async () => {
    auth.mockResolvedValue(sesionDeveloper);
    ponerVista("todo");
    const { requireRole } = await import("@/lib/auth/guards");
    expect((await requireRole("gerente")).user.rol).toBe("developer");
    expect((await requireRole("closer")).user.rol).toBe("developer");
  });

  it("un closer con cookie 'gerente' a mano NO ensancha: sigue sin pasar requireRole('gerente')", async () => {
    auth.mockResolvedValue(sesionCloser);
    ponerVista("gerente");
    const { requireRole, AuthorizationError } = await import("@/lib/auth/guards");
    await expect(requireRole("gerente")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("un gerente con cookie 'closer' a mano NO cambia: sigue sin pasar requireRole('closer')", async () => {
    auth.mockResolvedValue(sesionGerente);
    ponerVista("closer");
    const { requireRole, AuthorizationError } = await import("@/lib/auth/guards");
    await expect(requireRole("closer")).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("GET /api/me — cualquier usuario autenticado", () => {
  it("el closer solo obtiene sus propios datos", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { GET } = await import("@/app/api/me/route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: "u-2", rol: "closer" });
  });

  it("sin sesion recibe 401", async () => {
    auth.mockResolvedValue(undefined);
    const { GET } = await import("@/app/api/me/route");
    expect((await GET()).status).toBe(401);
  });
});
