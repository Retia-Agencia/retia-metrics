import { timingSafeEqual } from "node:crypto";
import { leerCompraHotmart } from "./hotmart";

function verificar(_cuerpo: string, recibido: string | null, secreto: string): boolean {
  if (recibido === null) return false;
  const a = Buffer.from(recibido); const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const PROVEEDORES_DE_PAGO = {
  hotmart: { headerSecreto: "x-hotmart-hottok", verificar, leerCompra: leerCompraHotmart },
} as const;
