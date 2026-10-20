import { and, eq } from "drizzle-orm";
import { miembrosPrograma, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * ¿Una cita de Calendly es de ESTE programa? (ADR 0098, ticket 289).
 *
 * El webhook de un programa se suscribe a TODA su organizacion de Calendly. En Retia cada
 * programa tiene su propia org, asi que toda cita es del programa (`orgCompartida = false`).
 * En EstadoX no: Second Brain Juridico comparte la org con otros programas, y una cita de
 * OTRO evento no es suya.
 *
 * Los eventos del programa son su round robin (`programs.calendly_event_type`) union el
 * evento personal de cada membresia activa (`miembros_programa.calendly_event_type`). El
 * filtro solo aplica con la org declarada como compartida; sin ella, todo cuenta como hoy.
 *
 * Esto es lo PURO; `conjuntoDeEventosDelPrograma` lee el conjunto de la base. Antes de
 * preguntar pertenencia, lo que el CRM YA conoce (una huella existente o una reagenda de
 * una llamada conocida) se procesa como siempre, sin pasar por aqui.
 */

/** El conjunto de eventos de un programa y si su org es compartida. */
export interface PertenenciaDelPrograma {
  /** La org de Calendly del programa la comparten otros programas. */
  orgCompartida: boolean;
  /** La URI del round robin (`programs.calendly_event_type`), o `null` si no se configuro. */
  roundRobin: string | null;
  /** Las URIs de los eventos personales de las membresias activas. */
  personales: string[];
}

/**
 * ¿El `eventType` de una cita es del programa? Con la org NO compartida, siempre: el
 * programa es dueño de toda su org. Con la org compartida, solo si el evento es el round
 * robin o el evento personal de un miembro activo. Un `eventType` nulo nunca pertenece
 * cuando la org es compartida: sin saber de que evento es, no se adopta como propio.
 */
export function eventoEsDelPrograma(datos: {
  eventType: string | null;
  orgCompartida: boolean;
  roundRobin: string | null;
  personales: readonly string[];
}): boolean {
  if (!datos.orgCompartida) return true;
  if (datos.eventType === null) return false;
  if (datos.roundRobin !== null && datos.eventType === datos.roundRobin) return true;
  return datos.personales.includes(datos.eventType);
}

/**
 * Lee de la base el conjunto de eventos del programa: su round robin y la marca de org
 * compartida de `programs`, y los eventos personales de sus membresias ACTIVAS con evento
 * configurado.
 */
export async function conjuntoDeEventosDelPrograma(
  db: Db,
  programId: string,
): Promise<PertenenciaDelPrograma> {
  const [programa] = await db
    .select({ roundRobin: programs.calendlyEventType, orgCompartida: programs.calendlyOrgCompartida })
    .from(programs)
    .where(eq(programs.id, programId));
  const personales = await db
    .select({ eventType: miembrosPrograma.calendlyEventType })
    .from(miembrosPrograma)
    .where(and(eq(miembrosPrograma.programId, programId), eq(miembrosPrograma.activo, true)));
  return {
    orgCompartida: programa?.orgCompartida ?? false,
    roundRobin: programa?.roundRobin ?? null,
    personales: personales.flatMap((m) => (m.eventType ? [m.eventType] : [])),
  };
}
