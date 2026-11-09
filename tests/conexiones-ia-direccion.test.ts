import { afterEach, describe, expect, it, vi } from "vitest";
import { urlDelRecurso } from "@/lib/oauth/origen";

// La tarjeta «Conexiones de IA» recibe esta dirección desde la página (ticket 409, A-175).
describe("dirección del MCP que muestra Mi espacio", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("en producción es el origen del CRM más /api/mcp, sin barra doble", () => {
    vi.stubEnv("AUTH_URL", "https://retia-metrics.vercel.app/");
    expect(urlDelRecurso()).toBe("https://retia-metrics.vercel.app/api/mcp");
  });

  it("en local cae a localhost:3000", () => {
    vi.stubEnv("AUTH_URL", "");
    delete process.env.AUTH_URL;
    expect(urlDelRecurso()).toBe("http://localhost:3000/api/mcp");
  });

  it("coincide con el recurso que publica el MCP", async () => {
    vi.stubEnv("AUTH_URL", "https://crm.ejemplo.co");
    const { recursoProtegido } = await import("@/lib/mcp/recurso-protegido");
    expect((await recursoProtegido().json()).resource).toBe(urlDelRecurso());
  });
});
