import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prueba de punta a punta de la barrera de roles: se invoca el route handler real
 * con distintas sesiones. Si alguien afloja requireRole, este test falla.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

const sesionGerente = {
  user: { id: "u-1", email: "gerente@retia.co", rol: "gerente", closerId: null },
};
const sesionCloser = {
  user: { id: "u-2", email: "closer@retia.co", rol: "closer", closerId: "andrea" },
};
const sesionDeveloper = {
  user: { id: "u-3", email: "dev@retia.co", rol: "developer", closerId: null },
};

beforeEach(() => auth.mockReset());

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
