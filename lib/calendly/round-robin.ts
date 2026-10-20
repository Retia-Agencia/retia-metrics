import { eq } from "drizzle-orm";
import { z } from "zod";
import { changeLog, miembrosPrograma, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esViolacionUnica } from "@/lib/db/errores";
import { resolverRoundRobin, tokenDeCalendlyDelPrograma } from "./escritura";
import type { FetchLike } from "./cita";

/**
 * El round robin de un programa en Integraciones › Calendly (ADR 0098, ticket 289): su URL
 * de agenda y la marca de org compartida. ES el unico escritor de `programs.calendly_url`,
 * `programs.calendly_event_type` y `programs.calendly_org_compartida`, con sus filas de
 * `change_log` en la misma transaccion (molde del catalogo, ADR 0012).
 *
 * Al guardar con URL se resuelve a la URI del event type por la API con el token del
 * programa (`resolverRoundRobin`); cero o mas de uno es un 422 y no se guarda nada. Un event
 * type es de UN solo programa (ADR 0098 punto 4): se rechaza (422) si la URI ya es el evento
 * personal de alguna membresia, y la violacion del indice unico entre programas sale como
 * 409. URL vacia limpia la URL y el event type.
 */

const esquema = z.object({
  calendlyUrl: z
    .string()
    .trim()
    .transform((valor) => (valor.length === 0 ? null : valor))
    .pipe(z.string().url("La URL del round robin no es válida.").nullable()),
  orgCompartida: z.boolean(),
});

export type EntradaRoundRobin = z.input<typeof esquema>;

export async function guardarRoundRobin(
  db: Db,
  actorId: string,
  programId: string,
  input: EntradaRoundRobin,
  opciones: { fetch?: FetchLike } = {},
): Promise<void> {
  return normalizando(async () => {
    const datos = esquema.parse(input);
    const [actual] = await db
      .select({
        id: programs.id,
        nombre: programs.nombre,
        calendlyUrl: programs.calendlyUrl,
        calendlyEventType: programs.calendlyEventType,
        orgCompartida: programs.calendlyOrgCompartida,
      })
      .from(programs)
      .where(eq(programs.id, programId));
    if (!actual) throw new ErrorDeApp("No existe un programa con ese id.", 404);

    // Con URL se resuelve el event type; sin URL (vacia) se limpia todo.
    let eventTypeNuevo: string | null = null;
    if (datos.calendlyUrl !== null) {
      const token = await tokenDeCalendlyDelPrograma(db, programId);
      eventTypeNuevo = await resolverRoundRobin(token, datos.calendlyUrl, opciones.fetch);
      // Un round robin no puede ser el evento personal de nadie (ADR 0098 punto 4). El
      // indice ataja el choque entre dos programas; este atrapa el choque entre tablas.
      const [choque] = await db
        .select({ id: miembrosPrograma.id })
        .from(miembrosPrograma)
        .where(eq(miembrosPrograma.calendlyEventType, eventTypeNuevo))
        .limit(1);
      if (choque) throw new ErrorDeApp("Ese evento ya es el evento personal de alguien.", 422);
    }

    const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = [];
    if (actual.calendlyUrl !== datos.calendlyUrl) {
      cambios.push({ campo: "calendlyUrl", anterior: actual.calendlyUrl, nuevo: datos.calendlyUrl });
    }
    if (actual.calendlyEventType !== eventTypeNuevo) {
      cambios.push({ campo: "calendlyEventType", anterior: actual.calendlyEventType, nuevo: eventTypeNuevo });
    }
    if (actual.orgCompartida !== datos.orgCompartida) {
      cambios.push({ campo: "calendlyOrgCompartida", anterior: String(actual.orgCompartida), nuevo: String(datos.orgCompartida) });
    }
    if (cambios.length === 0) return;

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(programs)
          .set({ calendlyUrl: datos.calendlyUrl, calendlyEventType: eventTypeNuevo, calendlyOrgCompartida: datos.orgCompartida })
          .where(eq(programs.id, programId));
        for (const cambio of cambios) {
          await tx.insert(changeLog).values({
            tabla: "programs",
            registroId: programId,
            etiqueta: actual.nombre,
            campo: cambio.campo,
            valorAnterior: cambio.anterior,
            valorNuevo: cambio.nuevo,
            origen: "app" as const,
            userId: actorId,
          });
        }
      });
    } catch (e) {
      // El indice unico parcial sobre `programs.calendly_event_type`: ese event type ya es
      // el round robin de otro programa (ADR 0098 punto 4).
      if (esViolacionUnica(e)) throw new ErrorDeApp("Ese evento ya es de otro programa.", 409);
      throw e;
    }
  });
}
