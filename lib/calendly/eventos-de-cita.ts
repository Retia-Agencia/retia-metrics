import { and, eq } from "drizzle-orm";
import { calls, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { moverEtapa, MovimientoRechazado } from "@/lib/deals/mover-etapa";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { PendienteDeal } from "@/lib/deals/etapas";
import { dejarNotaDelSistema } from "@/lib/deals/nota-del-sistema";
import { fechaHoraEnBogota } from "@/lib/format";
import { normalizarEmail } from "@/lib/sheets/mapeo";
import { camposDeInvitadoCalendly, rawDelInvitado, type EventoDeCalendly } from "./evento-webhook";
import { closerHost } from "./emparejar-llamada";
import {
  closersConCalendly,
  efectoSobreElDeal,
  huellaDeCita,
  registrarLlamadaDeCalendly,
  type LlamadaRegistrada,
} from "./colgar-llamada";

/**
 * Lo que un evento de Calendly le hace a la llamada y al deal (ticket 096, A5: webhook).
 * La ruta verifica y lee; aqui se escribe. Todo con el actor SISTEMA, por el rastro (ADR
 * 0042) y por `moverEtapa()`: nunca la etapa a mano.
 *
 * | Evento                                   | Llamada                         | Deal                              |
 * | ---------------------------------------- | ------------------------------- | --------------------------------- |
 * | `invitee.created`                        | la registra el escritor         | colgada/suelta (emparejador)      |
 * | `invitee.created` con `old_invitee`      | la MISMA llamada cambia de fecha y de huella | a Agendado si `unaCitaMueveAAgendado` |
 * | `invitee.canceled` (sin reagenda)        | `cancelada` si seguia `agendada`| Agendado + Re-agenda (PR1)        |
 * | `invitee.canceled` de una reagenda       | nada: la otra mitad la mueve    | nada                              |
 * | `invitee_no_show.created`                | `no_show` si seguia `agendada`  | Agendado + Re-agenda (PR1)        |
 * | `invitee_no_show.deleted`                | vuelve a `agendada`             | Agendado, sin pendiente (E7)      |
 *
 * **Idempotente:** Calendly reintenta. Cada rama mira el estado antes de escribir, asi que
 * repetir un evento no escribe nada. **Fuera de orden:** la reagenda funciona en los dos
 * ordenes (si la cancelacion llega primero no hace nada; si llega despues, la huella vieja
 * ya no existe). Un evento sobre una cita que el CRM no conoce se guarda en el sobre y no
 * inventa nada.
 *
 * El motor manda: si al deal le falta un requisito (p. ej. la llamada cancelada no es la
 * ultima del deal, porque ya hay otra agendada), el movimiento se rechaza, la llamada queda
 * marcada y el rechazo se devuelve para que la entrega lo diga.
 */

export type EfectoDeEvento =
  | { tipo: "registrada"; llamada: LlamadaRegistrada }
  | { tipo: "reagendada"; callId: string; movioAAgendado: boolean; rechazo?: string }
  | { tipo: "marcada"; callId: string; resultado: "cancelada" | "no_show" | "agendada"; etapa: EtapaDeal | null; rechazo?: string }
  /** El evento no cambia nada: repetido, la mitad vieja de una reagenda, o ya estaba asi. */
  | { tipo: "sin_cambio"; motivo: string }
  /** La cita no es de ninguna llamada del CRM: no se inventa. */
  | { tipo: "desconocida"; uuidInvitado: string }
  | { tipo: "ignorado"; evento: string };

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };
const enTransaccion = <T>(db: Db, fn: (tx: Db) => Promise<T>) =>
  (db as unknown as Transaccion).transaction(fn);

