import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }),
}));
vi.mock("@/lib/catalogo/meta", () => ({ tokenActivoMeta: vi.fn().mockResolvedValue("token") }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/format", () => ({ hoyEnBogota: () => "2026-10-14" }));
vi.mock("@/lib/pauta/sincronizar", () => ({
  sincronizarPauta: vi.fn().mockResolvedValue({ dias: 1 }),
}));
vi.mock("@/lib/trm/registrar", () => ({
  leerTrm: vi.fn().mockRejectedValue(new Error("detalle interno")),
}));

import { GET } from "@/app/api/cron/pauta/route";
import { sincronizarPauta } from "@/lib/pauta/sincronizar";

const secretoAnterior = process.env.CRON_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (secretoAnterior === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = secretoAnterior;
});

describe("cron de pauta", () => {
  it("sincroniza la pauta aunque falle la lectura de TRM", async () => {
    process.env.CRON_SECRET = "correcto";
    const respuesta = await GET(new Request("http://localhost/api/cron/pauta", {
      headers: { authorization: "Bearer correcto" },
    }));

    expect(sincronizarPauta).toHaveBeenCalledOnce();
    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      dias: 1,
      trm: { error: "No se pudo actualizar la TRM." },
    });
  });
});
