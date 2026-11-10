import { MEDIOS_PAGOS, normalizarUtm } from "@/lib/atribucion/canal";
import { esMacro, type UtmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

export function esEnvioPago(utms: UtmsDelEnvio): boolean {
  const medium = normalizarUtm(utms.medium);
  return MEDIOS_PAGOS.some((medio) => medio === medium);
}

/** Un envío pago sin ninguna llave atribuible del árbol de Meta. */
export function esPagoSinId(utms: UtmsDelEnvio): boolean {
  if (!esEnvioPago(utms)) return false;
  return ![utms.idsMeta.adId, utms.id, utms.idsMeta.adsetId, utms.idsMeta.campaignId]
    .some((id) => id !== null && id.trim() !== "" && !esMacro(id));
}
