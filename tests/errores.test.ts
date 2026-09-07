import { describe, expect, it, vi } from "vitest";
import { respuestaDeError } from "@/lib/auth/guards";
import { AuthorizationError, AuthenticationError } from "@/lib/auth/roles";
import { MapeoInvalidoError } from "@/lib/sheets/mapeo";

// guards.ts importa la instancia completa de Auth.js, que no resuelve fuera de
// Next. Mismo mock que usa tests/guards.test.ts.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

/**
 * S-04 / B-04: respuestaDeError es el unico lugar que decide que sale al cliente.
 * Antes el endpoint de sync tenia su propia rama que filtraba por "no tiene status"
 * en vez de por tipo, y con eso cualquier excepcion interna salia al navegador.
 */
describe("respuestaDeError", () => {
  it("traduce los errores de las guardas a su status", async () => {
    const a = respuestaDeError(new AuthorizationError("solo gerentes"));
    expect(a.status).toBe(403);
    expect(await a.json()).toEqual({ error: "solo gerentes" });

    const b = respuestaDeError(new AuthenticationError());
    expect(b.status).toBe(401);
  });

  it("traduce el mapeo invalido a 422 y deja pasar su mensaje, que es accionable", async () => {
    const res = respuestaDeError(new MapeoInvalidoError("estado", ["estado"], ["Correo"]));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("estado");
  });

  it("no deja salir el mensaje de un error interno", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = respuestaDeError(new Error("connect ECONNREFUSED ep-xyz.neon.tech:5432"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno." });
    // Se pierde para el cliente, no para nosotros.
    expect(espia).toHaveBeenCalled();
    espia.mockRestore();
  });

  it("un error interno con propiedad status tampoco se filtra", async () => {
    // Este es el caso exacto que colaba la rama vieja del endpoint de sync: la
    // condicion miraba la forma del error, no su tipo.
    const filtrable = Object.assign(new Error("host=ep-xyz.neon.tech user=neondb_owner"), {
      status: 500,
    });
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = respuestaDeError(filtrable);

    expect(await res.json()).toEqual({ error: "Error interno." });
    espia.mockRestore();
  });
});
