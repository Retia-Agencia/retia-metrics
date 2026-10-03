import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { calls, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { vigente } from "@/lib/queries/vigente";
import { ORIGEN_DE_SUELTA_ASIGNABLE } from "./suelta";
import { closerHost } from "./emparejar-llamada";
import { closersConCalendly } from "./colgar-llamada";

export interface LlamadaSinCloserQueNoCasa {
  callId: string;
  programa: string;
  hostEmail: string;
}

export async function rellenarCloserDeLlamadas(
  db: Db,
  opciones: { aplicar: boolean; actorId: string },
): Promise<{ casan: number; noCasan: LlamadaSinCloserQueNoCasa[] }> {
  return db.transaction(async (tx) => {
    const filas = await tx
      .select({
        callId: calls.id,
        programId: calls.programId,
        programa: programs.slug,
        hostEmail: calls.calendlyHostEmail,
        etiqueta: calls.emailLead,
      })
      .from(calls)
      .innerJoin(programs, eq(programs.id, calls.programId))
      .where(
        and(
          eq(calls.origen, ORIGEN_DE_SUELTA_ASIGNABLE),
          isNull(calls.closerUserId),
          isNotNull(calls.calendlyHostEmail),
          vigente(calls),
        ),
      );
    const closersPorPrograma = new Map<string, Awaited<ReturnType<typeof closersConCalendly>>>();
    for (const programId of new Set(filas.map((fila) => fila.programId))) {
      closersPorPrograma.set(programId, await closersConCalendly(tx, programId));
    }

    const noCasan: LlamadaSinCloserQueNoCasa[] = [];
    let casan = 0;
    for (const fila of filas) {
      const host = closerHost(fila.hostEmail, closersPorPrograma.get(fila.programId) ?? []);
      if (host === null) {
        noCasan.push({ callId: fila.callId, programa: fila.programa, hostEmail: fila.hostEmail! });
        continue;
      }
      casan += 1;
      if (opciones.aplicar) {
        await editarConRastro(
          {
            db: tx,
            tabla: calls,
            nombreTabla: "calls",
            actorId: opciones.actorId,
            etiqueta: fila.etiqueta ?? fila.callId,
          },
          fila.callId,
          { closerUserId: host },
        );
      }
    }
    return { casan, noCasan };
  });
}
