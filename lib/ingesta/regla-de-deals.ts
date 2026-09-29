import { and, eq } from "drizzle-orm";
import { calls, dealActividades, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionUnica } from "@/lib/db/errores";
import { vigente } from "@/lib/queries/vigente";
import { crearConRastro } from "@/lib/crm/rastro";
import { abrirDeal, moverEtapa, MovimientoRechazado } from "@/lib/deals/mover-etapa";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { closerHost } from "@/lib/calendly/emparejar-llamada";
import {
  adoptarSueltaDeCita,
  closersConCalendly,
  darDealAlHost,
  huellaDeCita,
} from "@/lib/calendly/colgar-llamada";
import type { Calificacion } from "./calificacion";

/**
 * La regla de creacion y movimiento de deals de la ingesta (ticket 052, insumo §3.1,
 * ADR 0037, ADR 0049).
 *
 * Cuando entra un lead por el webhook, su `calificacion` (el Estado que le puso el
 * formulario, ADR 0054) decide si nace o avanza un deal. La regla tiene dos mitades y
 * la separacion es a proposito:
 *
 *  - **DECIDE** (`decidirAccionDeDeal`): funcion PURA. Recibe la calificacion del lead,
 *    su deal abierto actual (con su etapa) o ninguno, y —para `con_calendly`— el
 *    resultado de consultar la cita en Calendly. Devuelve QUE hacer. No toca la base,
 *    asi que se prueba con una tabla de casos sin PGlite.
 *  - **DELEGA** (`aplicarReglaDeDeal`): traduce esa decision a una llamada al motor de
 *    la etapa 2 —`abrirDeal()` para crear, `moverEtapa()` para mover— con actor
 *    `sistema`, y crea la llamada de Calendly cuando la cita esta vigente. **NUNCA
 *    escribe `deals.etapa` por su cuenta** (ADR 0037 punto 4): el guardian
 *    `tests/motor-etapas-guardian.test.ts` caza cualquier atajo.
 *
 * ⚠️ **Ninguna regla compara numeros de etapa** (`lib/deals/etapas.ts`): el numero es
 * un nombre, no un orden. Cada caso nombra las etapas una por una. Los numeros del
 * insumo (1, 2, 9 para mover; 4, 5, 6, 7 para el re-envio) se traducen aca a sus
 * nombres reales del enum.
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
 *    que el motor pase el requisito `llamada_con_fecha` de T2/T3/T23 sin aflojar la
 *    reja. Abrir un deal nuevo en Agendado tambien crea su llamada (asi no hay
 *    asimetria con el movimiento).
 *  - **cita cancelada / no encontrada / error de Calendly**: el deal se queda —o se
 *    abre— en Pendiente Setteo, SIN llamada, con una NOTA visible que dice por que. No
 *    se afloja el motor ni se manda a Agendado un deal sin cita real.
 */

/** Las etapas 1, 2 y 9 del insumo: desde ellas "Con Calendly" MUEVE a Agendado (T2, T3, T23). */
const ETAPAS_QUE_AVANZAN_A_AGENDADO: readonly EtapaDeal[] = [
  "pendiente_setteo", // 1
  "en_contacto", // 2
  "proxima_cohorte", // 9
];

/**
 * Las etapas 4, 5, 6 y 7 del insumo: un re-envio con el deal ya en una de estas NO lo
 * mueve —el lead ya esta mas adelante que "acaba de agendar"—, solo se avisa al owner.
 */
const ETAPAS_AVANZADAS: readonly EtapaDeal[] = [
  "agendado", // 4
  "atendido", // 5
  "compromiso_verbal", // 6
  "abonado", // 7
];

/** El deal abierto del lead, o su ausencia. Lo minimo que la decision necesita. */
export type DealAbierto = { etapa: EtapaDeal } | null;

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

/**
 * Que hace la regla ante un lead. Cada variante es una fila de la tabla del insumo:
 *  - `nada`: descartado, sin calificacion, o un caso que no cambia el deal. Puede
 *    llevar `nota` cuando un "Con Calendly" sin cita vigente no puede avanzar y se
 *    queda donde esta.
 *  - `abrir`: no hay deal abierto y la calificacion pide uno nuevo. Con cita vigente
 *    la etapa es Agendado y trae la `llamada`; sin cita vigente nace en Pendiente
 *    Setteo con `nota`.
 *  - `mover`: hay deal abierto en 1/2/9 y "Con Calendly" con cita vigente lo avanza a
 *    Agendado, creando antes la `llamada`.
 *  - `agregar_llamada`: el deal ya esta avanzado (4/5/6/7) y llega una cita VIGENTE: no
 *    se mueve, pero la cita queda como otra llamada del mismo deal (Mani, 28-sep: una
 *    re-agenda con fecha nueva no se pierde). La misma cita dos veces no duplica: la
 *    huella `calendly:<uuid>` lo impide.
 *  - `notificar_reenvio`: el deal ya esta avanzado y la cita NO esta vigente; no se
 *    mueve, se avisa.
 */
