import { and, eq } from "drizzle-orm";
import { calls, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionUnica } from "@/lib/db/errores";
import { vigente } from "@/lib/queries/vigente";
import { crearConRastro } from "@/lib/crm/rastro";
import { abrirDeal, moverEtapa, MovimientoRechazado } from "@/lib/deals/mover-etapa";
import { NOMBRE_DE_ETAPA, transicion, unaCitaMueveAAgendado, type EtapaDeal, type PendienteDeal } from "@/lib/deals/etapas";
import { dejarNotaDelSistema } from "@/lib/deals/nota-del-sistema";
import { fechaHoraEnBogota } from "@/lib/format";
import { closerHost } from "@/lib/calendly/emparejar-llamada";
import {
  adoptarSueltaDeCita,
  closersConCalendly,
  darDealAlHost,
  huellaDeCita,
} from "@/lib/calendly/colgar-llamada";
import { agendoElEnvio, etapaDeEntrada, type EtapaDeEntrada, type HechosDeEntrada } from "./etapa-de-entrada";
import { registrarNovedadCalendly } from "@/lib/notificaciones-calendly/notificaciones";

/**
 * Los tres hechos con los que la regla enruta UN envio. Lo comparten la ingesta y
 * la separacion de un posible duplicado: ninguna de las dos interpreta el resumen
 * del lead ni vuelve a escribir esta traduccion por su cuenta.
 */
export function hechosDeEntradaDelEnvio(envio: {
  esParcial: boolean;
  calificacion: string | null;
  leadQuality: string | null;
}): HechosDeEntrada {
  return {
    esParcial: envio.esParcial,
    agendo: agendoElEnvio(envio.calificacion),
    leadQuality: envio.leadQuality,
  };
}

/**
 * La regla de creacion y movimiento de deals de la ingesta (ticket 052, insumo §3.1,
 * ADR 0037, ADR 0049).
 *
 * Cuando entra un envio por el webhook, **la etapa de entrada la decide el CRM** con tres
 * hechos del envio —si agendo, su `lead_quality` y si es parcial— (ADR 0069, ticket 117
 * enmendado; `etapaDeEntrada` en `./etapa-de-entrada.ts`). La variable `estado` del
 * formulario ya no se lee: 🩸 el 29-sep una edicion del Typeform de un programa dejo de
 * mandarla y ningun envio abrio deal por horas, sin un solo error. Ahora **ningun envio se
 * queda sin deal** (GC-27). La regla tiene dos mitades y la separacion es a proposito:
 *
 *  - **DECIDE** (`decidirAccionDeDeal`): funcion PURA. Recibe la etapa de entrada del
 *    envio, el deal abierto actual (con su etapa) o ninguno, y —si el envio agendo— el
 *    resultado de consultar la cita en Calendly. Devuelve QUE hacer. No toca la base,
 *    asi que se prueba con una tabla de casos sin PGlite.
 *  - **DELEGA** (`aplicarReglaDeDeal`): traduce esa decision a una llamada al motor de
 *    la etapa 2 —`abrirDeal()` para crear, `moverEtapa()` para mover— con actor
 *    `sistema`, y crea la llamada de Calendly cuando la cita esta vigente. **NUNCA
 *    escribe `deals.etapa` por su cuenta** (ADR 0037 punto 4): el guardian
 *    `tests/motor-etapas-guardian.test.ts` caza cualquier atajo.
 *
 * ⚠️ **Ninguna regla compara etapas por orden** (`lib/deals/etapas.ts`): cada caso
 * nombra las etapas una por una.
 *
 * ## Calendly y "Con Calendly" (ADR 0049, ADR 0057)
 *
 * Un envio "Con Calendly" trae un link de agenda, pero el link NO trae la fecha: la
 * fecha vive en la API de Calendly (ADR 0057). La consulta a Calendly la hace el
 * llamador ANTES de abrir la transaccion —una llamada HTTP dentro de la transaccion
 * retiene una conexion del pooler— y le pasa el resultado a la regla por correo del
 * lead. Segun ese resultado:
 *
 *  - **cita vigente** (encontrada y no cancelada): el deal va a Agendado (se abre o se
 *    mueve) y ANTES se crea la llamada `agendada` con la fecha real. La llamada hace
 *    que el motor pase el requisito `llamada_con_fecha` de E4/E7/E9 sin aflojar
 *    la reja. Abrir un deal nuevo en Agendado tambien crea su llamada (asi no hay
 *    asimetria con el movimiento).
 *  - **cita cancelada / no encontrada / error de Calendly**: el deal se queda —o se
 *    abre— en Calificado, SIN llamada, con una NOTA visible que dice por que. No
 *    se afloja el motor ni se manda a Agendado un deal sin cita real.
 */

