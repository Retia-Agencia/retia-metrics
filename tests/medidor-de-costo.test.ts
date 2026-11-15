import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { envolverConsultasMedidas } from "@/lib/db";
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
  it("acepta bigint y no considera idénticos los parámetros circulares", async () => {
    const circular: { propio?: unknown } = {};
    circular.propio = circular;
    const { costo } = await medir("/hub", async () => {
      loggerDeCosto.logQuery("select $1", [BigInt(1)]);
      loggerDeCosto.logQuery("select $1", [BigInt(1)]);
      loggerDeCosto.logQuery("select $1", [circular]);
      loggerDeCosto.logQuery("select $1", [circular]);
    });

    expect(costo.consultas).toBe(4);
    expect(costo.identicas).toBe(1);
  });

  it("mide las variantes Promise y callback de query y envuelve una sola vez", async () => {
    const query = vi.fn((...argumentos: unknown[]) => {
      const callback = argumentos.at(-1);
      if (typeof callback === "function") {
        setTimeout(() => callback(null, { rows: [] }), 2);
        return undefined;
      }
      return new Promise((resolver) => setTimeout(() => resolver({ rows: [] }), 2));
    });
    const cliente = { query } as unknown as Pick<PoolClient, "query">;
    envolverConsultasMedidas(cliente);
    envolverConsultasMedidas(cliente);

    const { costo } = await medir("/hub", async () => {
      await cliente.query("select 1");
      await new Promise<void>((resolver) => {
        const retorno = cliente.query("select 2", () => resolver());
        expect(retorno).toBeUndefined();
      });
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(costo.msEnBase).toBeGreaterThan(0);
  });

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
