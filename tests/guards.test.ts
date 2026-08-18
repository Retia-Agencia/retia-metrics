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
