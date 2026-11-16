/**
 * Por qué una compra de la pasarela quedó en revisión, dicho para el gerente (ADR 0133).
 * Módulo puro: lo importa el componente de cliente del Inbox, que no puede cargar la base.
 */
export const MOTIVOS_DE_REVISION = {
  sin_oferta: "La compra no trae código de oferta.",
  oferta_desconocida: "La oferta no está registrada en los enlaces de pago del programa.",
  moneda_no_soportada: "La compra viene en una moneda que el CRM no maneja.",
  sin_cohorte: "No había una cohorte vendiendo en la fecha de la compra.",
  cohorte_ambigua: "Más de una cohorte estaba vendiendo en la fecha de la compra.",
} as const;

export function motivoDeRevision(motivo: string | null): string {
  return motivo !== null && Object.prototype.hasOwnProperty.call(MOTIVOS_DE_REVISION, motivo)
    ? MOTIVOS_DE_REVISION[motivo as keyof typeof MOTIVOS_DE_REVISION]
    : "Requiere revisión.";
}