/**
 * Desde estas etapas un "Con Calendly" con cita vigente MUEVE el deal a Agendado. La
 * lista es UNA y vive en `lib/deals/etapas.ts`
 * (`unaCitaMueveAAgendado`): setteo, o Agendado/Atendido con pendiente.
 *
 * 🩸 Estuvo copiada aquí y se quedó corta: un lead en Re-agenda o Seguimiento que
 * re-enviaba el formulario con una cita válida no pasaba a Agendado (hallazgo A1 del
 * ticket 114). Por eso esta regla se pregunta ANTES que `ETAPAS_AVANZADAS`.
 */

/**
 * Las etapas 4, 5, 6 y 7 del insumo: un re-envio con el deal ya en una de estas NO lo
 * mueve —el lead ya esta mas adelante que "acaba de agendar"—, solo se avisa al owner.
 */
const ETAPAS_AVANZADAS: readonly EtapaDeal[] = [
  "agendado", "atendido", "compromiso_verbal", "ganado_parcial",
];

/** El deal abierto del lead, o su ausencia. Lo minimo que la decision necesita. */
export type DealAbierto = { etapa: EtapaDeal; pendiente: PendienteDeal | null } | null;

/**
 * El resultado de consultar la cita de un envio "Con Calendly" en la API de Calendly.
 * Lo produce el llamador FUERA de la transaccion (`resolverCitaDeEnvio`) y la regla
 * decide con el. Las tres formas que no son `vigente` llevan la NOTA lista para el deal.
 */
export type ResultadoCita =
  | {
      estado: "vigente";
      inicio: Date;
      uuidInvitado: string;
      /**
       * Quien hospeda la cita (ticket 096): se guarda en la llamada y, si es una closer
       * registrada en el programa, el deal es suyo (decision de Mani del 28-sep).
       */
      correoHost?: string | null;
    }
  | { estado: "cancelada" }
  | { estado: "no_encontrada" }
  | { estado: "error"; mensaje: string };

/** La nota visible que queda en el deal cuando la cita de Calendly no esta vigente. */
export function notaDeCita(cita: Exclude<ResultadoCita, { estado: "vigente" }>): string {
  switch (cita.estado) {
    case "cancelada":
      return "La cita de Calendly está cancelada.";
    case "no_encontrada":
      return "No se encontró la cita en Calendly.";
    case "error":
      return `No se pudo consultar Calendly: ${cita.mensaje}`;
  }
}

/** Explica por que un re-envio subio un deal que seguia en una etapa de entrada. */
function notaDeSubida(de: EtapaDeal, a: EtapaDeEntrada): string {
  if (a === "registrado") {
    return "Llegó la respuesta completa del formulario: el deal pasó de Potencial a Registrado.";
  }
  return `Llegó un envío con calidad High: el deal pasó de ${NOMBRE_DE_ETAPA[de]} a Calificado.`;
}

/**
 * Que hace la regla ante un lead. Cada variante es una fila de la tabla del insumo:
 *  - `nada`: un caso que no cambia el deal (el lead ya tiene uno abierto). Puede
 *    llevar `nota` cuando un "Con Calendly" sin cita vigente no puede avanzar y se
 *    queda donde esta.
 *  - `abrir`: no hay deal abierto: nace en la etapa de entrada del envio. Con cita vigente
 *    la etapa es Agendado y trae la `llamada`; sin cita vigente nace en Calificado
 *    con `nota`.
 *  - `mover`: `unaCitaMueveAAgendado` dice que si y "Con Calendly" con cita vigente lo
 *    avanza a Agendado, creando antes la `llamada`.
 *  - `subir`: un re-envio mejora la etapa de entrada de un deal que sigue en Potencial
 *    o Registrado, segun una flecha S del motor.
 *  - `agregar_llamada`: el deal ya esta avanzado (`ETAPAS_AVANZADAS`) y llega una cita VIGENTE: no
 *    se mueve, pero la cita queda como otra llamada del mismo deal (Mani, 28-sep: una
 *    re-agenda con fecha nueva no se pierde). La misma cita dos veces no duplica: la
 *    huella `calendly:<uuid>` lo impide.
 *  - `notificar_reenvio`: el deal ya esta avanzado y la cita NO esta vigente; no se
 *    mueve, se avisa.
 */
