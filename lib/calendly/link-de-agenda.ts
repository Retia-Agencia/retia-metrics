import { generarLink } from "@/lib/atribucion/link-de-captacion";

const CODIGO_DE_DEAL = /^[0-9a-f]{32}$/;

/** Código opaco que Calendly devuelve en el tracking del invitado. */
export function codigoDeDeal(dealId: string): string {
  return dealId.replaceAll("-", "").toLowerCase();
}

/** Recupera el UUID de un código válido, o `null` si no puede ser un deal. */
export function dealDeCodigo(codigo: string | null): string | null {
  const limpio = codigo?.trim().toLowerCase() ?? "";
  if (!CODIGO_DE_DEAL.test(limpio)) return null;
  return `${limpio.slice(0, 8)}-${limpio.slice(8, 12)}-${limpio.slice(12, 16)}-${limpio.slice(16, 20)}-${limpio.slice(20)}`;
}

/** Link calculado del handoff. `generarLink` sigue siendo el único armador de UTM. */
export function linkDeAgenda(calendlyUrl: string, dealId: string): string {
  return generarLink(calendlyUrl, {
    source: "crm",
    medium: "setter",
    campaign: "agenda",
    content: codigoDeDeal(dealId),
  });
}
