import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }),
}));
vi.mock("@/lib/integraciones", () => ({ tokensMeta: vi.fn().mockResolvedValue(new Map([["programa", "token"]])) }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/format", () => ({ hoyEnBogota: () => "2026-10-14" }));
vi.mock("@/lib/pauta/sincronizar", () => ({
  sincronizarPauta: vi.fn().mockResolvedValue({ estado: "ok", dias: 1 }),
}));
vi.mock("@/lib/pauta/cuadre", () => ({
  cuadrarPauta: vi.fn().mockResolvedValue({ cuentas: 1, dias: 30, descuadres: 0, errores: [] }),
}));
vi.mock("@/lib/trm/registrar", () => ({
  leerTrm: vi.fn().mockRejectedValue(new Error("detalle interno")),
}));

import { GET } from "@/app/api/cron/pauta/route";
import { sincronizarPauta } from "@/lib/pauta/sincronizar";
import { cuadrarPauta } from "@/lib/pauta/cuadre";

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
      estado: "ok",
      trm: { error: "No se pudo actualizar la TRM." },
      cuadre: { cuentas: 1, dias: 30, descuadres: 0, errores: [] },
    });
  });

  it("cuadra aunque la sincronización termine con error", async () => {
    process.env.CRON_SECRET = "correcto";
    vi.mocked(sincronizarPauta).mockResolvedValueOnce({
      estado: "error", filas: 0, omitidas: 0, error: "falla simulada",
    });

    const respuesta = await GET(new Request("http://localhost/api/cron/pauta", {
      headers: { authorization: "Bearer correcto" },
    }));

    expect(cuadrarPauta).toHaveBeenCalledOnce();
    await expect(respuesta.json()).resolves.toMatchObject({
      estado: "error",
      cuadre: { cuentas: 1, descuadres: 0 },
    });
  });

  it("conserva el éxito del cron cuando falla el cuadre", async () => {
    process.env.CRON_SECRET = "correcto";
    vi.mocked(cuadrarPauta).mockRejectedValueOnce(new Error("detalle interno"));

    const respuesta = await GET(new Request("http://localhost/api/cron/pauta", {
      headers: { authorization: "Bearer correcto" },
    }));

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toMatchObject({
      dias: 1,
      cuadre: { error: "No se pudo ejecutar el cuadre de pauta." },
    });
  });
});
