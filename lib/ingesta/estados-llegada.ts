import { and, eq } from "drizzle-orm";
import { estadosLlegada, type EtapaDeal } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Calificacion } from "./calificacion";

/**
 * Qué significa el Estado de llegada de un envío (ticket 117, ADR 0061): la fila de
 * `estados_llegada` de su programa. Es la UNICA respuesta a "¿este valor abre deal, y
 * dónde?"; la leen la regla de deals, el conteo de "sin estado" de la ingesta y la tab
 * Leads. Ninguna compara el valor contra un texto escrito en el código.
 */

/** Lo que la regla necesita de una fila. */
export interface EstadoDeLlegada {
  valor: string;
  /** Potencial, Registrado, Calificado o Agendado; nulo = el valor se reconoce pero no abre deal. */
  etapaEntrada: EtapaDeal | null;
  prioridad: "normal" | "alta";
  alertaMinutos: number | null;
}

/** La misma comparación que el índice único `estados_llegada_programa_valor_idx`. */
export function llaveDeEstado(valor: string): string {
  return valor.trim().toLowerCase();
}

/** Los Estados ACTIVOS de un programa, por su llave. Uno inactivo no se reconoce. */
export async function estadosDeLlegadaDelPrograma(db: Db, programId: string): Promise<Map<string, EstadoDeLlegada>> {
  const filas = await db
    .select({
      valor: estadosLlegada.valor,
      etapaEntrada: estadosLlegada.etapaEntrada,
      prioridad: estadosLlegada.prioridad,
      alertaMinutos: estadosLlegada.alertaMinutos,
    })
    .from(estadosLlegada)
    .where(and(eq(estadosLlegada.programId, programId), eq(estadosLlegada.activo, true)));
  return new Map(filas.map((f) => [llaveDeEstado(f.valor), f]));
}

/**
 * La fila de un Estado, o `null` si el envío llegó sin Estado o con uno que el programa
 * no tiene (activo). Función PURA sobre lo que ya se leyó.
 */
export function resolverEstadoDeLlegada(
  calificacion: Calificacion | null,
  estados: ReadonlyMap<string, EstadoDeLlegada>,
): EstadoDeLlegada | null {
  if (calificacion === null || calificacion.trim() === "") return null;
  return estados.get(llaveDeEstado(calificacion)) ?? null;
}

/**
 * Por qué un envío no tiene Estado reconocido, para contarlo (ADR 0061 punto 5): vacío o
 * un valor que el programa no tiene. `null` si sí lo reconoce.
 */
export function motivoSinEstado(
  calificacion: Calificacion | null,
  estados: ReadonlyMap<string, EstadoDeLlegada>,
): string | null {
  if (calificacion === null || calificacion.trim() === "") return "sin estado";
  if (resolverEstadoDeLlegada(calificacion, estados) === null) return `estado no reconocido: ${calificacion}`;
  return null;
}