export type AccionDeDeal =
  | { tipo: "nada"; motivo: string; nota?: string }
  | { tipo: "abrir"; etapa: EtapaDeal; llamada?: LlamadaDeCita; nota?: string }
  | { tipo: "mover"; a: EtapaDeal; llamada: LlamadaDeCita; nota: string }
  | { tipo: "subir"; a: EtapaDeEntrada; nota: string }
  | { tipo: "agregar_llamada"; etapa: EtapaDeal; llamada: LlamadaDeCita; nota: string }
  | { tipo: "notificar_reenvio"; etapa: EtapaDeal; nota: string };

/** Los datos de la llamada de Calendly que hay que crear antes de ir a Agendado. */
export interface LlamadaDeCita {
  inicio: Date;
  uuidInvitado: string;
  correoHost?: string | null;
}

/**
 * La decision, pura. La tabla del insumo §3.1, leida sobre la ETAPA DE ENTRADA del envio
 * (ADR 0069), no sobre un valor ni sobre numeros de etapa, y —cuando el envio agendo—
 * sobre el resultado de la cita:
 *
 * | etapa de entrada        | deal abierto        | cita           | accion                        |
 * |-------------------------|---------------------|----------------|-------------------------------|
 * | Potencial, Registrado,  | ninguno             | —              | abrir en esa etapa            |
 * |   Calificado            |                     |                |                               |
 * | Potencial, Registrado,  | Potencial/Registrado| —              | sube si hay flecha S; si no,  |
 * |   Calificado            |                     |                | nada                           |
 * | Potencial, Registrado,  | otra etapa          | —              | nada                           |
 * |   Calificado            |                     |                |                               |
 * | Agendado                | ninguno             | vigente        | abrir en Agendado + llamada   |
 * | Agendado                | ninguno             | no vigente     | abrir en Calificado + nota    |
 * | Agendado                | cita mueve (*)      | vigente        | mover a Agendado + llamada    |
 * | Agendado                | cita mueve (*)      | no vigente     | nada + nota (se queda)        |
 * | Agendado                | avanzada (**)       | vigente        | agregar llamada (no mueve)    |
 * | Agendado                | avanzada (**)       | no vigente     | notificar re-envio            |
 * | Agendado                | en otra etapa       | —              | nada                          |
 *
 * (*) `unaCitaMueveAAgendado(etapa, pendiente)`. (**) `ETAPAS_AVANZADAS`: Agendado,
 * Atendido, Compromiso Verbal, Ganado Pago Parcial.
 *
 * `cita` puede faltar (indefinida) si el llamador no la resolvio: se trata como
 * `no_encontrada`, porque entrar a Agendado exige una cita real (ADR 0057).
 */
