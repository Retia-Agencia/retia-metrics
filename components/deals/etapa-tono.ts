import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";

/**
 * El tono (`<Badge variant>`) con el que se pinta cada etapa, de la tabla de
 * `docs/structure.md` §3. La etapa se pinta SIEMPRE con el mismo tono (regla §9): el
 * mismo en el Kanban, la ficha y las tablas.
 *
 * `import type` se borra en compilacion, asi que este archivo es client-safe: no
 * arrastra el motor (que importa drizzle) al bundle.
 *
 * Seguimiento (11) estaba marcada "🔴 sin tono asignado" en §3: se le da `info`, el
 * mismo que Atendido, porque es su continuacion (la llamada ocurrio y hay que volver a
 * contactar). Si el equipo decide otro, se cambia aqui y en §3.
 */
export type TonoEtapa = "neutro" | "info" | "alerta" | "exito" | "peligro";

export const TONO_DE_ETAPA: Readonly<Record<EtapaDeal, TonoEtapa>> = {
  potencial: "neutro",
  registrado: "neutro",
  en_gestion: "neutro",
  contactado: "neutro",
  calificado: "neutro",
  agendado: "info",
  atendido: "info",
  compromiso_verbal: "alerta",
  ganado_parcial: "exito",
  ganado_completo: "exito",
  cierre_perdido: "peligro",
};

export const TONO_DE_PENDIENTE: Readonly<Record<PendienteDeal, TonoEtapa>> = {
  reagenda: "alerta",
  seguimiento: "info",
  proxima_cohorte: "neutro",
};
