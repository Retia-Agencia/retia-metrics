import { normalizarEmail } from "@/lib/sheets/mapeo";

/**
 * A que deal va una llamada que trae Calendly, o si queda SUELTA (ticket 096, ADR 0049).
 *
 * Es una funcion pura a proposito: la regla es donde un bug es silencioso, porque una
 * llamada colgada del deal equivocado se ve igual que una bien colgada y no lanza ningun
 * error. Quien lee la base (el webhook o la consulta periodica, A5) arma los candidatos
 * y le pregunta a esta funcion; nadie decide el deal de una llamada de Calendly por fuera.
 *
 * ## La regla (ADR 0049 punto 3)
 *
 * Se cuelga sola SOLO si el correo del invitado es de **un solo lead del programa** con
 * **un solo deal abierto**. En cualquier otro caso queda suelta, con el motivo, y un
 * closer la asigna desde el Inbox. Ante la duda, suelta: nunca "la opcion mas parecida".
 *
 * - **Solo el correo empareja.** El telefono no (ADR 0035): hay leads que ponen un
 *   telefono en el formulario y otro en la agenda.
 * - **Solo un correo CONFIRMADO.** Un correo que entro unido por telefono y nadie
 *   confirmo (`lead_contactos.confirmado = false`) es justo la duda que el ADR 0035
 *   marca: si decidiera aqui, el telefono estaria emparejando por la puerta de atras.
 * - Los candidatos ya vienen acotados al programa: el programa es frontera (ADR 0043).
 *
 * ## El dueño (ADR 0049 punto 5, con la decision de Mani del 28-sep)
 *
 * El deal es de la closer HOST de la cita, si esta registrada en el programa (su cuenta
 * de Calendly vive en su membresia). Si el deal tenia otro dueño, pasa a la host y se
 * avisa (`cambio`). Si la host no esta registrada —o su correo lo reclaman dos closers,
 * que es una duda—, el dueño no se toca: sigue el que habia, o ninguno.
 */

/** Un correo de un lead, tal como esta en `lead_contactos`. */
export interface CorreoDeLead {
  valor: string;
  /** Falso si entro unido por telefono y nadie lo confirmo (ADR 0035). */
  confirmado: boolean;
}

/** Un deal abierto y vigente (no Completo, no Cierre Perdido, no anulado) de un lead. */
export interface DealAbierto {
  dealId: string;
  ownerUserId: string | null;
}

/** Un lead del programa que podria ser el invitado, con sus correos y sus deals abiertos. */
export interface LeadCandidato {
  leadId: string;
  correos: readonly CorreoDeLead[];
  dealsAbiertos: readonly DealAbierto[];
}

/** Un closer del programa y la cuenta de Calendly de su membresia. */
export interface CloserDelPrograma {
  userId: string;
  correoCalendly: string;
}

export interface LlamadaDeCalendly {
  /** El correo con el que el lead agendo. */
  correoInvitado: string | null;
  /** El correo de la cuenta de Calendly que hospeda la cita. */
  correoHost: string | null;
}

export type MotivoSuelta =
  | "sin_correo" // la cita no trae un correo de invitado legible
  | "sin_lead" // ningun lead del programa tiene ese correo confirmado
  | "varios_leads" // mas de un lead del programa lo tiene
  | "sin_deal_abierto" // el lead existe pero no tiene deal abierto
  | "varios_deals_abiertos"; // el lead tiene mas de uno (no deberia: indice unico, ADR 0037)

export type Emparejamiento =
  | {
      tipo: "colgada";
      llave: "codigo" | "correo";
      leadId: string;
      dealId: string;
      dueno: {
        antes: string | null;
        despues: string | null;
        /** Si el dueño cambio y habia uno antes: hay que avisarle (ADR 0049 punto 5). */
        cambio: boolean;
      };
    }
  | { tipo: "suelta"; motivo: MotivoSuelta };

/**
 * El userId de la closer host, SOLO si exactamente un closer del programa tiene ese
 * correo de Calendly. Cero o dos es `null`: no se inventa dueño.
 */
export function closerHost(
  correoHost: string | null,
  closers: readonly CloserDelPrograma[],
): string | null {
  const correo = normalizarEmail(correoHost);
  if (!correo) return null;
  const ids = new Set(
    closers.filter((c) => normalizarEmail(c.correoCalendly) === correo).map((c) => c.userId),
  );
  return ids.size === 1 ? [...ids][0] : null;
}

export function emparejarLlamada(
  llamada: LlamadaDeCalendly,
  candidatos: readonly LeadCandidato[],
  closers: readonly CloserDelPrograma[],
  dealPorCodigo?: (DealAbierto & { leadId: string }) | null,
): Emparejamiento {
  if (dealPorCodigo) return colgada(dealPorCodigo.leadId, dealPorCodigo, llamada, closers, "codigo");

  const correo = normalizarEmail(llamada.correoInvitado);
  if (!correo) return { tipo: "suelta", motivo: "sin_correo" };

  // Por leadId y no por fila: el mismo lead no cuenta dos veces si trae el correo repetido.
  const leads = new Map<string, LeadCandidato>();
  for (const c of candidatos) {
    const loTiene = c.correos.some((x) => x.confirmado && normalizarEmail(x.valor) === correo);
    if (loTiene) leads.set(c.leadId, c);
  }
  if (leads.size === 0) return { tipo: "suelta", motivo: "sin_lead" };
  if (leads.size > 1) return { tipo: "suelta", motivo: "varios_leads" };

  const [lead] = [...leads.values()];
  const deals = new Map(lead.dealsAbiertos.map((d) => [d.dealId, d]));
  if (deals.size === 0) return { tipo: "suelta", motivo: "sin_deal_abierto" };
  if (deals.size > 1) return { tipo: "suelta", motivo: "varios_deals_abiertos" };

  const [deal] = [...deals.values()];
  return colgada(lead.leadId, deal, llamada, closers, "correo");
}

function colgada(
  leadId: string,
  deal: DealAbierto,
  llamada: LlamadaDeCalendly,
  closers: readonly CloserDelPrograma[],
  llave: "codigo" | "correo",
): Extract<Emparejamiento, { tipo: "colgada" }> {
  const host = closerHost(llamada.correoHost, closers);
  const despues = host ?? deal.ownerUserId;
  return {
    tipo: "colgada",
    llave,
    leadId,
    dealId: deal.dealId,
    dueno: {
      antes: deal.ownerUserId,
      despues,
      cambio: deal.ownerUserId !== null && despues !== deal.ownerUserId,
    },
  };
}
