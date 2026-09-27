import type { EtapaDeal } from "@/lib/db/schema";

/**
 * La tabla de transiciones de etapa de un deal, como DATO (ADR 0037, structure.md
 * §3.1, adoptada por Mani el 24-sep). Que movimiento entre etapas es legal se lee
 * de esta lista; **no hay una cadena de `if` que lo decida en otra parte**, porque
 * dos lugares respondiendo "¿se puede mover de X a Y?" con reglas distintas es un
 * numero callado que esta mal (la familia del ticket 025 y del centinela del ano 1).
 *
 * Esto es SOLO la lista blanca. No valida requisitos (ticket 044: que haya producto,
 * fecha o abono), no mueve nada (ticket 045: `moverEtapa()`, el unico que escribe
 * `deals.etapa`). Aca solo vive "¿esta flecha existe en el diagrama?".
 *
 * Reglas duras que la forma de la tabla tiene que sostener, y que los tests muerden:
 * - `completo` es terminal: la unica flecha que SALE de el es A2 (a `abonado`), y
 *   NUNCA llega a `cierre_perdido` (un reembolso es otro flujo, no una perdida).
 * - `cierre_perdido` (P) llega desde las NUEVE etapas abiertas — 1 a 7, 9 y 11 —,
 *   nunca desde `completo`.
 * - La recuperacion (R) desde `cierre_perdido` va SOLO a `en_contacto`, `agendado` o
 *   `proxima_cohorte`: a 5-8 solo se entra por un evento (Grain, abono), no a mano.
 * - Ninguna regla compara numeros de etapa ni posiciones de arreglo: cada etapa se
 *   nombra una por una. El "numero" de structure.md es un nombre, no un orden
 *   (Re-agenda viene despues de Agendado, Seguimiento despues de Atendido).
 */

/** Quien dispara una transicion: el CRM al pasar el evento, una persona, o cualquiera. */
export type QuienMueve = "sistema" | "closer" | "ambos";

/**
 * Que clase de movimiento es. `avance` sigue el camino, `perdida` es P (a Cierre
 * Perdido), `recuperacion` es R (sale de Cierre Perdido) y `reversion` es deshacer
 * un hecho contable (A1, A2) o un sentido (T15 el sí que se echa atras, T29 la
 * llamada que no alcanzo). Las reversiones son una SEGUNDA lista explicita, no una
 * excepcion a la lista blanca: una flecha de reversion sigue siendo una flecha que
 * la tabla enumera, y el test la exige por su id.
 */
export type ClaseDeMovimiento = "avance" | "perdida" | "recuperacion" | "reversion";

export type Transicion = {
  /** El id del diagrama (T1..T29, P, R, A1, A2). T11 quedo reemplazada y no existe. */
  id: string;
  de: EtapaDeal;
  a: EtapaDeal;
  quien: QuienMueve;
  clase: ClaseDeMovimiento;
};

/**
 * La lista blanca completa. Los destinos "u 8" de la tabla (T5, T13/T14, T17, T26)
 * se parten en una fila por destino: `abonado` y `completo` son etapas distintas y
 * la lista no las junta con una barra. Igual T19/T20/T21 (a `proxima_cohorte` desde
 * tres origenes) son tres filas con el mismo id compuesto de la tabla.
 *
 * A1 (`abonado` → la etapa previa) se modela como una fila por cada etapa desde la
 * que un deal pudo entrar a `abonado`: `en_contacto` (T5), `atendido` (T13),
 * `compromiso_verbal` (T16) y `seguimiento` (T26). Se anula el unico abono y el deal
 * vuelve a donde estaba antes de que la plata lo moviera; como esa etapa previa no
 * se guarda en la tabla de transiciones, se admiten las cuatro de las que se pudo
 * llegar y el llamador (ticket 045) sabra a cual volver mirando el historial.
 */
