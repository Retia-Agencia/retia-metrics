import { and, asc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { calls, dealActividades, deals, leadContactos, leads, miembrosPrograma, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esViolacionUnica } from "@/lib/db/errores";
import { trabajaLeads, type Rol } from "@/lib/auth/roles";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { puedeColgarSuelta, sueltaPorAsignar } from "./suelta";
import { dealDeCodigo } from "./link-de-agenda";
import {
  codigoDeDealDelInvitado,
  rawDelInvitado,
  type CamposDeInvitadoCalendly,
} from "./evento-webhook";
import { moverEtapa, MovimientoRechazado } from "@/lib/deals/mover-etapa";
import { NOMBRE_DE_PENDIENTE, unaCitaMueveAAgendado } from "@/lib/deals/etapas";
import { dejarNotaDelSistema } from "@/lib/deals/nota-del-sistema";
import { fechaHoraEnBogota } from "@/lib/format";
import { normalizarEmail } from "@/lib/sheets/mapeo";
import { cambiarDuenoDeal } from "@/lib/deals/cambiar-dueno";
import { registrarNovedadCalendly } from "@/lib/notificaciones-calendly/notificaciones";
import { crearDealAMano } from "@/lib/deals/crear-a-mano";
import {
  closerHost,
  emparejarLlamada,
  type CloserDelPrograma,
  type DealAbierto,
  type LeadCandidato,
  type MotivoSuelta,
} from "./emparejar-llamada";

/**
 * El ESCRITOR de las llamadas de Calendly (ticket 096, ADR 0049): lee la base, le pregunta
 * al emparejador (`emparejar-llamada.ts`, puro) y escribe lo que este decidio. Es el unico
 * lugar que cuelga una llamada de Calendly de un deal o la deja suelta; el guardian
 * `tests/calendly-colgar-guardian.test.ts` lo vigila.
 *
 * Quien lo llama no importa aqui: el webhook o la consulta periodica de Calendly (A5)
 * cuando exista, y a mano el closer que asigna una suelta. La primera cita de un envio
 * "Con Calendly" NO pasa por aqui: la cuelga el 052 del lead que lleno el formulario, sin
 * duda que resolver (`lib/ingesta/regla-de-deals.ts`).
 *
 * ## El efecto sobre el deal (ADR 0049 punto 4, decision del 24-sep)
 *
 * - Si `unaCitaMueveAAgendado` lo dice (setteo, o Agendado/Atendido con pendiente), el deal pasa a Agendado por `moverEtapa()` (E4, E7, E9).
 * - En 4 se queda en Agendado; la cita queda como otra llamada con su fecha real.
 * - En 5, 6 o 7 es una segunda llamada y la etapa no cambia.
 *
 * ## El dueño (decision de Mani del 28-sep)
 *
 * El deal es de la closer HOST si esta registrada en el programa (su cuenta de Calendly en
 * la membresia). Si tenia otro dueño, pasa a la host y queda una nota del sistema en el
 * deal: es el aviso, hasta que exista el canal de notificaciones.
 *
 * La llamada toma como closer a la host registrada en el programa (ADR 0077 punto 5).
 * Solo queda sin `closer_user_id` cuando la host no tiene cuenta vinculada.
 */

/** Una cita de Calendly tal como la entrega quien la lee (webhook o consulta, A5). */
export interface CitaDeCalendly extends CamposDeInvitadoCalendly {
  /** El uuid del invitado: la huella `calendly:<uuid>` que impide duplicar. */
  uuidInvitado: string;
  inicio: Date;
  correoInvitado: string | null;
  correoHost: string | null;
  linkCalendly?: string | null;
  /** Identidad durable de la entrega; fuera del webhook basta la cita única. */
  claveEvento?: string;
}

export type LlamadaRegistrada =
  | {
      tipo: "colgada";
      callId: string;
      dealId: string;
      movioAAgendado: boolean;
      /** El dueño anterior, si la host se quedo con el deal (hay que avisarle). */
      duenoAnterior: string | null;
      rechazo?: string;
    }
  | { tipo: "suelta"; callId: string; motivo: MotivoSuelta }
  /** La cita ya estaba registrada (misma huella): no se escribe nada. */
  | { tipo: "repetida"; callId: string };

/** Desde estas etapas una llamada nueva MUEVE el deal a Agendado. La lista es UNA y vive
 * en `lib/deals/etapas.ts` (`unaCitaMueveAAgendado`): estuvo copiada en
 * tres módulos y la de la ingesta ya había divergido (hallazgo A1 del ticket 114). */

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

function enTransaccion<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  return (db as unknown as Transaccion).transaction(fn);
}

