import { describe, expect, it } from "vitest";
import { esquemaAbono } from "@/lib/abonos/esquema";

/**
 * Ticket 018 — esquema zod del abono (solo validacion; las funciones de escritura
 * son del 019).
 *
 * Decision de Michael (16-sep): hoy la moneda de un abono solo puede ser USD. La
 * columna existe para que la moneda siga visible al lado del numero (nunca se
 * convierte en silencio, restriccion dura de AGENTS.md), pero el esquema la
 * restringe a USD por ahora. El monto es un adelanto positivo.
 */
describe("esquema del abono", () => {
  const base = {
    saleId: "11111111-1111-4111-8111-111111111111",
    programId: "22222222-2222-4222-8222-222222222222",
    fecha: "2026-09-15",
    monto: "750",
  };

  it("acepta un abono en USD", () => {
    const r = esquemaAbono.parse({ ...base, moneda: "USD" });
    expect(r.moneda).toBe("USD");
    expect(r.monto).toBe("750");
  });

  it("usa USD por defecto si no se pasa moneda", () => {
    const r = esquemaAbono.parse(base);
    expect(r.moneda).toBe("USD");
  });

  it("rechaza COP", () => {
    expect(() => esquemaAbono.parse({ ...base, moneda: "COP" })).toThrow();
  });

  it("rechaza un monto de cero o negativo", () => {
    expect(() => esquemaAbono.parse({ ...base, monto: "0" })).toThrow();
    expect(() => esquemaAbono.parse({ ...base, monto: "-10" })).toThrow();
  });

  it("rechaza un monto que no es un numero", () => {
    expect(() => esquemaAbono.parse({ ...base, monto: "abc" })).toThrow();
  });

  it("rechaza un saleId que no es uuid", () => {
    expect(() => esquemaAbono.parse({ ...base, saleId: "no-es-uuid" })).toThrow();
  });
});
