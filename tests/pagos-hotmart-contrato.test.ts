import { describe, expect, it } from "vitest";
import fixture from "./fixtures/hotmart-purchase-approved-doc.json";
import { eventoHotmartSchema, montoPagado, telefonoDelComprador } from "@/lib/pagos/hotmart";
import { normalizarTelefono } from "@/lib/ingesta/envio";
import { codigoOff } from "@/lib/pagos/traducir";

// ejemplo de la documentacion, no un evento real; reemplazar con el primer envio real (448)
describe("contrato de Hotmart", () => {
  it("lee el ejemplo 2.0.0 y usa el total pagado", () => {
    const evento = eventoHotmartSchema.parse(fixture);
    expect(montoPagado(evento.data.purchase)).toEqual({ monto: 99, moneda: "USD" });
  });
  it("concatena y normaliza el teléfono", () => {
    const evento = eventoHotmartSchema.parse(fixture);
    expect(normalizarTelefono(telefonoDelComprador(evento.data.buyer))).toBe("31999999999");
  });
  it("extrae off sin depender de otros parámetros", () => {
    expect(codigoOff("https://pay.hotmart.com/X?src=a&off=n82b9jqz")).toBe("n82b9jqz");
    expect(codigoOff("no-es-url")).toBeNull();
  });
});
