import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { respuestaDeError } from "@/lib/auth/guards";
import { esTiempoAgotado } from "@/lib/db/errores";
import {
  aplicarTopeEnTransacciones,
  envolverConsultasMedidas,
  opcionesDePool,
} from "@/lib/db";
import { medir } from "@/lib/db/medidor";
import {
  CONEXION_TIMEOUT_MS,
  QUERY_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
} from "@/lib/tiempos";

// guards.ts importa Auth.js, que solo resuelve dentro de Next.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

describe("topes de la base", () => {
  it("configura el pool con los topes compartidos", () => {
    expect(opcionesDePool("postgres://ejemplo")).toMatchObject({
      connectionString: "postgres://ejemplo",
      statement_timeout: STATEMENT_TIMEOUT_MS,
      query_timeout: QUERY_TIMEOUT_MS,
      connectionTimeoutMillis: CONEXION_TIMEOUT_MS,
    });
    expect(QUERY_TIMEOUT_MS).toBe(15_000);
    expect(STATEMENT_TIMEOUT_MS).toBe(15_000);
    expect(QUERY_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
    expect(STATEMENT_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });

  it("aplica SET LOCAL despues de begin y envuelve una sola vez", async () => {
    const consultas: unknown[] = [];
    const query = vi.fn((consulta: unknown) => {
      consultas.push(consulta);
      return Promise.resolve({ rows: [] });
    });
    const cliente = { query } as unknown as Pick<PoolClient, "query">;

    aplicarTopeEnTransacciones(cliente);
    aplicarTopeEnTransacciones(cliente);
    await cliente.query("begin");
    await cliente.query({ text: "begin" });
    await cliente.query("select 1");

    expect(consultas).toEqual([
      "begin",
      "set local statement_timeout = 15000",
      { text: "begin" },
      "set local statement_timeout = 15000",
      "select 1",
    ]);
  });

  it("conserva la variante callback al aplicar el tope", async () => {
    const consultas: unknown[] = [];
    const query = vi.fn((...argumentos: unknown[]) => {
      consultas.push(argumentos[0]);
      const callback = argumentos.at(-1);
      if (typeof callback === "function") {
        callback(null, { rows: [] });
        return undefined;
      }
      return Promise.resolve({ rows: [] });
    });
    const cliente = { query } as unknown as Pick<PoolClient, "query">;
    aplicarTopeEnTransacciones(cliente);

    await new Promise<void>((resolver, rechazar) => {
      const retorno = cliente.query("begin", (error) => {
        if (error) rechazar(error);
        else resolver();
      });
      expect(retorno).toBeUndefined();
    });

    expect(consultas).toEqual(["begin", "set local statement_timeout = 15000"]);
  });

  it("mantiene la medicion con ambos envoltorios", async () => {
    const query = vi.fn(
      () => new Promise((resolver) => setTimeout(() => resolver({ rows: [] }), 2)),
    );
    const cliente = { query } as unknown as Pick<PoolClient, "query">;
    envolverConsultasMedidas(cliente);
    aplicarTopeEnTransacciones(cliente);

    const { costo } = await medir("/hub", () => cliente.query("select 1"));

    expect(query).toHaveBeenCalledOnce();
    expect(costo.msEnBase).toBeGreaterThan(0);
  });

  it("reconoce query_canceled directo y anidado en cause", () => {
    expect(esTiempoAgotado(Object.assign(new Error("cancelada"), { code: "57014" }))).toBe(true);
    expect(esTiempoAgotado(new Error("drizzle", { cause: { cause: { code: "57014" } } }))).toBe(true);
  });

  it.each([
    "Query read timeout",
    "timeout exceeded when trying to connect",
    "unable to check out connection",
  ])("reconoce el mensaje de pg: %s", (mensaje) => {
    expect(esTiempoAgotado(new Error("envoltura", { cause: new Error(mensaje) }))).toBe(true);
  });

  it("no confunde una violación de unicidad con un timeout", () => {
    expect(esTiempoAgotado(Object.assign(new Error("duplicado"), { code: "23505" }))).toBe(false);
  });

  it("traduce el timeout a un 504 fijo sin filtrar el texto del driver", async () => {
    const original = "Query read timeout en postgres://usuario:secreto@host";
    const respuesta = respuestaDeError(new Error(original));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(504);
    expect(cuerpo).toEqual({ error: "La consulta tardó demasiado. Vuelve a intentarlo." });
    expect(JSON.stringify(cuerpo)).not.toContain(original);
  });
});
