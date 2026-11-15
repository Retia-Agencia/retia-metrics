import { describe, expect, it, vi } from "vitest";
import {
  iniciarMedicionDeSolicitud,
  loggerDeCosto,
  medir,
  patronDeRuta,
  registrarTiempoEnBase,
} from "@/lib/db/medidor";

describe("patronDeRuta", () => {
  it.each([
    ["/p/comunicarte/hub", "/p/[programa]/hub"],
    ["/p/tactical-investor/deals/583", "/p/[programa]/deals/[id]"],
    ["/p/comunicarte/leads/01955d65-b3f1-7fed-8e30-613e4cd85b46", "/p/[programa]/leads/[id]"],
    ["/p/comunicarte/deals/deal_20261115", "/p/[programa]/deals/[id]"],
    ["/nerd-stats", "/nerd-stats"],
    ["/hub", "/hub"],
    ["/ajustes/salud", "/ajustes/salud"],
  ])("%s → %s", (pathname, patron) => {
    expect(patronDeRuta(pathname)).toBe(patron);
  });
});

describe("medidor de costo", () => {
  it("cuenta consultas idénticas, N+1 y tiempo en base sin guardar parámetros", async () => {
    const { costo } = await medir("/p/comunicarte/hub", async () => {
      loggerDeCosto.logQuery("select * from leads where id = $1", ["dato-personal-1"]);
      registrarTiempoEnBase(2.4);
      loggerDeCosto.logQuery("select * from leads where id = $1", ["dato-personal-1"]);
      loggerDeCosto.logQuery("select * from leads where id = $1", ["dato-personal-2"]);
    });

    expect(costo).toMatchObject({
      ruta: "/p/[programa]/hub",
      consultas: 3,
      identicas: 1,
      nMasUno: 1,
      msEnBase: 2,
    });
    expect(JSON.stringify(costo)).not.toContain("dato-personal");
  });

  it("el log nunca contiene el pathname concreto, ids, SQL ni parámetros", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const finalizar = iniciarMedicionDeSolicitud(
      "/p/comunicarte/leads/01955d65-b3f1-7fed-8e30-613e4cd85b46",
    );
    loggerDeCosto.logQuery("select correo from leads where id = $1", ["persona@ejemplo.com"]);
    finalizar?.();

    expect(log).toHaveBeenCalledOnce();
    const linea = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(linea)).toMatchObject({
      costo: { ruta: "/p/[programa]/leads/[id]", consultas: 1 },
    });
    expect(linea).not.toMatch(/comunicarte|01955d65|persona@|select correo/i);
    log.mockRestore();
  });
});