export function decidirAccionDeDeal(
  entrada: EtapaDeEntrada,
  dealAbierto: DealAbierto,
  cita?: ResultadoCita,
): AccionDeDeal {
  if (entrada !== "agendado") {
    if (dealAbierto === null) return { tipo: "abrir", etapa: entrada };
    const flecha = transicion(dealAbierto.etapa, entrada);
    if (flecha && (flecha.id === "S1" || flecha.id === "S2" || flecha.id === "S3")) {
      return {
        tipo: "subir",
        a: entrada,
        nota: notaDeSubida(dealAbierto.etapa, entrada),
      };
    }
    return { tipo: "nada", motivo: "el lead ya tiene un deal abierto" };
  }

  // Entra en Agendado. Sin cita resuelta se trata como no encontrada: no se manda a
  // Agendado un deal sin fecha real (no se afloja el motor).
  const citaResuelta: ResultadoCita = cita ?? { estado: "no_encontrada" };

  const puedeAvanzar = dealAbierto === null
    || unaCitaMueveAAgendado(dealAbierto.etapa, dealAbierto.pendiente);

  if (puedeAvanzar && citaResuelta.estado === "vigente") {
    const llamada: LlamadaDeCita = {
      inicio: citaResuelta.inicio,
      uuidInvitado: citaResuelta.uuidInvitado,
      correoHost: citaResuelta.correoHost,
    };
    if (dealAbierto === null) return { tipo: "abrir", etapa: "agendado", llamada };
    return {
      tipo: "mover",
      a: "agendado",
      llamada,
      nota: `Llegó una cita nueva para el ${fechaHoraEnBogota(llamada.inicio)}: el deal volvió a Agendado y se limpió el pendiente.`,
    };
  }

  // Un deal avanzado sin pendiente no retrocede: la cita se conserva como llamada.
  if (dealAbierto !== null && ETAPAS_AVANZADAS.includes(dealAbierto.etapa)) {
    if (citaResuelta.estado === "vigente") {
      return {
        tipo: "agregar_llamada",
        etapa: dealAbierto.etapa,
        llamada: {
          inicio: citaResuelta.inicio,
          uuidInvitado: citaResuelta.uuidInvitado,
          correoHost: citaResuelta.correoHost,
        },
        nota: `Llegó una cita nueva para el ${fechaHoraEnBogota(citaResuelta.inicio)}: se agregó la llamada sin mover el deal porque no tenía un pendiente.`,
      };
    }
    return {
      tipo: "notificar_reenvio",
      etapa: dealAbierto.etapa,
      nota: `${notaDeCita(citaResuelta)} Se notificó el re-envío sin mover el deal porque ya estaba avanzado.`,
    };
  }
  if (!puedeAvanzar) {
    // Ya esta agendado por otra via, o en una etapa que no avanza a Agendado: no se toca.
    return { tipo: "nada", motivo: `el deal está en ${dealAbierto!.etapa} y no cambia con este re-envío` };
  }

  // Sin cita vigente, quien quiso agendar nace Calificado y conserva el porqué.
  const nota = notaDeCita(citaResuelta as Exclude<ResultadoCita, { estado: "vigente" }>);
  if (dealAbierto === null) return { tipo: "abrir", etapa: "calificado", nota };
  return { tipo: "nada", motivo: "la cita de Calendly no está vigente", nota };
}

/** Lo que la regla hizo con UN lead, para que la ingesta lo reporte. */
export interface ResultadoReglaDeDeal {
  leadId: string;
  accion: AccionDeDeal;
  /** El id del deal que se abrió, cuando la acción fue `abrir`. */
  dealAbiertoId?: string;
  /**
   * El motor RECHAZÓ el movimiento por un requisito que le falta al deal (no es un
   * error de datos). El deal se queda donde está y el envío SÍ se guarda; el mensaje
   * queda para el reporte.
   */
  rechazo?: string;
  /**
   * La NOTA que la regla dejó en el deal cuando la cita de Calendly no estaba vigente
   * (cancelada, no encontrada o error). Queda escrita como `deal_actividades` tipo
   * `nota` con `user_id` nulo = el sistema (migración 0032); aquí va la copia para el
   * reporte de la ingesta.
   */
  nota?: string;
}

/** El deal abierto del lead con su id, o `null`. */
type DealAbiertoConId = {
  id: string;
  etapa: EtapaDeal;
  pendiente: PendienteDeal | null;
  cohortId: string | null;
  ownerUserId: string | null;
} | null;

/**
 * El deal abierto del lead en su programa, o `null`. Mismo predicado que el indice
 * unico parcial `deals_uno_abierto_por_lead_y_programa_idx`: abierto es
 * `etapa NOT IN (completo, cierre_perdido) AND anulado_en IS NULL`. Como ese indice
 * garantiza a lo sumo uno, aqui basta con el primero. Un deal ANULADO no ocupa el cupo
 * (ADR 0038), por eso la lectura pasa por `vigente(deals)`.
 */
async function dealAbiertoDelLead(db: Db, leadId: string, programId: string): Promise<DealAbiertoConId> {
  const filas = await db
    .select({ id: deals.id, etapa: deals.etapa, pendiente: deals.pendiente, cohortId: deals.cohortId, ownerUserId: deals.ownerUserId })
    .from(deals)
    .where(and(eq(deals.leadId, leadId), eq(deals.programId, programId), vigente(deals)));
  const abierto = filas.find((d) => d.etapa !== "ganado_completo" && d.etapa !== "cierre_perdido");
  return abierto ?? null;
}

/**
 * Crea la llamada `agendada` de Calendly sobre el deal, con la fecha real de la cita,
 * sin closer (Unclaimed), origen `calendly`, y una huella determinista por invitado
 * (`calendly:<uuid>`). El indice unico `calls_huella_idx` (por programa + huella)
 * impide el duplicado: un re-envio del MISMO envio choca contra el, se captura, y no
 * se crea una segunda llamada.
 *
 * Pasa por `crearConRastro` (guardian de rastro operativo, ADR 0042). El actor es el
 * sistema (`actorId` nulo), igual que en `deal_etapa_historial` y `deals.creado_por`.
 */