/** La huella de una cita en `calls.huella_fila`: la usan este modulo y el 052, y nadie la arma a mano. */
export const huellaDeCita = (uuidInvitado: string) => `calendly:${uuidInvitado}`;

/**
 * Los closers del programa con su cuenta de Calendly: membresia ACTIVA, usuario activo y
 * correo cargado. Es lo que `closerHost` necesita para decidir el dueño.
 */
export async function closersConCalendly(db: Db, programId: string): Promise<CloserDelPrograma[]> {
  const filas = await db
    .select({ userId: miembrosPrograma.userId, correoCalendly: miembrosPrograma.calendlyEmail, rol: users.rol })
    .from(miembrosPrograma)
    .innerJoin(users, eq(users.id, miembrosPrograma.userId))
    .where(
      and(
        eq(miembrosPrograma.programId, programId),
        eq(miembrosPrograma.activo, true),
        eq(users.activo, true),
        isNotNull(miembrosPrograma.calendlyEmail),
      ),
    );
  return filas
    .filter((f) => trabajaLeads(f.rol))
    .map((f) => ({ userId: f.userId, correoCalendly: f.correoCalendly! }));
}

/**
 * Los leads del programa que tienen ese correo, con los correos que lo prueban y sus deals
 * abiertos y vigentes. El correo que es la llave del lead cuenta como confirmado.
 */
async function candidatosPorCorreo(db: Db, programId: string, correo: string): Promise<LeadCandidato[]> {
  const contactos = await db
    .select({ leadId: leadContactos.leadId, valor: leadContactos.valor, confirmado: leadContactos.confirmado })
    .from(leadContactos)
    .where(
      and(
        eq(leadContactos.programId, programId),
        eq(leadContactos.tipo, "correo"),
        eq(leadContactos.valor, correo),
      ),
    );
  const porLlave = await db
    .select({ leadId: leads.id, valor: leads.emailNormalizado })
    .from(leads)
    .where(and(eq(leads.programId, programId), eq(leads.emailNormalizado, correo)));

  const correos = new Map<string, { valor: string; confirmado: boolean }[]>();
  for (const c of contactos) correos.set(c.leadId, [...(correos.get(c.leadId) ?? []), c]);
  for (const l of porLlave) {
    correos.set(l.leadId, [...(correos.get(l.leadId) ?? []), { valor: l.valor, confirmado: true }]);
  }
  const leadIds = [...correos.keys()];
  if (leadIds.length === 0) return [];

  const abiertos = await db
    .select({ id: deals.id, leadId: deals.leadId, etapa: deals.etapa, ownerUserId: deals.ownerUserId })
    .from(deals)
    .where(and(eq(deals.programId, programId), inArray(deals.leadId, leadIds), vigente(deals)));

  return leadIds.map((leadId) => ({
    leadId,
    correos: correos.get(leadId)!,
    dealsAbiertos: abiertos
      .filter((d) => d.leadId === leadId && d.etapa !== "ganado_completo" && d.etapa !== "cierre_perdido")
      .map((d) => ({ dealId: d.id, ownerUserId: d.ownerUserId })),
  }));
}

/**
 * Registra una cita de Calendly del programa: la cuelga de su deal si no hay duda, o la
 * deja suelta. Idempotente por la huella: la misma cita dos veces no escribe nada.
 */
