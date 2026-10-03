import type { EtapaDeal } from "@/lib/deals/etapas";

/**
 * A qué etapa queda un deal después de registrar un contacto o un intento (ADR 0071
 * puntos 1 y 2). `registrarActividad` mueve con esto y la ficha lo explica con esto
 * (ticket 168): si fueran dos reglas, el botón diría una cosa y el motor haría otra.
 *
 * Solo `import type`: el archivo es client-safe y no arrastra la base al navegador.
 */
export function etapaTrasActividad(etapa: EtapaDeal, tipo: "contacto" | "intento"): EtapaDeal {
  const enGestion = etapa === "potencial" || etapa === "registrado" ? "en_gestion" : etapa;
  return tipo === "contacto" && enGestion === "en_gestion" ? "contactado" : enGestion;
}