async function crearLlamadaDeCita(
  db: Db,
  deal: { id: string; programId: string; cohortId: string | null },
  emailLead: string,
  llamada: LlamadaDeCita,
): Promise<string | null> {
  // La cita pudo entrar antes por el webhook de Calendly, suelta: se adopta (096).
  const previa = await adoptarSueltaDeCita(db, deal.programId, llamada.uuidInvitado, deal);
  if (previa.estado === "ya_existe") return null;
  if (previa.estado === "adoptada") return previa.callId;
  const host = closerHost(llamada.correoHost ?? null, await closersConCalendly(db, deal.programId));
  try {
    const callId = await crearConRastro(
      {
        db,
        tabla: calls,
        nombreTabla: "calls",
        actorId: null,
        etiqueta: emailLead,
      },
      {
        dealId: deal.id,
        programId: deal.programId,
        cohortId: deal.cohortId,
        emailLead,
        fechaAgenda: llamada.inicio,
        calendlyHostEmail: llamada.correoHost ?? null,
        closerUserId: host,
        resultado: "agendada" as const,
        origen: "calendly",
        huellaFila: huellaDeCita(llamada.uuidInvitado),
      },
    );
    return callId;
  } catch (e) {
    // Re-envio del mismo envio: la llamada ya existe (misma huella). No es un error, es
    // la idempotencia funcionando; el deal ya tiene su llamada con fecha.
    if (esViolacionUnica(e)) return null;
    throw e;
  }
}

async function notificarCitaNueva(
  db: Db,
  deal: { id: string; programId: string },
  callId: string | null,
  uuidInvitado: string,
): Promise<void> {
  if (!callId) return;
  await registrarNovedadCalendly(db, {
    programId: deal.programId,
    dealId: deal.id,
    callId,
    tipo: "cita_nueva",
    claveEvento: `invitee.created:${uuidInvitado}`,
  });
}

/**
 * Deja la nota de la cita en el deal: `deal_actividades` tipo `nota`, actor el sistema
 * (`user_id` nulo, migración 0032), por `crearConRastro` (ADR 0042). Una nota no mueve
 * nada; el CHECK `deal_actividades_contacto_con_usuario` impide que el sistema registre
 * un CONTACTO, que es lo que sí habilita En Contacto.
 */
/**
 * Aplica la regla a UN lead: lee su deal abierto, decide, y delega al motor. Recibe la
 * `db` (que puede ser la transacción de la ingesta) para vivir o morir con ella, y el
 * resultado de la cita de Calendly ya resuelto por el llamador (fuera de la
 * transacción).
 *
 * Devuelve la acción tomada; la `notificar_reenvio` no muta nada, solo deja el dato
 * para que el llamador avise al owner (el canal es de la etapa 6, fuera de este ticket).
 *
 * `envioDeOrigen` es el envio que disparo la regla: si la regla abre un deal, ese envio es
 * su origen, completo, sin mezclarlo con los UTM de otros envios del lead (ADR 0060).
 *
 * `lead.hechos` son los de ESE envio, no el resumen del lead (ticket 117): un parcial
 * que llega despues de una completa vieja decide con lo suyo, y un parcial reintentado
 * fuera de orden no manda un deal a buscar una cita que no trae.
 */
