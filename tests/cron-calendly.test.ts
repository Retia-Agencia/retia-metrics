import { afterEach, describe, expect, it, vi } from "vitest";

const seleccionar = vi.hoisted(() => vi.fn(() => ({ from: () => ({ where: vi.fn().mockResolvedValue([{ id: "programa-1" }, { id: "programa-2" }]) }) })));
vi.mock("@/lib/db", () => ({ db: { select: seleccionar } }));
vi.mock("@/lib/calendly/reconciliar", () => ({
  reconciliarCalendly: vi.fn().mockResolvedValue({ sueltas: 1, colgadas: 1, dealsReparados: 0, dudas: 0, sinLlamada: 0, fallidas: 0, fallas: [] }),
}));
vi.mock("@/lib/auth/guards", () => ({ respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }) }));

import { GET } from "@/app/api/cron/calendly/route";
import { reconciliarCalendly } from "@/lib/calendly/reconciliar";

const anterior = process.env.CRON_SECRET;
afterEach(() => {
  vi.clearAllMocks();
  if (anterior === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = anterior;
});

describe("cron de reconciliacion de Calendly", () => {
  it("falla cerrado sin secreto o con uno incorrecto", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("http://localhost/api/cron/calendly"))).status).toBe(401);
    process.env.CRON_SECRET = "correcto";
    expect((await GET(new Request("http://localhost/api/cron/calendly", { headers: { authorization: "Bearer otro" } }))).status).toBe(401);
    expect(reconciliarCalendly).not.toHaveBeenCalled();
  });

  it("barre cada programa activo", async () => {
    process.env.CRON_SECRET = "correcto";
    const respuesta = await GET(new Request("http://localhost/api/cron/calendly", { headers: { authorization: "Bearer correcto" } }));
    expect(respuesta.status).toBe(200);
    expect(reconciliarCalendly).toHaveBeenCalledWith(expect.anything(), "programa-1");
    expect(reconciliarCalendly).toHaveBeenCalledWith(expect.anything(), "programa-2");
    expect(reconciliarCalendly).toHaveBeenCalledTimes(2);
  });

  it("responde 200 y expone el motivo cuando una cita falla", async () => {
    vi.mocked(reconciliarCalendly).mockResolvedValueOnce({
      sueltas: 1, colgadas: 0, dealsReparados: 0, dudas: 0, sinLlamada: 0,
      fallidas: 1, fallas: [{ cita: "uuid-fallida", motivo: "sin_deal_abierto" }],
    });
    process.env.CRON_SECRET = "correcto";

    const respuesta = await GET(new Request("http://localhost/api/cron/calendly", { headers: { authorization: "Bearer correcto" } }));

    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.json();
    expect(cuerpo.programas[0]).toMatchObject({
      fallidas: 1, fallas: [{ cita: "uuid-fallida", motivo: "sin_deal_abierto" }],
    });
    expect(reconciliarCalendly).toHaveBeenCalledTimes(2);
  });
});
