import { z } from "zod";

const dinero = z.object({ value: z.number(), currency_value: z.string() }).passthrough();
export const eventoHotmartSchema = z.object({
  id: z.string(), event: z.string(), version: z.string(),
  data: z.object({
    buyer: z.object({ email: z.string().optional(), name: z.string().optional(), checkout_phone: z.string().optional(), checkout_phone_code: z.string().optional() }).passthrough(),
    purchase: z.object({ transaction: z.string(), approved_date: z.number(), full_price: dinero, price: dinero,
      offer: z.object({ code: z.string().optional() }).passthrough().optional(), status: z.string() }).passthrough(),
    product: z.object({ id: z.number(), name: z.string() }).passthrough(),
  }).passthrough(),
}).passthrough();
export type EventoHotmart = z.infer<typeof eventoHotmartSchema>;
export const EVENTOS_DE_COMPRA_HOTMART = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
export function leerCompraHotmart(cuerpo: string) { return eventoHotmartSchema.parse(JSON.parse(cuerpo)); }

/** Provisional según la documentación: “Total amount paid by the buyer”; confirmar con el primer evento real. */
export function montoPagado(compra: EventoHotmart["data"]["purchase"]) {
  return { monto: compra.full_price.value, moneda: compra.full_price.currency_value };
}

export const telefonoDelComprador = (buyer: EventoHotmart["data"]["buyer"]) =>
  `${buyer.checkout_phone_code ?? ""}${buyer.checkout_phone ?? ""}`;
