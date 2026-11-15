import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { envolverConsultasMedidas } from "@/lib/db";
import {
  abrirMedicionDeRender,
  conContadorDeConsultas,
  costoDeRenderAbierto,
  loggerDeCosto,
  medir,
  patronDeRuta,
  medirTiempoEnBase,
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
  it("comparte un acumulador entre ramas hermanas y entrega un solo finalizador", async () => {
    const estado = { costo: null, finalizadorEntregado: false };
    const obtenerEstado = () => estado;
    const emitir = vi.fn();

    const finalizar = abrirMedicionDeRender("/hub", obtenerEstado, emitir);
    const segundoFinalizador = abrirMedicionDeRender("/otra-ruta", obtenerEstado, emitir);

    await Promise.all([
      Promise.resolve().then(() => {
        const costo = costoDeRenderAbierto(obtenerEstado);
        if (costo) costo.consultas += 2;
      }),
      Promise.resolve().then(() => {
        const costo = costoDeRenderAbierto(obtenerEstado);
        if (costo) costo.consultas += 3;
      }),
    ]);
    finalizar?.();
    finalizar?.();

    expect(segundoFinalizador).toBeNull();
    expect(emitir).toHaveBeenCalledOnce();
    expect(JSON.parse(String(emitir.mock.calls[0]?.[0]))).toMatchObject({
      costo: { ruta: "/hub", consultas: 5 },
    });
  });

  it("fuera de un render no abre ni registra una medición", () => {
    const fueraDeRender = () => {
      throw new Error("cache() fuera de un render");
    };

    expect(() => costoDeRenderAbierto(fueraDeRender)).not.toThrow();
    expect(costoDeRenderAbierto(fueraDeRender)).toBeNull();
    expect(abrirMedicionDeRender("/hub", fueraDeRender, vi.fn())).toBeNull();
  });

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
      const terminar = medirTiempoEnBase();
      await new Promise((resolver) => setTimeout(resolver, 8));
      terminar();
      loggerDeCosto.logQuery("select * from leads where id = $1", ["dato-personal-1"]);
      loggerDeCosto.logQuery("select * from leads where id = $1", ["dato-personal-2"]);
    });

    expect(costo).toMatchObject({
      ruta: "/p/[programa]/hub",
      consultas: 3,
      identicas: 1,
      nMasUno: 1,
    });
    expect(costo.msEnBase).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(costo)).not.toContain("dato-personal");
  });

  it("suma el tiempo a la petición donde empezó la consulta, aunque termine fuera de su contexto", async () => {
    let terminar: (() => void) | undefined;
    const { costo } = await medir("/p/comunicarte/hub", async () => {
      terminar = medirTiempoEnBase();
      await new Promise((resolver) => setTimeout(resolver, 8));
    });
    terminar?.();

    expect(costo.msEnBase).toBe(0);
    const otra = await medir("/p/comunicarte/hub", async () => {
      const cerrar = medirTiempoEnBase();
      await Promise.resolve().then(() => new Promise((resolver) => setTimeout(resolver, 8)));
      cerrar();
    });
    expect(otra.costo.msEnBase).toBeGreaterThanOrEqual(5);
  });

  it("conserva el contador explícito del MCP", async () => {
    const consultas = await conContadorDeConsultas(async (contar) => {
      loggerDeCosto.logQuery("select 1", []);
      loggerDeCosto.logQuery("select 2", []);
      return contar();
    });

    expect(consultas).toBe(2);
  });

  it("el log nunca contiene el pathname concreto, ids, SQL ni parámetros", () => {
    const estado = { costo: null, finalizadorEntregado: false };
    const log = vi.fn();
    const finalizar = abrirMedicionDeRender(
      "/p/comunicarte/leads/01955d65-b3f1-7fed-8e30-613e4cd85b46",
      () => estado,
      log,
    );
    const costo = costoDeRenderAbierto(() => estado);
    if (costo) costo.consultas += 1;
    finalizar?.();

    expect(log).toHaveBeenCalledOnce();
    const linea = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(linea)).toMatchObject({
      costo: { ruta: "/p/[programa]/leads/[id]", consultas: 1 },
    });
    expect(linea).not.toMatch(/comunicarte|01955d65|persona@|select correo/i);
  });
});
