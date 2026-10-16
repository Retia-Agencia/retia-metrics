import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }),
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/ingesta/leer-form30x", () => ({
  leerForm30x: vi.fn().mockResolvedValue({
    fuentes: 1,
    leidas: 2,
    nuevas: 1,
    saltadas: 1,
    conError: 0,
    fuentesConError: 0,
  }),
}));

import { POST } from "@/app/api/cron/form30x/route";
import { leerForm30x } from "@/lib/ingesta/leer-form30x";

const secretoAnterior = process.env.CRON_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (secretoAnterior === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secretoAnterior;
});

describe("cron de Form30x", () => {
  it("responde 401 cuando falta el secreto", async () => {
    delete process.env.CRON_SECRET;
    const respuesta = await POST(new Request("http://localhost/api/cron/form30x"));
    expect(respuesta.status).toBe(401);
    expect(leerForm30x).not.toHaveBeenCalled();
  });

  it("responde el resumen cuando el secreto coincide", async () => {
    process.env.CRON_SECRET = "correcto";
    const respuesta = await POST(
      new Request("http://localhost/api/cron/form30x", {
        method: "POST",
        headers: { authorization: "Bearer correcto" },
      }),
    );
    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toMatchObject({ fuentes: 1, nuevas: 1 });
  });
});
