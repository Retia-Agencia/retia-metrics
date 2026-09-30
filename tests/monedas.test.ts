import { describe, expect, it } from "vitest";
import { esquemaAbono } from "@/lib/abonos/esquema";
import { esquemaEnlacePago } from "@/lib/catalogo/enlaces-pago";
import { esquemaProducto } from "@/lib/catalogo/productos";

/**
 * Ticket 114 C6: lo que se vende y lo que se cobra hablan la misma moneda.
 *
 * Los abonos solo aceptan USD (081). Si un producto o un enlace de pago aceptara COP, se
 * podria crear algo que despues no se puede cobrar, sin ningun error al crearlo.
 */
describe("una sola moneda para vender y cobrar", () => {
  const producto = {
    programId: "22222222-2222-4222-8222-222222222222",
    nombre: "Programa completo",
    precioLista: "797",
  };
  const enlace = {
    programId: "22222222-2222-4222-8222-222222222222",
    plataformaId: "33333333-3333-4333-8333-333333333333",
    monto: "797.00",
    url: "https://paypal.com/x",
  };

  it("producto y enlace rechazan COP, igual que el abono", () => {
    expect(esquemaProducto.safeParse({ ...producto, moneda: "COP" }).success).toBe(false);
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

  it("producto y enlace aceptan USD", () => {
    expect(esquemaProducto.safeParse({ ...producto, moneda: "USD" }).success).toBe(true);
    expect(esquemaEnlacePago.safeParse({ ...enlace, moneda: "USD" }).success).toBe(true);
  });
});
