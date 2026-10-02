import type { EtapaDeal } from "@/lib/db/schema";
import { ESTADO_CON_CALENDLY, type Calificacion } from "./calificacion";

/**
 * La etapa en que nace el deal de un envío (ADR 0069, ticket 117 enmendado). La decide el
 * CRM con TRES hechos que el formulario ya mide, la misma regla para todos los programas y
 * la misma de 30X (`docs/manual-gestion-comercial.md` §3.1):
 *
 * | Formulario         | Calidad        | Agendó | Nace en      |
 * |--------------------|----------------|--------|--------------|
 * | cualquiera         | cualquiera     | sí     | Agendado     |
 * | parcial o completo | High           | no     | Calificado   |
 * | completo           | Low, Mid o ∅   | no     | Registrado   |
 * | parcial            | Low, Mid o ∅   | no     | Potencial    |
 *
 * - **La variable `estado` del formulario ya no decide nada** (ADR 0069 punto 5). Lo único
 *   que se lee de `calificacion` es el hecho de agendar, que pone el CÓDIGO del adaptador
 *   (`ESTADO_CON_CALENDLY`), no el formulario.
 * - **Ningún envío se descarta** (GC-27): no hay combinación que no abra deal. Un completo
 *   sin calidad cae en Registrado y un parcial sin calidad en Potencial.
 * - **`lead_value` no enruta** (ADR 0069 punto 4): ni siquiera entra aquí.
 * - Un parcial Low no está en la tabla del ADR: nace en Potencial, porque Registrado es
 *   "terminó el formulario" (manual §3.1).
 *
 * Funciones PURAS: la regla de deals (`regla-de-deals.ts`) decide con ellas y el embudo
 * del formulario (`lib/queries/embudo-formulario.ts`) cuenta "agendó" con la misma.
 */

/** Las cuatro puertas por las que el sistema abre un deal (`NACIMIENTOS.sistema` del motor). */
export type EtapaDeEntrada = Extract<EtapaDeal, "potencial" | "registrado" | "calificado" | "agendado">;

/** Lo que la regla necesita saber del envío que la dispara. */
export interface HechosDeEntrada {
  esParcial: boolean;
  /** Si la persona agendó (ver `agendoElEnvio`). */
  agendo: boolean;
  /** `lead_quality` tal como llegó del formulario (High, Low, Mid), o nulo. */
  leadQuality: string | null;
}

/**
 * ¿El envío agendó? Es el hecho que pone el adaptador cuando la pregunta de agenda del
 * mapeo trae un link de Calendly (ADR 0061 punto 4, ADR 0069 punto 3). Es la ÚNICA
 * lectura de `calificacion` que sobrevive al ADR 0069.
 */
export function agendoElEnvio(calificacion: Calificacion | null): boolean {
  return calificacion?.trim() === ESTADO_CON_CALENDLY;
}

/** `High`, sin importar mayúsculas ni espacios. Cualquier otro valor, o ninguno, no lo es. */
export function esCalidadAlta(leadQuality: string | null): boolean {
  return leadQuality?.trim().toLowerCase() === "high";
}

/** La etapa de entrada para un envío (tabla de arriba). */
export function etapaDeEntrada(hechos: HechosDeEntrada): EtapaDeEntrada {
  if (hechos.agendo) return "agendado";
  if (esCalidadAlta(hechos.leadQuality)) return "calificado";
  return hechos.esParcial ? "potencial" : "registrado";
}