export async function aplicarReglaDeDeal(
  db: Db,
  lead: { id: string; programId: string; emailNormalizado: string; hechos: HechosDeEntrada },
  cita?: ResultadoCita,
  envioDeOrigen: string | null = null,
): Promise<ResultadoReglaDeDeal> {
  const dealAbierto = await dealAbiertoDelLead(db, lead.id, lead.programId);
  const accion = decidirAccionDeDeal(etapaDeEntrada(lead.hechos), dealAbierto, cita);

  // La closer host de la cita, si esta registrada en el programa (ticket 096).
  const llamadaDeLaAccion = "llamada" in accion ? accion.llamada : undefined;
  const host = llamadaDeLaAccion?.correoHost
    ? closerHost(llamadaDeLaAccion.correoHost, await closersConCalendly(db, lead.programId))
    : null;

  if (accion.tipo === "abrir") {
    const dealId = await abrirDeal(db, {
      leadId: lead.id,
      programId: lead.programId,
      etapa: accion.etapa,
      actor: { tipo: "sistema" },
      ownerUserId: host,
      submissionOrigenId: envioDeOrigen,
    });
    // Con cita vigente el deal nace en Agendado y necesita su llamada (quita la
    // asimetria con el movimiento: abrir directo en Agendado también crea la llamada).
    if (accion.llamada) {
      const callId = await crearLlamadaDeCita(
        db,
        { id: dealId, programId: lead.programId, cohortId: null },
        lead.emailNormalizado,
        accion.llamada,
      );
      await notificarCitaNueva(db, { id: dealId, programId: lead.programId }, callId, accion.llamada.uuidInvitado);
    }
    if (accion.nota) await dejarNotaDelSistema(db, dealId, accion.nota);
    return { leadId: lead.id, accion, dealAbiertoId: dealId, nota: accion.nota };
  }

  if (accion.tipo === "mover" && dealAbierto !== null) {
    // El deal abierto existe (lo garantiza la decisión, que salió de esta misma lectura).
    // La llamada de Calendly se crea ANTES de mover: es lo que hace que el motor pase el
    // requisito `llamada_con_fecha` de E4/E7/E9 sin aflojar la reja.
    const callId = await crearLlamadaDeCita(
      db,
      { id: dealAbierto.id, programId: lead.programId, cohortId: dealAbierto.cohortId },
      lead.emailNormalizado,
      accion.llamada,
    );
    await darDealAlHost(db, dealAbierto.id, dealAbierto.ownerUserId, host, lead.emailNormalizado);
    await notificarCitaNueva(db, { id: dealAbierto.id, programId: lead.programId }, callId, accion.llamada.uuidInvitado);

    // `moverEtapa` valida la flecha y escribe el historial; nunca la etapa a mano. Un
    // `MovimientoRechazado` NO es un error de datos: es el motor diciendo que al deal le
    // falta un requisito. `moverEtapa` envuelve su trabajo en su propia transacción (un
    // savepoint cuando `db` ya es una transacción), así que el rechazo deshace SOLO ese
    // movimiento; el envío recién ingerido y la llamada sobreviven. Se captura y se reporta.
    try {
      await moverEtapa(db, { dealId: dealAbierto.id, a: accion.a, actor: { tipo: "sistema" } });
      await dejarNotaDelSistema(db, dealAbierto.id, accion.nota);
    } catch (e) {
      if (e instanceof MovimientoRechazado) {
        return { leadId: lead.id, accion, rechazo: e.message };
      }
      throw e;
    }
    return { leadId: lead.id, accion };
  }

  if (accion.tipo === "subir" && dealAbierto !== null) {
    try {
      await moverEtapa(db, { dealId: dealAbierto.id, a: accion.a, actor: { tipo: "sistema" } });
      await dejarNotaDelSistema(db, dealAbierto.id, accion.nota);
    } catch (e) {
      if (e instanceof MovimientoRechazado) {
        return { leadId: lead.id, accion, rechazo: e.message };
      }
      throw e;
    }
    return { leadId: lead.id, accion };
  }

  if (accion.tipo === "agregar_llamada" && dealAbierto !== null) {
    // No mueve el deal: solo registra la cita como otra llamada (idempotente por huella).
    const callId = await crearLlamadaDeCita(
      db,
      { id: dealAbierto.id, programId: lead.programId, cohortId: dealAbierto.cohortId },
      lead.emailNormalizado,
      accion.llamada,
    );
    await darDealAlHost(db, dealAbierto.id, dealAbierto.ownerUserId, host, lead.emailNormalizado);
    await notificarCitaNueva(db, { id: dealAbierto.id, programId: lead.programId }, callId, accion.llamada.uuidInvitado);
    await dejarNotaDelSistema(db, dealAbierto.id, accion.nota);
    return { leadId: lead.id, accion };
  }

  // `nada` y `notificar_reenvio` no mueven el deal. Un `nada` con nota (cita no vigente
  // sobre un deal en 1/2/3/9/11) la deja escrita en ese deal.
  const nota = accion.tipo === "nada" ? accion.nota : accion.tipo === "notificar_reenvio" ? accion.nota : undefined;
  if (nota && dealAbierto !== null) await dejarNotaDelSistema(db, dealAbierto.id, nota);
  return { leadId: lead.id, accion, nota };
}