/** Aplica un evento ya leido y verificado al programa de la URL. */
export async function aplicarEventoDeCalendly(
  db: Db,
  programId: string,
  evento: EventoDeCalendly,
): Promise<EfectoDeEvento> {
  switch (evento.tipo) {
    case "ignorado":
      return { tipo: "ignorado", evento: evento.evento };
    case "agendada":
      if (evento.uuidAnterior) {
        const reagenda = await reagendar(db, programId, evento, evento.uuidAnterior);
        if (reagenda) return reagenda;
      }
      return {
        tipo: "registrada",
        llamada: await registrarLlamadaDeCalendly(db, programId, {
          uuidInvitado: evento.uuidInvitado,
          inicio: evento.inicio,
          correoInvitado: evento.correoInvitado,
          correoHost: evento.correoHost,
          ...camposDeInvitadoCalendly(evento),
        }),
      };
    case "cancelada":
      if (evento.reagendada) {
        return { tipo: "sin_cambio", motivo: "Es la mitad vieja de una reagenda: la mueve la cita nueva." };
      }
      return marcarFallida(db, programId, evento.uuidInvitado, "cancelada");
    case "no_show":
      return marcarFallida(db, programId, evento.uuidInvitado, "no_show");
    case "no_show_retirado":
      return retirarNoShow(db, programId, evento.uuidInvitado);
  }
}

/** La llamada VIGENTE de una cita, con la etapa de su deal (si tiene uno vigente). */
async function llamadaDeLaCita(tx: Db, programId: string, uuidInvitado: string) {
  const [fila] = await tx
    .select({
      id: calls.id,
      dealId: calls.dealId,
      resultado: calls.resultado,
      emailLead: calls.emailLead,
      fechaAgenda: calls.fechaAgenda,
    })
    .from(calls)
    .where(and(eq(calls.programId, programId), eq(calls.huellaFila, huellaDeCita(uuidInvitado)), vigente(calls)));
  if (!fila) return null;
  let etapa: EtapaDeal | null = null;
  let pendiente: PendienteDeal | null = null;
  if (fila.dealId) {
    const [deal] = await tx
      .select({ etapa: deals.etapa, pendiente: deals.pendiente })
      .from(deals)
      .where(and(eq(deals.id, fila.dealId), vigente(deals)));
    etapa = deal?.etapa ?? null;
    pendiente = deal?.pendiente ?? null;
  }
  return { ...fila, etapa, pendiente };
}

/**
 * Una REAGENDA mueve la fecha de la MISMA llamada (Mani, 28-sep), no crea otra: la llamada
 * de la cita vieja toma la huella, la fecha y el host de la nueva. Devuelve `null` si no hay
 * llamada vieja que mover, y entonces la cita nueva se registra como cualquier otra.
 */
async function reagendar(
  db: Db,
  programId: string,
  cita: Extract<EventoDeCalendly, { tipo: "agendada" }>,
  uuidAnterior: string,
): Promise<EfectoDeEvento | null> {
  return enTransaccion(db, async (tx) => {
    // Repetido: la cita nueva ya tiene su llamada (esta u otra entrega la movio antes).
    const [yaEsta] = await tx
      .select({ id: calls.id })
      .from(calls)
      // `incluyendoAnulados`: una cita registrada y anulada sigue siendo esa cita.
      .where(
        and(
          eq(calls.programId, programId),
          eq(calls.huellaFila, huellaDeCita(cita.uuidInvitado)),
          incluyendoAnulados(calls),
        ),
      );
    if (yaEsta) return { tipo: "sin_cambio", motivo: "La reagenda ya estaba registrada." } as const;

    const vieja = await llamadaDeLaCita(tx, programId, uuidAnterior);
    if (!vieja) return null;

    const etiqueta = vieja.emailLead ?? normalizarEmail(cita.correoInvitado) ?? vieja.id;
    const host = closerHost(cita.correoHost, await closersConCalendly(tx, programId));
    await editarConRastro({ db: tx, tabla: calls, nombreTabla: "calls", actorId: null, etiqueta }, vieja.id, {
      huellaFila: huellaDeCita(cita.uuidInvitado),
      fechaAgenda: cita.inicio,
      calendlyHostEmail: cita.correoHost,
      closerUserId: host,
      resultado: "agendada",
      raw: rawDelInvitado(cita),
    });

    if (!vieja.dealId || vieja.etapa === null || vieja.etapa === "ganado_completo" || vieja.etapa === "cierre_perdido") {
      return { tipo: "reagendada", callId: vieja.id, movioAAgendado: false } as const;
    }
    const efecto = await efectoSobreElDeal(tx, vieja.dealId, host, etiqueta, cita.inicio);
    return { tipo: "reagendada", callId: vieja.id, movioAAgendado: efecto.movioAAgendado, rechazo: efecto.rechazo };
  });
}

