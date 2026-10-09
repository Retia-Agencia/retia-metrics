import type { ClaveDestino } from "./pregunta-de-etapa";

/**
 * Qué significa cada botón de la tarjeta Transición, en una línea para quien no es
 * técnico. El destino de un botón nunca es `ganado_parcial` ni `ganado_completo`: las
 * dos etapas de pago se presentan como el único destino sintético `ganado`
 * (`respuestasPorDestino`), así que esos dos nunca se leen y quedan fuera del tipo.
 *
 * Sin "use client" y solo `import type`: no arrastra el motor ni `lib/db` al bundle.
 */
export type DestinoConDescripcion = Exclude<ClaveDestino, "ganado_parcial" | "ganado_completo">;

export const DESCRIPCION_DE_DESTINO: Record<DestinoConDescripcion, string> = {
  potencial: "Dejó el formulario a medias.",
  registrado: "Llenó el formulario y nadie lo ha trabajado.",
  en_gestion: "Ya lo estás trabajando, todavía sin hablar con él.",
  contactado: "Ya hablaste con él por algún canal.",
  calificado: "Tiene el perfil: toca agendarle la llamada.",
  agendado: "Tiene una llamada con fecha. Te pide la fecha.",
  atendido: "La llamada se hizo (Show). Te pide el link de Grain.",
  compromiso_verbal: "Dijo que sí y quedó de pagar. Te pide la fecha límite.",
  ganado: "Pagó. Registra el abono, parcial o completo.",
  cierre_perdido: "No va a comprar. Te pide el motivo.",
};

export const DESCRIPCION_DE_CORREGIR = "Devuelve el deal a donde estaba si lo moviste por error.";