export async function registrarLlamadaDeCalendly(
  db: Db,
  programId: string,
  cita: CitaDeCalendly,
): Promise<LlamadaRegistrada> {
  return enTransaccion(db, async (tx) => {
    const previa = await llamadaPorHuella(tx, programId, cita.uuidInvitado);
    if (previa) return { tipo: "repetida", callId: previa };

    const correo = normalizarEmail(cita.correoInvitado);
    const candidatos = correo ? await candidatosPorCorreo(tx, programId, correo) : [];
    const closers = await closersConCalendly(tx, programId);
    const host = closerHost(cita.correoHost, closers);
    const idPorCodigo = dealDeCodigo(codigoDeDealDelInvitado(cita));
    const [dealPorCodigo] = idPorCodigo
      ? await tx
          .select({ dealId: deals.id, leadId: deals.leadId, ownerUserId: deals.ownerUserId })
          .from(deals)
          .where(
            and(
              eq(deals.id, idPorCodigo),
              eq(deals.programId, programId),
              notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
              vigente(deals),
            ),
          )
      : [];
    const decision = emparejarLlamada(
      cita,
      candidatos,
      closers,
      dealPorCodigo ?? (await dealDelEnvioConLaCita(tx, programId, cita.uuidInvitado)),
    );

    const valores = {
      programId,
      emailLead: correo,
      fechaAgenda: cita.inicio,
      linkCalendly: cita.linkCalendly ?? null,
      calendlyHostEmail: cita.correoHost,
      resultado: "agendada" as const,
      origen: "calendly",
      huellaFila: huellaDeCita(cita.uuidInvitado),
      closerUserId: host,
      raw: rawDelInvitado(cita),
    };

    if (decision.tipo === "suelta") {
      const callId = await crearLlamada(tx, { ...valores, dealId: null, cohortId: null }, correo);
      if (!callId) return { tipo: "repetida", callId: (await llamadaPorHuella(tx, programId, cita.uuidInvitado))! };
      return { tipo: "suelta", callId, motivo: decision.motivo };
    }

    const [deal] = await tx
      .select({ id: deals.id, cohortId: deals.cohortId })
      .from(deals)
      .where(and(eq(deals.id, decision.dealId), vigente(deals)));
    const callId = await crearLlamada(tx, { ...valores, dealId: deal.id, cohortId: deal.cohortId }, correo);
    if (!callId) return { tipo: "repetida", callId: (await llamadaPorHuella(tx, programId, cita.uuidInvitado))! };

    const efecto = await efectoSobreElDeal(tx, deal.id, host, correo, cita.inicio);
    await registrarNovedadCalendly(tx, {
      programId,
      dealId: deal.id,
      callId,
      tipo: "cita_nueva",
      claveEvento: cita.claveEvento ?? `invitee.created:${cita.uuidInvitado}`,
    });
    return { tipo: "colgada", callId, dealId: deal.id, ...efecto };
  });
}

/**
 * El deal abierto del envío del formulario que trae ESTA cita en su link de agenda
 * (`.../invitees/<uuid>`). Es prueba exacta, como el código del deal: el invitado pudo
 * escribir en Calendly otro correo que en el formulario (9-oct, una cita quedó suelta así).
 * Si el uuid aparece en envíos de más de un deal abierto, hay duda y no decide nada.
 */
