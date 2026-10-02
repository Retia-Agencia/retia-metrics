import { describe, expect, it } from "vitest";
import { esquemaAbono } from "@/lib/abonos/esquema";
import { esquemaEnlacePago } from "@/lib/catalogo/enlaces-pago";

/**
 * Ticket 114 C6: lo que se vende y lo que se cobra hablan la misma moneda.
 *
 * Los abonos y enlaces de pago solo aceptan USD (081).
 */
describe("una sola moneda para vender y cobrar", () => {
  const enlace = {
    programId: "22222222-2222-4222-8222-222222222222",
    plataformaId: "33333333-3333-4333-8333-333333333333",
    monto: "797.00",
    url: "https://paypal.com/x",
  };

  it("el enlace rechaza COP, igual que el abono", () => {
    expect(esquemaEnlacePago.safeParse({ ...enlace, moneda: "COP" }).success).toBe(false);
    expect(
      esquemaAbono.safeParse({
        dealId: "11111111-1111-4111-8111-111111111111",
        programId: "22222222-2222-4222-8222-222222222222",
        fecha: "2026-09-15",
        monto: "750",
        moneda: "COP",
      }).success,
    ).toBe(false);
  });

  it("el enlace acepta USD", () => {
    expect(esquemaEnlacePago.safeParse({ ...enlace, moneda: "USD" }).success).toBe(true);
  });
});
