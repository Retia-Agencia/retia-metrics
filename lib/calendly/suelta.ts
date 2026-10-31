import { and, eq, isNull } from "drizzle-orm";
import { calls } from "@/lib/db/schema";
import { esAdministrador, trabajaLeads, type Rol } from "@/lib/auth/roles";
import type { MotivoSuelta } from "@/lib/calendly/emparejar-llamada";

/**
 * ¿Esta llamada sin deal se asigna a mano? Solo si la trajo Calendly (ADR 0049; Mani, 30-sep).
 *
 * La suelta es la cita que el emparejador no pudo colgar SIN DUDA, y un closer la cuelga desde
 * el Inbox o desde Calls. Las llamadas de la hoja que la migracion no pudo colgar (078) tambien
 * quedan sin deal, pero son historia, no trabajo del dia: ya son rareza `llamada_sin_deal` en
 * `/ajustes/migracion`, y en el Inbox taparian las citas de verdad (~390 al 30-sep). Colgar una
 * de ellas a mano ademas la pegaria a un deal vivo, que el ADR 0059 punto 3 prohibe.
 *
 * Tres lugares hacen esta pregunta (el Inbox, Calls y la accion de asignar), asi que la
 * respuesta vive aqui y los tres la importan.
 */
export const ORIGEN_DE_SUELTA_ASIGNABLE = "calendly";

/** El predicado SQL: sin deal y de Calendly. No incluye la vigencia: esa la decide quien lee. */
export function sueltaPorAsignar() {
  return and(isNull(calls.dealId), eq(calls.origen, ORIGEN_DE_SUELTA_ASIGNABLE));
}

/** El mismo predicado sobre una fila ya leida. */
export function esSueltaPorAsignar(llamada: { dealId: string | null; origen: string }): boolean {
  return llamada.dealId == null && llamada.origen === ORIGEN_DE_SUELTA_ASIGNABLE;
}

/** Solo la host de Calendly, o quien administra, puede colgar una llamada suelta. */
export function puedeColgarSuelta(args: {
  actorUserId: string;
  rol: Rol | null;
  operaComoCloser: boolean;
  hostUserId: string | null;
}): boolean {
  return esAdministrador(args.rol) || (trabajaLeads(args) && args.hostUserId === args.actorUserId);
}

/** Lo que el Inbox le dice a quien ve una suelta: por qué lo es, si parece real y qué hacer. */
export interface ExplicacionDeSuelta {
  veredicto: "real" | "prueba" | "cancelada";
  /** Una frase: por qué el sistema no la colgó sola. */
  causa: string;
  /** Una frase: el botón que corresponde. */
  queHacer: string;
}

const CORREO_DE_PRUEBA = /@example\.(com|org|net)$/i;
const NOMBRE_DE_PRUEBA = /\btest(ing)?\b|\bprueba\b/i;

/**
 * El porqué de una suelta, en lenguaje de closer. Pura a proposito: el motivo lo calcula
 * `emparejarLlamada` (la misma regla del webhook) y aqui solo se traduce; nadie decide
 * por segunda vez si una cita se cuelga. Una suelta de Calendly es SIEMPRE una cita que
 * alguien agendo: solo es "prueba" si el correo o el nombre lo delatan, y "cancelada" si el
 * lead la cancelo. Ante la duda se dice "real": una cita real sin colgar es la peor
 * equivocacion (el closer tendria un deal sin la llamada que si ocurrio).
 */
export function explicarSuelta(args: {
  /** `null` si hoy el emparejador SI la colgaria sola (los datos cambiaron desde que entro). */
  motivo: MotivoSuelta | null;
  correoInvitado: string | null;
  nombreInvitado: string | null;
  cancelada: boolean;
  /** Deals abiertos del programa con el mismo nombre o telefono del invitado. */
  sugerencias: number;
}): ExplicacionDeSuelta {
  const { motivo, correoInvitado, nombreInvitado, cancelada, sugerencias } = args;
  const correo = correoInvitado ?? "ese correo";
  if (cancelada) {
    return {
      veredicto: "cancelada",
      causa: "La cita se canceló en Calendly y nunca tuvo deal.",
      queHacer: "No hay nada que asignar: no va a ocurrir.",
    };
  }
  if ((correoInvitado && CORREO_DE_PRUEBA.test(correoInvitado)) || (nombreInvitado && NOMBRE_DE_PRUEBA.test(nombreInvitado))) {
    return {
      veredicto: "prueba",
      causa: `Parece una cita de prueba (${correoInvitado ?? nombreInvitado}) y ningún lead del programa tiene ese correo.`,
      queHacer: "Si fue una prueba, ignórala. Si es una persona real, usa «Crear deal nuevo».",
    };
  }
  switch (motivo) {
    case "sin_lead":
      return sugerencias > 0
        ? {
            veredicto: "real",
            causa: `Agendó con ${correo}, un correo distinto al del formulario: ningún lead del programa lo tiene. Sí hay un deal abierto con su mismo nombre o teléfono.`,
            queHacer: "Si es la misma persona, usa el botón «Colgar en…» con su nombre. Eso une la cita a su deal.",
          }
        : {
            veredicto: "real",
            causa: `Ningún lead del programa tiene el correo ${correo} ni un deal abierto con ese nombre o teléfono.`,
            queHacer: "Si ya está en el CRM con otro correo, usa «Buscar otro deal». Si es nueva, «Crear deal nuevo».",
          };
    case "sin_correo":
      return { veredicto: "real", causa: "La cita no trajo un correo legible, así que no se pudo buscar al lead.", queHacer: "Ábrela en Calendly para ver quién es y usa «Buscar otro deal»." };
    case "varios_leads":
      return { veredicto: "real", causa: `El correo ${correo} lo tienen varios leads del programa y el sistema no escoge por su cuenta.`, queHacer: "Elige el deal correcto con «Buscar otro deal»." };
    case "sin_deal_abierto":
      return { veredicto: "real", causa: `El lead con ${correo} existe, pero no tiene un deal abierto (ya está cerrado o perdido).`, queHacer: "Si vuelve a comprar, «Crear deal nuevo». Si no, déjala." };
    case "varios_deals_abiertos":
      return { veredicto: "real", causa: "El lead tiene más de un deal abierto y el sistema no escoge por su cuenta.", queHacer: "Elige el deal correcto con «Buscar otro deal»." };
    default:
      return { veredicto: "real", causa: "Hoy el sistema sí la podría colgar sola: los datos cambiaron después de que entró.", queHacer: "Asígnala con «Buscar otro deal»." };
  }
}