/**
 * Cancelada o no-show: la llamada `agendada` pasa a ese resultado y, si el deal esta en
 * Agendado, el sistema le pone Re-agenda (PR1). Una llamada que ya no esta `agendada`
 * (ocurrio, ya fallo) no se pisa: Grain o el closer ya dijeron algo mas fuerte.
 */
async function marcarFallida(
  db: Db,
  programId: string,
  uuidInvitado: string,
  resultado: "cancelada" | "no_show",
): Promise<EfectoDeEvento> {
  return enTransaccion(db, async (tx) => {
    const llamada = await llamadaDeLaCita(tx, programId, uuidInvitado);
    if (!llamada) return { tipo: "desconocida", uuidInvitado } as const;
    if (llamada.resultado !== "agendada") {
      return { tipo: "sin_cambio", motivo: `La llamada ya estaba en ${llamada.resultado}.` } as const;
    }
    await editarConRastro(
      { db: tx, tabla: calls, nombreTabla: "calls", actorId: null, etiqueta: llamada.emailLead ?? llamada.id },
      llamada.id,
      { resultado },
    );
    return moverDealDeLaLlamada(tx, llamada, "agendado", "reagenda", resultado);
  });
}

/** Calendly retira un no-show: la llamada vuelve a `agendada` y el deal de Re-agenda a Agendado. */
async function retirarNoShow(db: Db, programId: string, uuidInvitado: string): Promise<EfectoDeEvento> {
  return enTransaccion(db, async (tx) => {
    const llamada = await llamadaDeLaCita(tx, programId, uuidInvitado);
    if (!llamada) return { tipo: "desconocida", uuidInvitado } as const;
    if (llamada.resultado !== "no_show") {
      return { tipo: "sin_cambio", motivo: `La llamada está en ${llamada.resultado}, no en no_show.` } as const;
    }
    await editarConRastro(
      { db: tx, tabla: calls, nombreTabla: "calls", actorId: null, etiqueta: llamada.emailLead ?? llamada.id },
      llamada.id,
      { resultado: "agendada" },
    );
    return moverDealDeLaLlamada(tx, llamada, "agendado", null, "agendada", "reagenda");
  });
}

/** Mueve el deal de la llamada `de → a` por el motor, solo si esta en `de`. */
async function moverDealDeLaLlamada(
  tx: Db,
  llamada: { id: string; dealId: string | null; etapa: EtapaDeal | null; pendiente: PendienteDeal | null; fechaAgenda: Date | null },
  de: EtapaDeal,
  pendienteA: PendienteDeal | null,
  resultado: "cancelada" | "no_show" | "agendada",
  pendienteEsperado?: PendienteDeal,
): Promise<EfectoDeEvento> {
  if (!llamada.dealId || llamada.etapa !== de || (pendienteEsperado && llamada.pendiente !== pendienteEsperado)) {
    return { tipo: "marcada", callId: llamada.id, resultado, etapa: llamada.etapa };
  }
  try {
    const hecho = await moverEtapa(tx, { dealId: llamada.dealId, a: de, pendiente: pendienteA, actor: { tipo: "sistema" } });
    const fecha = llamada.fechaAgenda ? fechaHoraEnBogota(llamada.fechaAgenda) : "una fecha desconocida";
    const texto = resultado === "agendada"
      ? `Llegó una cita nueva para el ${fecha}: se limpió Re-agenda pendiente.`
      : `Calendly marcó la cita del ${fecha} como ${resultado === "no_show" ? "no asistió" : "cancelada"}: queda Re-agenda pendiente.`;
    await dejarNotaDelSistema(tx, llamada.dealId, texto);
    return { tipo: "marcada", callId: llamada.id, resultado, etapa: hecho.a };
  } catch (e) {
    // El motor dice que falta algo (p. ej. hay otra llamada mas reciente): la llamada
    // queda marcada y el deal no se mueve.
    if (e instanceof MovimientoRechazado) {
      return { tipo: "marcada", callId: llamada.id, resultado, etapa: llamada.etapa, rechazo: e.message };
    }
    throw e;
  }
}
