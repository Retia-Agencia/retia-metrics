import { and, eq, sql } from "drizzle-orm";
import { deals, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import type { Rol } from "@/lib/auth/roles";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { vigente } from "@/lib/queries/vigente";
import { resolverContra } from "@/lib/ingesta/adaptador-typeform";
import { ESTADO_CON_CALENDLY } from "@/lib/ingesta/calificacion";
import { campoAgendaDeFuente } from "@/lib/ingesta/mapeo-webhook";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";
import { aplicarReglaDeDeal, notaDeCita, type AccionDeDeal } from "@/lib/ingesta/regla-de-deals";
import { uuidInvitadoDelLink, type FetchLike } from "./cita";
import { resolverCitaDeEnvio } from "./resolver-cita";

/**
 * "Buscar llamada" (ticket 096, pedido de Mani del 28-sep): vuelve a preguntarle a
 * Calendly por la cita de un deal cuyo envio dijo "Con Calendly" pero la cita no
 * aparecio (o estaba cancelada) cuando llego. El 052 lo dejo en Calificado con una
 * nota; esto cierra el ciclo a pedido, sin esperar el webhook o la consulta periodica
 * de Calendly (A5).
 *
 * ## Mismo camino que el 052, no uno paralelo
 *
 * Si la cita aparece vigente, se aplica `aplicarReglaDeDeal` con el lead en
 * `con_calendly`: la misma llamada `agendada` con fecha real, la misma huella
 * `calendly:<uuid>` (idempotente: dos clics no crean dos llamadas) y el mismo movimiento
 * por el motor. Si no aparece, **no se escribe nada**: el resultado va a la pantalla, y
 * diez clics no dejan diez notas.
 *
 * ## Quien puede
 *
 * Cualquier sesion que VE el programa del deal (ADR 0048): un deal fuera del alcance
 * responde 404, igual que uno inexistente. No hace falta ser el dueño: el boton no
 * decide nada, solo le pide a Calendly un HECHO, y el movimiento lo hace el sistema
 * (actor `sistema`, como en el 052), por las mismas flechas del motor.
 */

export interface ActorDeBusqueda {
  userId: string;
  rol: Rol | null;
}

export type ResultadoBusqueda =
  | { encontrada: true; accion: AccionDeDeal; rechazo?: string }
  | { encontrada: false; motivo: string };

/**
 * El link de la cita en las respuestas de un envio, SOLO si la pregunta de agenda
 * configurada (`campoAgenda`) lo trae y el link tiene el uuid del invitado. Pura.
 */
export function linkDeAgendaDelEnvio(
  respuestas: Record<string, unknown> | null | undefined,
  campoAgenda: string | undefined,
): string | null {
  if (!respuestas || !campoAgenda) return null;
  const columna = resolverContra(Object.keys(respuestas), [campoAgenda]);
  if (columna === undefined) return null;
  const valor = respuestas[columna];
  if (typeof valor !== "string") return null;
  return uuidInvitadoDelLink(valor) ? valor : null;
}

export async function buscarLlamadaDelDeal(
  db: Db,
  actor: ActorDeBusqueda,
  dealId: string,
  opciones: { fetch?: FetchLike } = {},
): Promise<ResultadoBusqueda> {
  const [fila] = await db
    .select({
      programId: deals.programId,
      etapa: deals.etapa,
      leadId: leads.id,
      emailNormalizado: leads.emailNormalizado,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), vigente(deals)));

  // Inexistente, anulado o fuera del alcance: el mismo 404, sin filtrar que existe.
  if (!fila || !(await programaEnAlcance(actor.userId, actor.rol, fila.programId, db))) {
    throw new ErrorDeApp("No existe el deal.", 404);
  }
  if (fila.etapa === "ganado_completo" || fila.etapa === "cierre_perdido") {
    throw new ErrorDeApp("El deal está cerrado: no se le buscan llamadas.", 409);
  }

  const link = await linkDeAgendaMasReciente(db, fila.leadId, fila.programId);
  if (!link) {
    return { encontrada: false, motivo: "Ningún envío de este lead trae un link de Calendly." };
  }

  const [programa] = await db
    .select({ calendlyToken: programs.calendlyToken })
    .from(programs)
    .where(eq(programs.id, fila.programId));
  if (!programa?.calendlyToken) {
    return { encontrada: false, motivo: "El programa no tiene token de Calendly configurado." };
  }

  // FUERA de la transaccion: una llamada HTTP dentro retendria una conexion del pooler.
  const cita = await resolverCitaDeEnvio({
    token: programa.calendlyToken,
    correo: fila.emailNormalizado,
    linkAgenda: link,
    fetch: opciones.fetch,
  });
  if (cita.estado !== "vigente") return { encontrada: false, motivo: notaDeCita(cita) };

  const resultado = await (
    db as unknown as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }
  ).transaction((tx) =>
    aplicarReglaDeDeal(
      tx,
      {
        id: fila.leadId,
        programId: fila.programId,
        emailNormalizado: fila.emailNormalizado,
        calificacion: ESTADO_CON_CALENDLY,
      },
      cita,
    ),
  );
  return { encontrada: true, accion: resultado.accion, rechazo: resultado.rechazo };

}

/**
 * El link de agenda del envio mas reciente del lead que traiga uno. `NULLS LAST`: en
 * Postgres un `DESC` pone los nulos PRIMERO, y un parcial no tiene fecha.
 */
async function linkDeAgendaMasReciente(db: Db, leadId: string, programId: string): Promise<string | null> {
  const envios = await db
    .select({
      respuestas: submissions.respuestas,
      mapeoColumnas: sources.mapeoColumnas,
      plantillaLead: programs.plantillaLead,
    })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .innerJoin(programs, eq(programs.id, sources.programId))
    .where(and(eq(submissions.leadId, leadId), eq(sources.programId, programId)))
    .orderBy(sql`${submissions.fechaEnvio} desc nulls last`);
  for (const e of envios) {
    const campoAgenda = campoAgendaDeFuente(
      e.mapeoColumnas as MapeoColumnas | null,
      e.plantillaLead as MapeoColumnas | null,
    );
    const link = linkDeAgendaDelEnvio(e.respuestas as Record<string, unknown> | null, campoAgenda);
    if (link) return link;
  }
  return null;
}
