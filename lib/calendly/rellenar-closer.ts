import { and, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { calls, deals, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { editarConRastro } from "@/lib/crm/rastro";
import { vigente } from "@/lib/queries/vigente";
import { ORIGEN_DE_SUELTA_ASIGNABLE } from "./suelta";
import { closerHost } from "./emparejar-llamada";
import { closersConCalendly, darDealAlHost } from "./colgar-llamada";

/** Etapas en las que un deal ya no recibe el deal de una cita (ADR 0037, ADR 0038). */
const ETAPAS_CERRADAS: EtapaDeal[] = ["ganado_completo", "cierre_perdido"];

/**
 * El unico escritor del closer de una llamada: pone `closer_user_id` con rastro. Lo
 * reusan el relleno masivo y la asignacion de una cuenta de Calendly a una membresia,
 * para que haya una sola forma de escribir ese campo.
 */
async function escribirCloserDeLlamada(
  tx: Db,
  llamada: { callId: string; etiqueta: string | null },
  userId: string,
  actorId: string | null,
): Promise<void> {
  await editarConRastro(
    {
      db: tx,
      tabla: calls,
      nombreTabla: "calls",
      actorId,
      etiqueta: llamada.etiqueta ?? llamada.callId,
    },
    llamada.callId,
    { closerUserId: userId },
  );
}

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
        await escribirCloserDeLlamada(tx, { callId: fila.callId, etiqueta: fila.etiqueta }, host, opciones.actorId);
      }
    }
    return { casan, noCasan };
  });
}

/**
 * Al vincular una cuenta de Calendly a una membresia (ADR 0049, ADR 0074), las citas que
 * esa host ya hospedaba quedaban sin closer porque en su momento no habia a quien atribuir.
 * Esta funcion las repara dentro de la MISMA transaccion del guardado:
 *
 *  - Toda llamada vigente de ESE programa con origen Calendly, sin closer y cuyo
 *    `calendly_host_email` es el correo recien vinculado pasa a tener `closer_user_id` = el
 *    dueño de la membresia, con rastro (reusa el escritor comun).
 *  - Si ademas la cita es a futuro y cuelga de un deal ABIERTO, el deal pasa a la host como
 *    si la cita acabara de entrar: `darDealAlHost` deja al dueño anterior como setter.
 *
 * Siempre acotada por `programId` (los programas no se cruzan) y toda lectura de `calls` y
 * `deals` pasa por `vigente(...)`.
 */
export async function asignarLlamadasDelHost(
  tx: Db,
  datos: { programId: string; correo: string; userId: string; actorId: string },
): Promise<void> {
  const correo = datos.correo.toLowerCase();
  const filas = await tx
    .select({
      callId: calls.id,
      etiqueta: calls.emailLead,
      dealId: calls.dealId,
      fechaAgenda: calls.fechaAgenda,
    })
    .from(calls)
    .where(
      and(
        eq(calls.programId, datos.programId),
        eq(calls.origen, ORIGEN_DE_SUELTA_ASIGNABLE),
        isNull(calls.closerUserId),
        eq(sql`lower(${calls.calendlyHostEmail})`, correo),
        vigente(calls),
      ),
    );

  const ahora = new Date();
  for (const fila of filas) {
    await escribirCloserDeLlamada(tx, { callId: fila.callId, etiqueta: fila.etiqueta }, datos.userId, datos.actorId);

    const aFuturo = fila.fechaAgenda != null && fila.fechaAgenda > ahora;
    if (!aFuturo || fila.dealId === null) continue;

    const [deal] = await tx
      .select({ id: deals.id, ownerUserId: deals.ownerUserId })
      .from(deals)
      .where(
        and(
          eq(deals.id, fila.dealId),
          eq(deals.programId, datos.programId),
          notInArray(deals.etapa, ETAPAS_CERRADAS),
          vigente(deals),
        ),
      );
    if (!deal) continue;
    await darDealAlHost(tx, deal.id, deal.ownerUserId, datos.userId, fila.etiqueta ?? deal.id);
  }
}
