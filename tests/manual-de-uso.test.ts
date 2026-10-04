import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: () => null }),
}));

const sesionCloser = {
  user: { id: "u-2", email: "closer@retia.co", rol: "closer", closerId: "andrea" },
};

beforeEach(() => {
  auth.mockReset();
});

describe("GET /manual", () => {
  it("sin sesion recibe 401", async () => {
    auth.mockResolvedValue(null);
    const { GET } = await import("@/app/manual/route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("sirve el manual HTML a un closer autenticado", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { GET } = await import("@/app/manual/route");

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body.startsWith("<!doctype html>")).toBe(true);
    expect(body).toContain("<title>");
  });
});
