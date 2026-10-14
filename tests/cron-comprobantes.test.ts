import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }),
}));

import { GET } from "@/app/api/cron/comprobantes/route";

const secretoAnterior = process.env.CRON_SECRET;

afterEach(() => {
  if (secretoAnterior === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secretoAnterior;
});

describe("cron de comprobantes", () => {
  it("responde 401 cuando falta CRON_SECRET", async () => {
    delete process.env.CRON_SECRET;
    const respuesta = await GET(new Request("http://localhost/api/cron/comprobantes"));
    expect(respuesta.status).toBe(401);
  });

  it("responde 401 cuando el secreto es incorrecto", async () => {
    process.env.CRON_SECRET = "correcto";
    const respuesta = await GET(new Request("http://localhost/api/cron/comprobantes", {
      headers: { authorization: "Bearer incorrecto" },
    }));
    expect(respuesta.status).toBe(401);
  });
});