async function dealDelEnvioConLaCita(
  db: Db,
  programId: string,
  uuidInvitado: string,
): Promise<(DealAbierto & { leadId: string }) | null> {
  const patron = `%/invitees/${uuidInvitado.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const filas = await db
    .selectDistinct({ dealId: deals.id, leadId: deals.leadId, ownerUserId: deals.ownerUserId })
    .from(submissions)
    .innerJoin(sources, and(eq(sources.id, submissions.sourceId), eq(sources.programId, programId)))
    .innerJoin(deals, and(eq(deals.leadId, submissions.leadId), eq(deals.programId, programId)))
    .where(
      and(
        sql`${submissions.respuestas}::text like ${patron}`,
        notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
        vigente(deals),
      ),
    );
  return filas.length === 1 ? filas[0] : null;
}

async function llamadaPorHuella(db: Db, programId: string, uuidInvitado: string): Promise<string | null> {
  // `incluyendoAnulados`: una cita cuya llamada se anulo sigue siendo la misma cita, y
  // volver a crearla chocaria contra `calls_huella_idx` de todos modos.
  const [fila] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(
      and(eq(calls.programId, programId), eq(calls.huellaFila, huellaDeCita(uuidInvitado)), incluyendoAnulados(calls)),
    );
  return fila?.id ?? null;
}

/** Crea la llamada con su rastro (ADR 0042). `null` si otra entrega la creo antes (misma huella). */
async function crearLlamada(db: Db, valores: Record<string, unknown>, correo: string | null): Promise<string | null> {
  try {
    // Savepoint: el choque de la huella no aborta la transaccion de afuera.
    return await enTransaccion(db, (tx) =>
      crearConRastro(
        { db: tx, tabla: calls, nombreTabla: "calls", actorId: null, etiqueta: correo ?? String(valores.huellaFila) },
        valores,
      ),
    );
  } catch (e) {
    if (esViolacionUnica(e)) return null;
    throw e;
  }
}

/**
 * Lo que una llamada nueva le hace al deal: el dueño pasa a la host registrada (con nota si
 * habia otro) y, si `unaCitaMueveAAgendado` lo dice, el motor lo lleva a Agendado. Lo usan el registro
 * automatico y la asignacion a mano de una suelta.
 */
export async function efectoSobreElDeal(
  tx: Db,
  dealId: string,
  host: string | null,
  etiqueta: string | null,
  fechaCita?: Date | null,
): Promise<{ movioAAgendado: boolean; duenoAnterior: string | null; rechazo?: string }> {
  const [deal] = await tx
    .select({ etapa: deals.etapa, pendiente: deals.pendiente, ownerUserId: deals.ownerUserId })
    .from(deals)
    .where(and(eq(deals.id, dealId), vigente(deals)));

  const duenoAnterior = await darDealAlHost(tx, dealId, deal.ownerUserId, host, etiqueta ?? dealId);

  if (!unaCitaMueveAAgendado(deal.etapa, deal.pendiente)) {
    return { movioAAgendado: false, duenoAnterior };
  }
  try {
    await moverEtapa(tx, { dealId, a: "agendado", actor: { tipo: "sistema" } });
    // Solo deja nota cuando la cita le quita al deal un pendiente: eso es lo que el sistema
    // decide solo. Una cita sobre un deal de setteo ya se explica con la llamada misma.
    if (fechaCita && deal.pendiente != null) {
      await dejarNotaDelSistema(
        tx,
        dealId,
        `Llegó una cita nueva para el ${fechaHoraEnBogota(fechaCita)}: el deal pasó a Agendado y se quitó el pendiente ${NOMBRE_DE_PENDIENTE[deal.pendiente]}.`,
      );
    }
    return { movioAAgendado: true, duenoAnterior };
  } catch (e) {
    // El motor dice que al deal le falta algo: la llamada queda y el deal no se mueve.
    if (e instanceof MovimientoRechazado) return { movioAAgendado: false, duenoAnterior, rechazo: e.message };
    throw e;
  }
}

/**
 * La SUELTA que se reintenta cuando llega el envio (ADR 0049 punto 7): si la cita ya
 * entro por el webhook sin deal (el evento de Calendly llego antes que el envio, cosa
 * normal: la agenda esta embebida a mitad del formulario), el 052 la adopta en vez de
 * crear otra llamada con la misma huella, que chocaria contra `calls_huella_idx`.
 *
 * - `adoptada`: era suelta y ahora cuelga del deal, con rastro.
 * - `ya_existe`: la cita ya estaba registrada con deal (o anulada): no se toca.
 * - `no_existe`: no hay llamada con esa huella; el llamador la crea.
 */
export async function adoptarSueltaDeCita(
  tx: Db,
  programId: string,
  uuidInvitado: string,
  deal: { id: string; cohortId: string | null },
): Promise<
  | { estado: "adoptada"; callId: string }
  | { estado: "ya_existe"; callId: string }
  | { estado: "no_existe" }
> {
  const [fila] = await tx
    .select({ id: calls.id, dealId: calls.dealId, anuladoEn: calls.anuladoEn, emailLead: calls.emailLead })
    .from(calls)
    .where(
      and(eq(calls.programId, programId), eq(calls.huellaFila, huellaDeCita(uuidInvitado)), incluyendoAnulados(calls)),
    );
  if (!fila) return { estado: "no_existe" };
  if (fila.dealId !== null || fila.anuladoEn !== null) return { estado: "ya_existe", callId: fila.id };
  await editarConRastro(
    { db: tx, tabla: calls, nombreTabla: "calls", actorId: null, etiqueta: fila.emailLead ?? fila.id },
    fila.id,
    { dealId: deal.id, cohortId: deal.cohortId },
  );
  return { estado: "adoptada", callId: fila.id };
}

/**
 * Adopta, de la más vieja a la más nueva, las llamadas sueltas cuyo correo confirmado
 * pertenece al lead. La decisión final sigue siendo del emparejador puro: si el correo
 * también identifica otro lead o hay más de un deal abierto, no escribe nada.
 */
export async function adoptarSueltasPorCorreo(tx: Db, programId: string, leadId: string): Promise<void> {
  const contactos = await tx
    .select({ valor: leadContactos.valor })
    .from(leadContactos)
    .where(
      and(
        eq(leadContactos.programId, programId),
        eq(leadContactos.leadId, leadId),
        eq(leadContactos.tipo, "correo"),
        eq(leadContactos.confirmado, true),
      ),
    );
  const correos = new Set(contactos.map((c) => normalizarEmail(c.valor)).filter((c): c is string => c !== null));
  if (correos.size === 0) return;

  const sueltas = await tx
    .select({
      id: calls.id,
      programId: calls.programId,
      emailLead: calls.emailLead,
      host: calls.calendlyHostEmail,
      closerUserId: calls.closerUserId,
      fechaAgenda: calls.fechaAgenda,
    })
    .from(calls)
    .where(and(eq(calls.programId, programId), sueltaPorAsignar(), vigente(calls)))
    .orderBy(asc(calls.fechaAgenda));
  const closers = await closersConCalendly(tx, programId);

  for (const llamada of sueltas) {
    const correo = normalizarEmail(llamada.emailLead);
    if (!correo || !correos.has(correo)) continue;
    const decision = emparejarLlamada(
      { correoInvitado: llamada.emailLead, correoHost: llamada.host },
      await candidatosPorCorreo(tx, programId, correo),
      closers,
    );
    if (decision.tipo !== "colgada") continue;
    const [deal] = await tx
      .select({ id: deals.id, programId: deals.programId, etapa: deals.etapa, cohortId: deals.cohortId })
      .from(deals)
      .where(and(eq(deals.id, decision.dealId), eq(deals.programId, programId), vigente(deals)));
    if (!deal || deal.etapa === "ganado_completo" || deal.etapa === "cierre_perdido") continue;
    await colgarSueltaEnDeal(tx, llamada, deal, closerHost(llamada.host, closers), null);
    await dejarNotaDelSistema(
      tx,
      deal.id,
      `Se colgó la llamada suelta del ${llamada.fechaAgenda ? fechaHoraEnBogota(llamada.fechaAgenda) : "sin fecha"} por el correo.`,
    );
  }
}

/**
 * La host registrada se queda el deal (decision de Mani del 28-sep). Devuelve el dueño
 * anterior SOLO si habia uno distinto, y deja la nota que lo avisa. Sin host registrada, el
 * dueño no se toca.
 */
export async function darDealAlHost(
  tx: Db,
  dealId: string,
  ownerActual: string | null,
  host: string | null,
  etiqueta: string,
): Promise<string | null> {
  if (host === null || host === ownerActual) return null;
  const [actual] = await tx
    .select({ setterUserId: deals.setterUserId })
    .from(deals)
    .where(and(eq(deals.id, dealId), vigente(deals)));
  await cambiarDuenoDeal(tx, {
    dealId,
    ownerActual,
    ownerNuevo: host,
    actorId: null,
    etiqueta,
    cambiosAdicionales:
      ownerActual !== null && actual?.setterUserId == null ? { setterUserId: ownerActual } : undefined,
  });
  if (ownerActual === null) return null;
  await crearConRastro(
    { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: null, etiqueta },
    {
      dealId,
      tipo: "nota" as const,
      userId: null,
      nota: "La cita de Calendly la hospeda otra closer del programa: el deal pasó a ella.",
    },
  );
  return ownerActual;
}

// ─────────────────────────────────────────────────────────── asignar una suelta a mano

export const esquemaAsignarSuelta = z.object({
  callId: z.string().uuid("La llamada no es válida."),
  dealId: z.string().uuid("El deal no es válido."),
});

export type DatosAsignarSuelta = z.input<typeof esquemaAsignarSuelta>;

export const esquemaCrearDealDesdeSuelta = z.object({
  callId: z.string().uuid("La llamada no es válida."),
  nombre: z.string().optional(),
  telefono: z.string().optional(),
});

export type DatosCrearDealDesdeSuelta = z.input<typeof esquemaCrearDealDesdeSuelta>;

export interface ActorDeAsignacion {
  userId: string;
  rol: Rol | null;
}

interface LlamadaSueltaLeida {
  id: string;
  programId: string;
  emailLead: string | null;
  host: string | null;
  closerUserId: string | null;
  fechaAgenda: Date | null;
}

interface DealParaSuelta {
  id: string;
  programId: string;
  etapa: typeof deals.$inferSelect.etapa;
  cohortId: string | null;
}

async function colgarSueltaEnDeal(
  tx: Db,
  llamada: LlamadaSueltaLeida,
  deal: DealParaSuelta,
  host: string | null,
  actorId: string | null,
): Promise<{ movioAAgendado: boolean; duenoAnterior: string | null; rechazo?: string }> {
  const etiqueta = llamada.emailLead ?? llamada.id;
  await editarConRastro(
    { db: tx, tabla: calls, nombreTabla: "calls", actorId, etiqueta },
    llamada.id,
    {
      dealId: deal.id,
      cohortId: deal.cohortId,
      ...(llamada.closerUserId === null && host !== null ? { closerUserId: host } : {}),
    },
  );
  return efectoSobreElDeal(tx, deal.id, host, etiqueta, llamada.fechaAgenda);
}

/**
 * Un closer cuelga una llamada SUELTA de un deal (ADR 0049 punto 6), con rastro. Lo hace
 * su host o quien administra y ve el programa; el deal tiene que estar abierto y ser
 * del MISMO programa que la llamada (ADR 0043). El efecto es el mismo que si el
 * emparejador la hubiera colgado sola.
 */
export async function asignarLlamadaSuelta(
  db: Db,
  actor: ActorDeAsignacion,
  datos: DatosAsignarSuelta,
): Promise<{ movioAAgendado: boolean; duenoAnterior: string | null; rechazo?: string }> {
  return normalizando(async () => {
    const { callId, dealId } = esquemaAsignarSuelta.parse(datos);
    return enTransaccion(db, async (tx) => {
      const [llamada] = await tx
        .select({
          id: calls.id,
          programId: calls.programId,
          emailLead: calls.emailLead,
          host: calls.calendlyHostEmail,
          closerUserId: calls.closerUserId,
          fechaAgenda: calls.fechaAgenda,
        })
        .from(calls)
        .where(and(eq(calls.id, callId), sueltaPorAsignar(), vigente(calls)));
      // Inexistente, ya asignada, anulada o de un programa ajeno: el mismo 404.
      if (!llamada || !(await programaEnAlcance(actor.userId, actor.rol, llamada.programId, tx))) {
        throw new ErrorDeApp("No existe esa llamada suelta.", 404);
      }
      const host = closerHost(llamada.host, await closersConCalendly(tx, llamada.programId));
      if (!puedeColgarSuelta({ actorUserId: actor.userId, rol: actor.rol, hostUserId: host })) {
        throw new ErrorDeApp("Esta llamada la hospeda otra closer: la cuelga ella o quien administra.", 403);
      }

      const [deal] = await tx
        .select({ id: deals.id, programId: deals.programId, etapa: deals.etapa, cohortId: deals.cohortId })
        .from(deals)
        .where(and(eq(deals.id, dealId), vigente(deals)));
      if (!deal || deal.programId !== llamada.programId) throw new ErrorDeApp("No existe el deal.", 404);
      if (deal.etapa === "ganado_completo" || deal.etapa === "cierre_perdido") {
        throw new ErrorDeApp("El deal está cerrado: no se le cuelgan llamadas.", 409);
      }

      return colgarSueltaEnDeal(tx, llamada, deal, host, actor.userId);
    });
  });
}

/** Crea el lead/deal de una suelta y la cuelga, todo dentro de la misma transacción. */
export async function crearDealDesdeSuelta(
  db: Db,
  actor: ActorDeAsignacion,
  datos: DatosCrearDealDesdeSuelta,
): Promise<{ dealId: string; leadId: string; movioAAgendado: boolean }> {
  return normalizando(async () => {
    const { callId, nombre, telefono } = esquemaCrearDealDesdeSuelta.parse(datos);
    return enTransaccion(db, async (tx) => {
      const [llamada] = await tx
        .select({
          id: calls.id,
          programId: calls.programId,
          emailLead: calls.emailLead,
          host: calls.calendlyHostEmail,
          closerUserId: calls.closerUserId,
          fechaAgenda: calls.fechaAgenda,
        })
        .from(calls)
        .where(and(eq(calls.id, callId), sueltaPorAsignar(), vigente(calls)));
      if (!llamada || !(await programaEnAlcance(actor.userId, actor.rol, llamada.programId, tx))) {
        throw new ErrorDeApp("No existe esa llamada suelta.", 404);
      }
      const host = closerHost(llamada.host, await closersConCalendly(tx, llamada.programId));
      if (!puedeColgarSuelta({ actorUserId: actor.userId, rol: actor.rol, hostUserId: host })) {
        throw new ErrorDeApp("Esta llamada la hospeda otra closer: la cuelga ella o quien administra.", 403);
      }
      if (!llamada.emailLead) throw new ErrorDeApp("La llamada no tiene correo: asóciala a un deal.", 422);
      if (!actor.rol) throw new ErrorDeApp("No tienes permiso para crear deals.", 403);

      const creado = await crearDealAMano(
        tx,
        { userId: actor.userId, rol: actor.rol },
        {
          programId: llamada.programId,
          lead: { tipo: "nuevo", correo: llamada.emailLead, nombre, telefono },
        },
      );
      const [deal] = await tx
        .select({ id: deals.id, programId: deals.programId, etapa: deals.etapa, cohortId: deals.cohortId })
        .from(deals)
        .where(and(eq(deals.id, creado.dealId), eq(deals.programId, llamada.programId), vigente(deals)));
      const efecto = await colgarSueltaEnDeal(tx, llamada, deal, host, actor.userId);
      return { dealId: creado.dealId, leadId: creado.leadId, movioAAgendado: efecto.movioAAgendado };
    });
  });
}