export type AccionDeDeal =
  | { tipo: "nada"; motivo: string; nota?: string }
  | { tipo: "abrir"; etapa: EtapaDeal; llamada?: LlamadaDeCita; nota?: string }
  | { tipo: "mover"; a: EtapaDeal; llamada: LlamadaDeCita }
  | { tipo: "agregar_llamada"; etapa: EtapaDeal; llamada: LlamadaDeCita }
  | { tipo: "notificar_reenvio"; etapa: EtapaDeal };

/** Los datos de la llamada de Calendly que hay que crear antes de ir a Agendado. */
export interface LlamadaDeCita {
  inicio: Date;
  uuidInvitado: string;
  correoHost?: string | null;
}

/**
 * La decision, pura. La tabla del insumo §3.1, leida sobre `leads.calificacion` (los
 * tres valores del ticket 051), no sobre numeros de etapa, y —para `con_calendly`—
 * sobre el resultado de la cita:
 *
 * | calificacion            | deal abierto        | cita           | accion                        |
 * |-------------------------|---------------------|----------------|-------------------------------|
 * | `null` / `descartado`   | (cualquiera)        | —              | nada                          |
 * | `setteo_no_calificado`  | ninguno             | —              | abrir en Pendiente Setteo     |
 * | `setteo_no_calificado`  | (cualquiera)        | —              | nada (ya tiene deal)          |
 * | `con_calendly`          | ninguno             | vigente        | abrir en Agendado + llamada   |
 * | `con_calendly`          | ninguno             | no vigente     | abrir en Pendiente Setteo+nota|
 * | `con_calendly`          | en 1, 2 o 9         | vigente        | mover a Agendado + llamada    |
 * | `con_calendly`          | en 1, 2 o 9         | no vigente     | nada + nota (se queda)        |
 * | `con_calendly`          | en 4, 5, 6 o 7      | vigente        | agregar llamada (no mueve)    |
 * | `con_calendly`          | en 4, 5, 6 o 7      | no vigente     | notificar re-envio            |
 * | `con_calendly`          | en otra etapa       | —              | nada                          |
 *
 * `cita` puede faltar (indefinida) si el llamador no la resolvio: se trata como
 * `no_encontrada`, porque un "Con Calendly" sin cita real no va a Agendado.
 */
export function decidirAccionDeDeal(
  calificacion: Calificacion | null,
  dealAbierto: DealAbierto,
  cita?: ResultadoCita,
): AccionDeDeal {
  // Descartado y sin calificacion no abren nada: el lead queda con su tag y sin deal.
  if (calificacion === null || calificacion === "descartado") {
    return { tipo: "nada", motivo: "el lead está descartado o sin calificación" };
  }

  if (calificacion === "setteo_no_calificado") {
    // Solo abre si no hay deal; si ya tiene uno, la regla no lo toca (los historicos
    // no re-abren, enmienda del 24-sep).
    if (dealAbierto === null) return { tipo: "abrir", etapa: "pendiente_setteo" };
    return { tipo: "nada", motivo: "el lead ya tiene un deal abierto" };
  }

  // con_calendly. Un "Con Calendly" sin cita resuelta se trata como no encontrada: no
  // se manda a Agendado un deal sin fecha real (no se afloja el motor).
  const citaResuelta: ResultadoCita = cita ?? { estado: "no_encontrada" };

  // Un deal avanzado (4/5/6/7) no se mueve: el lead ya esta mas adelante que "acaba de
  // agendar". Pero una cita vigente es una llamada real con fecha, y perderla haria que
  // el closer llame a la hora vieja (Mani, 28-sep): se agrega al mismo deal.
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
      };
    }
    return { tipo: "notificar_reenvio", etapa: dealAbierto.etapa };
  }

  const puedeAvanzar = dealAbierto === null || ETAPAS_QUE_AVANZAN_A_AGENDADO.includes(dealAbierto.etapa);
  if (!puedeAvanzar) {
    // Ya esta agendado por otra via, o en una etapa que no avanza a Agendado: no se toca.
    return { tipo: "nada", motivo: `el deal está en ${dealAbierto!.etapa} y no cambia con este re-envío` };
  }

  if (citaResuelta.estado === "vigente") {
    const llamada: LlamadaDeCita = {
          inicio: citaResuelta.inicio,
          uuidInvitado: citaResuelta.uuidInvitado,
          correoHost: citaResuelta.correoHost,
        };
    if (dealAbierto === null) return { tipo: "abrir", etapa: "agendado", llamada };
    return { tipo: "mover", a: "agendado", llamada };
  }

  // Cita cancelada, no encontrada o error: el deal se queda —o se abre— en Pendiente
  // Setteo con una nota visible; nunca va a Agendado sin cita real.
  const nota = notaDeCita(citaResuelta);
  if (dealAbierto === null) return { tipo: "abrir", etapa: "pendiente_setteo", nota };
  // Un deal que ya esta en Pendiente Setteo (o en 2/9) se queda donde esta: no retrocede.
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
    .select({ id: deals.id, etapa: deals.etapa, cohortId: deals.cohortId, ownerUserId: deals.ownerUserId })
    .from(deals)
    .where(and(eq(deals.leadId, leadId), eq(deals.programId, programId), vigente(deals)));
  const abierto = filas.find((d) => d.etapa !== "completo" && d.etapa !== "cierre_perdido");
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
): Promise<void> {
  // La cita pudo entrar antes por el webhook de Calendly, suelta: se adopta (096).
  const previa = await adoptarSueltaDeCita(db, deal.programId, llamada.uuidInvitado, deal);
  if (previa !== "no_existe") return;
  try {
    await crearConRastro(
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
        resultado: "agendada" as const,
        origen: "calendly",
        huellaFila: huellaDeCita(llamada.uuidInvitado),
      },
    );
  } catch (e) {
    // Re-envio del mismo envio: la llamada ya existe (misma huella). No es un error, es
    // la idempotencia funcionando; el deal ya tiene su llamada con fecha.
    if (esViolacionUnica(e)) return;
    throw e;
  }
}

