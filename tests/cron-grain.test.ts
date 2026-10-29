import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/grain/transcripciones", () => ({
  correrLecturasPendientes: vi.fn().mockResolvedValue({ candidatas: 2, leidas: 1, fallidas: 1 }),
}));

import { GET } from "@/app/api/cron/grain/route";
import { correrLecturasPendientes } from "@/lib/grain/transcripciones";

const secretoAnterior = process.env.CRON_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (secretoAnterior === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secretoAnterior;
});

describe("cron de Grain", () => {
  it("sin secreto o con uno incorrecto responde 401 y no lee nada", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("http://localhost/api/cron/grain"))).status).toBe(401);
    process.env.CRON_SECRET = "correcto";
    const mal = new Request("http://localhost/api/cron/grain", { headers: { authorization: "Bearer otro" } });
    expect((await GET(mal)).status).toBe(401);
    expect(correrLecturasPendientes).not.toHaveBeenCalled();
  });

  it("con el secreto responde el resumen", async () => {
    process.env.CRON_SECRET = "correcto";
    const r = await GET(new Request("http://localhost/api/cron/grain", { headers: { authorization: "Bearer correcto" } }));
    expect(await r.json()).toEqual({ candidatas: 2, leidas: 1, fallidas: 1 });
  });
});
