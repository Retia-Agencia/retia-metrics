import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La ruta de sincronizacion mueve datos reales: tiene que estar cerrada
 * igual que el resto de endpoints de gerente.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

const sincronizarPersonas = vi.fn();
vi.mock("@/lib/sheets/sync", () => ({ sincronizarPersonas }));

const select = vi.fn();
vi.mock("@/lib/db", () => ({ db: { select } }));

const sesionCloser = { user: { id: "u-2", email: "closer@retia.co", rol: "closer", closerId: "andrea" } };
const sesionGerente = { user: { id: "u-1", email: "gerente@retia.co", rol: "gerente", closerId: null } };

const params = Promise.resolve({ programa: "comunicarte" });

beforeEach(() => {
  auth.mockReset();
  sincronizarPersonas.mockReset();
  select.mockReset();
});

describe("POST /api/sync/[programa]", () => {
  it("un closer no puede disparar la sincronizacion", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });
    expect(res.status).toBe(403);
    expect(sincronizarPersonas).not.toHaveBeenCalled();
  });

  it("sin sesion tampoco", async () => {
    auth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/sync/[programa]/route");
    const res = await POST(new Request("http://x"), { params });
    expect(res.status).toBe(401);
    expect(sincronizarPersonas).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/sync", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = "secreto-de-prueba"; });

  it("rechaza sin el secreto", async () => {
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(401);
  });

  it("rechaza con el secreto equivocado", async () => {
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer otro" } }));
    expect(res.status).toBe(401);
  });

  it("no corre si CRON_SECRET no esta configurado, en vez de quedar abierto", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/sync/route");
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer lo-que-sea" } }));
    expect(res.status).toBe(500);
    process.env.CRON_SECRET = original;
  });
});
