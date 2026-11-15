import { describe, expect, it, vi } from "vitest";
import { respuestaDeError } from "@/lib/auth/guards";
import { esTiempoAgotado } from "@/lib/db/errores";
import { opcionesDePool } from "@/lib/db";
import {
  CONEXION_TIMEOUT_MS,
  QUERY_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS,
} from "@/lib/tiempos";

// guards.ts importa Auth.js, que solo resuelve dentro de Next.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

describe("topes de la base", () => {
  it("configura el pool con los topes compartidos y una red de cliente más amplia", () => {
    expect(opcionesDePool("postgres://ejemplo")).toMatchObject({
      connectionString: "postgres://ejemplo",
      statement_timeout: STATEMENT_TIMEOUT_MS,
      query_timeout: QUERY_TIMEOUT_MS,
      connectionTimeoutMillis: CONEXION_TIMEOUT_MS,
    });
    expect(QUERY_TIMEOUT_MS).toBeGreaterThan(STATEMENT_TIMEOUT_MS);
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
