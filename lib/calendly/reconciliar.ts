import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { calls, deals, leads, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { tokenCalendly } from "@/lib/integraciones";
import { vigente } from "@/lib/queries/vigente";
import { normalizarEmail } from "@/lib/sheets/mapeo";
import { resolverCitaDeEnvio } from "./resolver-cita";
import { uuidDeHuella } from "./huella";
import { sueltaPorAsignar } from "./suelta";
import {
  candidatosPorCorreo,
  closersConCalendly,
  colgarSueltaEnDeal,
  dealDelEnvioConLaCita,
  efectoSobreElDeal,
  registrarLlamadaDeCalendly,
} from "./colgar-llamada";
import { closerHost, emparejarLlamada } from "./emparejar-llamada";

/** ponytail: una cita suelta durante un dia completo ya es una falla operativa, no una carrera normal. */
export const HORAS_PARA_ALERTAR_CITA_SUELTA = 24;
const ETAPAS_POR_REPARAR = ["registrado", "calificado", "potencial"] as const;

export interface ResumenReconciliacionCalendly {
  sueltas: number;
  colgadas: number;
  dealsReparados: number;
  dudas: number;
  sinLlamada: number;
}

export interface AlarmasCalendly {
  llamadasSueltasViejas: number;
  dealsConCitaSinLlamada: number;
}

/** Lectura pura para Salud: las dos roturas que el barrido debe dejar en cero. */
export async function alarmasCalendly(db: Db, programId: string, ahora: Date = new Date()): Promise<AlarmasCalendly> {
  const limite = new Date(ahora.getTime() - HORAS_PARA_ALERTAR_CITA_SUELTA * 3_600_000);
  const sueltas = await db
    .select({ creadaEn: calls.createdAt })
    .from(calls)
    .where(and(eq(calls.programId, programId), sueltaPorAsignar(), eq(calls.resultado, "agendada"), vigente(calls)));
  const envios = await db
    .select({ leadId: submissions.leadId, respuestas: submissions.respuestas })
    .from(submissions)
    .innerJoin(sources, and(eq(sources.id, submissions.sourceId), eq(sources.programId, programId)));
  const uuidsPorLead = new Map<string, Set<string>>();
  for (const envio of envios) {
    if (!envio.leadId) continue;
    const uuids = uuidsPorLead.get(envio.leadId) ?? new Set<string>();
    for (const cita of linksConUuid(envio.respuestas)) uuids.add(cita.uuid);
    uuidsPorLead.set(envio.leadId, uuids);
  }
  const bajos = uuidsPorLead.size === 0 ? [] : await db
    .select({ id: deals.id, leadId: deals.leadId })
    .from(deals)
    .where(and(
      eq(deals.programId, programId),
      inArray(deals.leadId, [...uuidsPorLead.keys()]),
      inArray(deals.etapa, [...ETAPAS_POR_REPARAR]),
      vigente(deals),
    ));
  const llamadas = await db
    .select({ dealId: calls.dealId, huella: calls.huellaFila })
    .from(calls)
    .where(and(eq(calls.programId, programId), vigente(calls)));
  const conLlamada = new Set(llamadas.filter((c) => c.dealId && uuidDeHuella(c.huella)).map((c) => `${c.dealId}:${uuidDeHuella(c.huella)}`));
  return {
    llamadasSueltasViejas: sueltas.filter((c) => c.creadaEn <= limite).length,
    dealsConCitaSinLlamada: bajos.filter((deal) =>
      [...(uuidsPorLead.get(deal.leadId) ?? [])].some((uuid) => !conLlamada.has(`${deal.id}:${uuid}`)),
    ).length,
  };
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
const enTransaccion = <T>(db: Db, fn: (tx: Db) => Promise<T>) =>
  (db as unknown as Transaccion).transaction(fn);

function linksConUuid(valor: unknown): { link: string; uuid: string }[] {
  if (typeof valor === "string") {
    const hallazgo = valor.match(/\/invitees\/([^/?#\s"']+)/i);
    return hallazgo ? [{ link: valor, uuid: hallazgo[1] }] : [];
  }
  if (Array.isArray(valor)) return valor.flatMap(linksConUuid);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(linksConUuid);
  return [];
}

/**
 * Unico barrido que reconcilia formulario y Calendly (ticket 363). Primero manda el UUID
 * del invitado; solo sin esa prueba cae al correo confirmado. Nombre y telefono nunca
 * asignan. Se puede acotar a los leads que acaba de tocar la ingesta; el cron no acota.
 */
export async function reconciliarCalendly(
  db: Db,
  programId: string,
  opciones: { leadIds?: readonly string[]; reparar?: boolean } = {},
): Promise<ResumenReconciliacionCalendly> {
  const alcance = opciones.leadIds ? new Set(opciones.leadIds) : null;
  const resumen: ResumenReconciliacionCalendly = { sueltas: 0, colgadas: 0, dealsReparados: 0, dudas: 0, sinLlamada: 0 };
  const sueltas = await db
    .select({
      id: calls.id,
      programId: calls.programId,
      emailLead: calls.emailLead,
      host: calls.calendlyHostEmail,
      closerUserId: calls.closerUserId,
      fechaAgenda: calls.fechaAgenda,
      huella: calls.huellaFila,
    })
    .from(calls)
    .where(and(eq(calls.programId, programId), sueltaPorAsignar(), eq(calls.resultado, "agendada"), vigente(calls)));
  resumen.sueltas = sueltas.length;
  const closers = await closersConCalendly(db, programId);

  for (const llamada of sueltas) {
    const uuid = uuidDeHuella(llamada.huella);
    const exacto = uuid ? await dealDelEnvioConLaCita(db, programId, uuid) : null;
    let dealId: string | null = exacto && (!alcance || alcance.has(exacto.leadId)) ? exacto.dealId : null;
    if (uuid && !exacto) {
      const patron = `%/invitees/${uuid.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const posibles = await db
        .selectDistinct({ id: deals.id })
        .from(submissions)
        .innerJoin(sources, and(eq(sources.id, submissions.sourceId), eq(sources.programId, programId)))
        .innerJoin(deals, and(eq(deals.leadId, submissions.leadId), eq(deals.programId, programId)))
        .where(and(
          // La misma forma usada por dealDelEnvioConLaCita; aqui solo contamos la duda.
          sql`${submissions.respuestas}::text like ${patron}`,
          notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
          vigente(deals),
        ));
      if (posibles.length > 1) resumen.dudas++;
    }
    if (!dealId && !uuid) {
      const correo = normalizarEmail(llamada.emailLead);
      if (correo) {
        const decision = emparejarLlamada(
          { correoInvitado: correo, correoHost: llamada.host },
          await candidatosPorCorreo(db, programId, correo),
          closers,
        );
        if (decision.tipo === "colgada" && (!alcance || alcance.has(decision.leadId))) dealId = decision.dealId;
      }
    }
    if (!dealId) continue;
    const [deal] = await db
      .select({ id: deals.id, programId: deals.programId, etapa: deals.etapa, cohortId: deals.cohortId })
      .from(deals)
      .where(and(eq(deals.id, dealId), vigente(deals)));
    if (!deal) continue;
    await enTransaccion(db, async (tx) => {
      await colgarSueltaEnDeal(tx, llamada, deal, closerHost(llamada.host, closers), null);
    });
    resumen.colgadas++;
  }

  // ponytail: la reparacion de deals lee todos los envios y puede llamar a Calendly; el webhook la omite (reparar: false) y la corren la ingesta (acotada) y el cron.
  if (opciones.reparar === false) return resumen;

  const envios = await db
    .select({ leadId: submissions.leadId, respuestas: submissions.respuestas })
    .from(submissions)
    .innerJoin(sources, and(eq(sources.id, submissions.sourceId), eq(sources.programId, programId)))
    .where(alcance && alcance.size > 0 ? inArray(submissions.leadId, [...alcance]) : sql`true`);
  const porUuid = new Map<string, { link: string; leadIds: Set<string> }>();
  for (const envio of envios) {
    if (!envio.leadId) continue;
    for (const cita of linksConUuid(envio.respuestas)) {
      const actual = porUuid.get(cita.uuid) ?? { link: cita.link, leadIds: new Set<string>() };
      actual.leadIds.add(envio.leadId);
      porUuid.set(cita.uuid, actual);
    }
  }
  const token = porUuid.size > 0 ? await tokenCalendly(db, programId) : null;
  for (const [uuid, cita] of porUuid) {
    const candidatas = await db
      .select({ id: deals.id, leadId: deals.leadId, cohortId: deals.cohortId, etapa: deals.etapa, email: leads.emailNormalizado })
      .from(deals)
      .innerJoin(leads, eq(leads.id, deals.leadId))
      .where(and(
        eq(deals.programId, programId),
        inArray(deals.leadId, [...cita.leadIds]),
        notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
        vigente(deals),
      ));
    if (candidatas.length !== 1) {
      if (candidatas.length > 1) resumen.dudas++;
      continue;
    }
    const deal = candidatas[0];
    if (!ETAPAS_POR_REPARAR.includes(deal.etapa as typeof ETAPAS_POR_REPARAR[number])) continue;
    const [llamada] = await db
      .select({ id: calls.id, dealId: calls.dealId, fechaAgenda: calls.fechaAgenda, host: calls.calendlyHostEmail })
      .from(calls)
      .where(and(
        eq(calls.programId, programId),
        eq(calls.huellaFila, `calendly:${uuid}`),
        eq(calls.resultado, "agendada"),
        vigente(calls),
      ));
    if (llamada?.dealId === deal.id) {
      const efecto = await efectoSobreElDeal(db, deal.id, llamada.id, closerHost(llamada.host, closers), deal.email, llamada.fechaAgenda);
      if (efecto.movioAAgendado) resumen.dealsReparados++;
      continue;
    }
    if (llamada) continue;
    resumen.sinLlamada++;
    if (!token) continue;
    const resuelta = await resolverCitaDeEnvio({ token, correo: deal.email, linkAgenda: cita.link });
    if (resuelta.estado !== "vigente") continue;
    const registrada = await registrarLlamadaDeCalendly(db, programId, {
      uuidInvitado: resuelta.uuidInvitado,
      inicio: resuelta.inicio,
      correoInvitado: deal.email,
      correoHost: resuelta.correoHost ?? null,
    });
    if (registrada.tipo === "colgada") resumen.dealsReparados++;
  }
  return resumen;
}