/**
 * Deja la nota de la cita en el deal: `deal_actividades` tipo `nota`, actor el sistema
 * (`user_id` nulo, migración 0032), por `crearConRastro` (ADR 0042). Una nota no mueve
 * nada; el CHECK `deal_actividades_contacto_con_usuario` impide que el sistema registre
 * un CONTACTO, que es lo que sí habilita En Contacto.
 */
async function dejarNota(db: Db, dealId: string, etiqueta: string, nota: string): Promise<void> {
  await crearConRastro(
    { db, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: null, etiqueta },
    { dealId, tipo: "nota" as const, userId: null, nota },
  );
}

/**
 * Aplica la regla a UN lead: lee su deal abierto, decide, y delega al motor. Recibe la
 * `db` (que puede ser la transacción de la ingesta) para vivir o morir con ella, y el
 * resultado de la cita de Calendly ya resuelto por el llamador (fuera de la
 * transacción).
 *
 * Devuelve la acción tomada; la `notificar_reenvio` no muta nada, solo deja el dato
 * para que el llamador avise al owner (el canal es de la etapa 6, fuera de este ticket).
 */
export async function aplicarReglaDeDeal(
  db: Db,
  lead: { id: string; programId: string; emailNormalizado: string; calificacion: Calificacion | null },
  cita?: ResultadoCita,
): Promise<ResultadoReglaDeDeal> {
  const dealAbierto = await dealAbiertoDelLead(db, lead.id, lead.programId);
  const accion = decidirAccionDeDeal(lead.calificacion, dealAbierto, cita);

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
    });
    // Con cita vigente el deal nace en Agendado y necesita su llamada (quita la
    // asimetria con el movimiento: abrir directo en Agendado también crea la llamada).
    if (accion.llamada) {
      await crearLlamadaDeCita(
        db,
        { id: dealId, programId: lead.programId, cohortId: null },
        lead.emailNormalizado,
        accion.llamada,
      );
    }
    if (accion.nota) await dejarNota(db, dealId, lead.emailNormalizado, accion.nota);
    return { leadId: lead.id, accion, dealAbiertoId: dealId, nota: accion.nota };
  }

  if (accion.tipo === "mover" && dealAbierto !== null) {
    // El deal abierto existe (lo garantiza la decisión, que salió de esta misma lectura).
    // La llamada de Calendly se crea ANTES de mover: es lo que hace que el motor pase el
    // requisito `llamada_con_fecha` de T2/T3/T23 sin aflojar la reja.
    await crearLlamadaDeCita(
      db,
      { id: dealAbierto.id, programId: lead.programId, cohortId: dealAbierto.cohortId },
      lead.emailNormalizado,
      accion.llamada,
    );
    await darDealAlHost(db, dealAbierto.id, dealAbierto.ownerUserId, host, lead.emailNormalizado);

    // `moverEtapa` valida la flecha y escribe el historial; nunca la etapa a mano. Un
    // `MovimientoRechazado` NO es un error de datos: es el motor diciendo que al deal le
    // falta un requisito. `moverEtapa` envuelve su trabajo en su propia transacción (un
    // savepoint cuando `db` ya es una transacción), así que el rechazo deshace SOLO ese
    // movimiento; el envío recién ingerido y la llamada sobreviven. Se captura y se reporta.
    try {
      await moverEtapa(db, { dealId: dealAbierto.id, a: accion.a, actor: { tipo: "sistema" } });
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
    await crearLlamadaDeCita(
      db,
      { id: dealAbierto.id, programId: lead.programId, cohortId: dealAbierto.cohortId },
      lead.emailNormalizado,
      accion.llamada,
    );
    await darDealAlHost(db, dealAbierto.id, dealAbierto.ownerUserId, host, lead.emailNormalizado);
    return { leadId: lead.id, accion };
  }

  // `nada` y `notificar_reenvio` no mueven el deal. Un `nada` con nota (cita no vigente
  // sobre un deal en 1/2/9) la deja escrita en ese deal.
  const nota = accion.tipo === "nada" ? accion.nota : undefined;
  if (nota && dealAbierto !== null) await dejarNota(db, dealAbierto.id, lead.emailNormalizado, nota);
  return { leadId: lead.id, accion, nota };
}
