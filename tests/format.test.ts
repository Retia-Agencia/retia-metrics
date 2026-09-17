import { describe, expect, it } from "vitest";
import { monto } from "@/lib/format";

/**
 * Ticket 005 — la moneda va SIEMPRE al lado del numero y nunca se convierte
 * (restriccion dura de AGENTS.md: hay caja en USD y pauta en COP, sin TRM historica
 * unica). La pantalla recibe filas `{ moneda, total }` de la base, asi que el
 * formateador tiene que despachar por ese texto, no por un tipo del codigo.
 */
describe("monto con su moneda", () => {
  it("formatea USD y COP con el formato de cada uno", () => {
    expect(monto(750, "USD")).toBe("USD 750");
    expect(monto(1234.5, "USD")).toBe("USD 1.234,50");
    expect(monto(2_000_000, "COP")).toBe("COP 2.000.000");
  });

  it("una moneda que el codigo no conoce igual se muestra con su codigo, nunca sin el", () => {
    // El dia que el negocio registre un abono en otra moneda, el numero no puede
    // salir desnudo ni convertido a USD.
    expect(monto(10, "EUR")).toBe("EUR 10");
  });
});
