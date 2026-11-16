import { describe, expect, it, vi } from "vitest";
import { INTEGRACIONES, probarIntegracion } from "@/lib/integraciones/registro";
import { LARGO_MAXIMO_SECRETO } from "@/lib/integraciones/limites";

describe("secretos de integraciones", () => {
  it("acepta un PAT de Calendly de 1005 caracteres (el tope de 500 lo partía)", () => {
    const token = `eyJ${"a".repeat(1002)}`;
    expect(INTEGRACIONES.calendly.esquema.parse(token)).toBe(token);
    expect(() => INTEGRACIONES.calendly.esquema.parse("a".repeat(LARGO_MAXIMO_SECRETO + 1))).toThrow();
  });

  it("el aviso dice por qué falló la prueba, no solo que falló", async () => {
    const f = vi.fn(async () => new Response(null, { status: 401 })) as typeof globalThis.fetch;
    await expect(probarIntegracion("calendly", "eyJmalo", f)).rejects.toThrow(/Calendly rechazó el token \(401\)/);
  });
});