export const TRANSICIONES: readonly Transicion[] = [
  // Antes de la llamada
  { id: "T1", de: "pendiente_setteo", a: "en_contacto", quien: "closer", clase: "avance" },
  { id: "T2", de: "pendiente_setteo", a: "agendado", quien: "ambos", clase: "avance" },
  { id: "T3", de: "en_contacto", a: "agendado", quien: "ambos", clase: "avance" },
  { id: "T4", de: "en_contacto", a: "compromiso_verbal", quien: "closer", clase: "avance" },
  { id: "T5", de: "en_contacto", a: "abonado", quien: "sistema", clase: "avance" },
  { id: "T5", de: "en_contacto", a: "completo", quien: "sistema", clase: "avance" },
  { id: "T6", de: "pendiente_reagenda", a: "agendado", quien: "ambos", clase: "avance" },
  { id: "T7", de: "pendiente_reagenda", a: "atendido", quien: "sistema", clase: "avance" },
  { id: "T8", de: "agendado", a: "pendiente_reagenda", quien: "sistema", clase: "avance" },
  // Mover una cita antes de que ocurra no es avanzar ni retroceder: es una self-transicion legal.
  { id: "T9", de: "agendado", a: "agendado", quien: "sistema", clase: "avance" },
  { id: "T10", de: "agendado", a: "atendido", quien: "sistema", clase: "avance" },
  // T11 quedo reemplazada por Seguimiento (T24) el 24-sep: no se incluye.

  // La llamada y el pago
  { id: "T12", de: "atendido", a: "compromiso_verbal", quien: "closer", clase: "avance" },
  { id: "T13", de: "atendido", a: "abonado", quien: "sistema", clase: "avance" },
  { id: "T14", de: "atendido", a: "completo", quien: "sistema", clase: "avance" },
  // T15: el sí de Compromiso se echa para atras pero sigue interesado — reversion, vuelve a re-contactar.
  { id: "T15", de: "compromiso_verbal", a: "seguimiento", quien: "closer", clase: "reversion" },
  { id: "T16", de: "compromiso_verbal", a: "abonado", quien: "sistema", clase: "avance" },
  { id: "T17", de: "compromiso_verbal", a: "completo", quien: "sistema", clase: "avance" },
  { id: "T18", de: "abonado", a: "completo", quien: "sistema", clase: "avance" },

  // A Proxima Cohorte desde 2, 5 o 6 (T19, T20, T21)
  { id: "T19", de: "en_contacto", a: "proxima_cohorte", quien: "closer", clase: "avance" },
  { id: "T20", de: "atendido", a: "proxima_cohorte", quien: "closer", clase: "avance" },
  { id: "T21", de: "compromiso_verbal", a: "proxima_cohorte", quien: "closer", clase: "avance" },

  // Proxima Cohorte vuelve al camino cuando su cohorte abre
  { id: "T22", de: "proxima_cohorte", a: "en_contacto", quien: "closer", clase: "avance" },
  { id: "T23", de: "proxima_cohorte", a: "agendado", quien: "ambos", clase: "avance" },

  // Seguimiento (la 11), despues de Atendido
  { id: "T24", de: "atendido", a: "seguimiento", quien: "closer", clase: "avance" },
  { id: "T25", de: "seguimiento", a: "compromiso_verbal", quien: "closer", clase: "avance" },
  { id: "T26", de: "seguimiento", a: "abonado", quien: "sistema", clase: "avance" },
  { id: "T26", de: "seguimiento", a: "completo", quien: "sistema", clase: "avance" },
  { id: "T27", de: "seguimiento", a: "agendado", quien: "ambos", clase: "avance" },
  { id: "T28", de: "seguimiento", a: "proxima_cohorte", quien: "closer", clase: "avance" },
  // T29: la llamada no alcanzo y hace falta otra — reversion de Atendido a Re-agenda, con motivo.
  { id: "T29", de: "atendido", a: "pendiente_reagenda", quien: "closer", clase: "reversion" },

  // P: Cierre Perdido desde las NUEVE etapas abiertas (1 a 7, 9 y 11). Nunca desde completo.
  { id: "P", de: "pendiente_setteo", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "en_contacto", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "pendiente_reagenda", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "agendado", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "atendido", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "compromiso_verbal", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "abonado", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "proxima_cohorte", a: "cierre_perdido", quien: "closer", clase: "perdida" },
  { id: "P", de: "seguimiento", a: "cierre_perdido", quien: "closer", clase: "perdida" },

  // R: recuperar un perdido, SOLO a 2, 4 o 9
  { id: "R", de: "cierre_perdido", a: "en_contacto", quien: "closer", clase: "recuperacion" },
  { id: "R", de: "cierre_perdido", a: "agendado", quien: "closer", clase: "recuperacion" },
  { id: "R", de: "cierre_perdido", a: "proxima_cohorte", quien: "closer", clase: "recuperacion" },

  // A1: se anula el unico abono y Abonado vuelve a su etapa previa (ver el comentario de arriba).
  { id: "A1", de: "abonado", a: "en_contacto", quien: "sistema", clase: "reversion" },
  { id: "A1", de: "abonado", a: "atendido", quien: "sistema", clase: "reversion" },
  { id: "A1", de: "abonado", a: "compromiso_verbal", quien: "sistema", clase: "reversion" },
  { id: "A1", de: "abonado", a: "seguimiento", quien: "sistema", clase: "reversion" },
  // A2: se anula un abono de Completo y reaparece saldo. La UNICA flecha que sale de completo.
  { id: "A2", de: "completo", a: "abonado", quien: "sistema", clase: "reversion" },
] as const;

/** La transicion `de → a` si existe en la lista blanca, o `undefined` si esa flecha no existe. */
export function transicion(de: EtapaDeal, a: EtapaDeal): Transicion | undefined {
  return TRANSICIONES.find((t) => t.de === de && t.a === a);
}

/** ¿Es legal mover un deal de `de` a `a`? */
export function transicionPermitida(de: EtapaDeal, a: EtapaDeal): boolean {
  return transicion(de, a) !== undefined;
}

/** El id de la transicion `de → a` (T1..T29, P, R, A1, A2), o `undefined` si no existe. */
export function idDeTransicion(de: EtapaDeal, a: EtapaDeal): string | undefined {
  return transicion(de, a)?.id;
}
