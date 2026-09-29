import type { EtapaDeal } from "@/lib/deals/etapas";

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
  pendiente_setteo: "neutro",
  en_contacto: "neutro",
  agendado: "info",
  pendiente_reagenda: "alerta",
  atendido: "info",
  seguimiento: "info",
  compromiso_verbal: "alerta",
  abonado: "exito",
  completo: "exito",
  proxima_cohorte: "neutro",
  cierre_perdido: "peligro",
};
