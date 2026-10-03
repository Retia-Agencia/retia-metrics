import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lo PURO del webhook de Calendly (ticket 096, A5): verificar la firma y leer el evento.
 * Sin base ni red; lo usa la ruta `app/api/webhooks/calendly/[programa]/route.ts`.
 *
 * 🩸 **Sin verificar contra una entrega real todavia** (el ticket lo pide antes de fiarse):
 * el formato de la cabecera, lo firmado y la forma del payload salen de la documentacion
 * de Calendly. Por eso viven AQUI y en ningun otro lado: si una entrega real difiere, se
 * corrige en este archivo y en su test, y nada mas cambia.
 */

// ─────────────────────────────────────────────────────────── firma

/** La cabecera con la que Calendly firma: `t=<segundos>,v1=<hex del HMAC>`. */
export const HEADER_FIRMA_CALENDLY = "calendly-webhook-signature";

/**
 * Cuanto puede tener una firma antes de rechazarla como repeticion. La documentacion usa 3
 * minutos; 5 dejan margen al reloj de Vercel sin abrir la puerta a repetir una entrega vieja.
 */
export const TOLERANCIA_FIRMA_MS = 5 * 60_000;

export type FirmaCalendly = "valida" | "ausente" | "invalida";

/**
 * ¿La cabecera firma ESTE cuerpo con la clave del programa? Se firma `<t>.<cuerpo crudo>`
 * con HMAC-SHA256 (hex), se compara en tiempo constante y se exige que `t` no sea viejo
 * (ni del futuro, mas alla de la tolerancia).
 */
export function verificarFirmaCalendly(
  cuerpoCrudo: string,
  header: string | null,
  clave: string,
  ahora: Date = new Date(),
): FirmaCalendly {
  if (!header) return "ausente";
  const partes = new Map<string, string>();
  for (const trozo of header.split(",")) {
    const i = trozo.indexOf("=");
    if (i > 0) partes.set(trozo.slice(0, i).trim(), trozo.slice(i + 1).trim());
  }
  const t = partes.get("t");
  const v1 = partes.get("v1");
  if (!t || !v1 || !/^\d+$/.test(t) || !/^[0-9a-f]+$/i.test(v1)) return "invalida";

  const edad = ahora.getTime() - Number(t) * 1000;
  if (Math.abs(edad) > TOLERANCIA_FIRMA_MS) return "invalida";

  const esperado = createHmac("sha256", clave).update(`${t}.${cuerpoCrudo}`, "utf8").digest();
  const recibido = Buffer.from(v1, "hex");
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado) ? "valida" : "invalida";
}

// ─────────────────────────────────────────────────────────── evento

/** Los eventos a los que se suscribe el CRM (los mismos que pide "Conectar Calendly"). */
export const EVENTOS_CALENDLY = [
  "invitee.created",
  "invitee.canceled",
  "invitee_no_show.created",
  "invitee_no_show.deleted",
] as const;

/** Lo que el CRM entiende de un evento de Calendly. */
export type EventoDeCalendly =
  | {
      tipo: "agendada";
      uuidInvitado: string;
      inicio: Date;
      correoInvitado: string | null;
      correoHost: string | null;
      utmContent: string | null;
      nombreInvitado: string | null;
      telefonoInvitado: string | null;
      /** Si es una REAGENDA: el uuid del invitado de la cita vieja (`old_invitee`). */
      uuidAnterior: string | null;
    }
  | {
      tipo: "cancelada";
      uuidInvitado: string;
      /** La cancelacion es la mitad vieja de una reagenda (`rescheduled: true`). */
      reagendada: boolean;
    }
  | { tipo: "no_show"; uuidInvitado: string }
  | { tipo: "no_show_retirado"; uuidInvitado: string }
  /** Un evento que el CRM no escucha (p. ej. `routing_form_submission.created`). */
  | { tipo: "ignorado"; evento: string };

/** Campos del invitado que viajan hasta el escritor sin que otros módulos interpreten tracking. */
export interface CamposDeInvitadoCalendly {
  utmContent?: string | null;
  nombreInvitado?: string | null;
  telefonoInvitado?: string | null;
}

export function camposDeInvitadoCalendly(
  datos: CamposDeInvitadoCalendly,
): Required<CamposDeInvitadoCalendly> {
  return {
    utmContent: datos.utmContent ?? null,
    nombreInvitado: datos.nombreInvitado ?? null,
    telefonoInvitado: datos.telefonoInvitado ?? null,
  };
}

export function codigoDeDealDelInvitado(datos: CamposDeInvitadoCalendly): string | null {
  return datos.utmContent ?? null;
}

export function rawDelInvitado(datos: CamposDeInvitadoCalendly): Record<string, string | null> {
  const campos = camposDeInvitadoCalendly(datos);
  return { nombre: campos.nombreInvitado, telefono: campos.telefonoInvitado, utmContent: campos.utmContent };
}

export type LecturaDeEvento = { ok: true; evento: EventoDeCalendly } | { ok: false; error: string };

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

/** El uuid del invitado de una URI `.../invitees/<uuid>`; `null` si la URI no es de un invitado. */
export function uuidDeInvitado(uri: unknown): string | null {
  if (typeof uri !== "string") return null;
  const partes = uri.split("?")[0].split("/").filter(Boolean);
  const i = partes.lastIndexOf("invitees");
  return i !== -1 && partes[i + 1] ? partes[i + 1] : null;
}

/** El correo del host, solo si hay exactamente uno (mismo criterio que `citaDeCalendly`). */
function correoDelHost(evento: Objeto): string | null {
  const miembros = Array.isArray(evento.event_memberships) ? evento.event_memberships : [];
  const correos = new Set(
    miembros
      .map((m) => (esObjeto(m) ? m.user_email : null))
      .filter((c): c is string => typeof c === "string" && c.includes("@"))
      .map((c) => c.trim().toLowerCase()),
  );
  return correos.size === 1 ? [...correos][0] : null;
}

/**
 * Lee el cuerpo de una entrega. Nunca lanza: lo que no se entiende vuelve como error, y la
 * ruta lo guarda en el sobre con 200 (ADR 0058).
 *
 * El invitado se identifica por su URI (`payload.uri`, o `payload.invitee` si el evento de
 * no-show la trae aparte). Una reagenda llega como DOS eventos, en cualquier orden: un
 * `invitee.canceled` con `rescheduled: true` y un `invitee.created` con `old_invitee`.
 */
export function leerEventoDeCalendly(cuerpoCrudo: string): LecturaDeEvento {
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(cuerpoCrudo);
  } catch {
    return { ok: false, error: "El cuerpo no es JSON." };
  }
  if (!esObjeto(cuerpo) || typeof cuerpo.event !== "string" || !esObjeto(cuerpo.payload)) {
    return { ok: false, error: "El evento no trae `event` y `payload`." };
  }
  const evento = cuerpo.event;
  const p = cuerpo.payload;
  if (!(EVENTOS_CALENDLY as readonly string[]).includes(evento)) {
    return { ok: true, evento: { tipo: "ignorado", evento } };
  }

  const uuidInvitado = uuidDeInvitado(p.uri) ?? uuidDeInvitado(p.invitee);
  if (!uuidInvitado) return { ok: false, error: `El evento ${evento} no trae la URI del invitado.` };

  switch (evento) {
    case "invitee.created": {
      const cita = esObjeto(p.scheduled_event) ? p.scheduled_event : null;
      const inicio = typeof cita?.start_time === "string" ? new Date(cita.start_time) : null;
      if (!cita || !inicio || Number.isNaN(inicio.getTime())) {
        return { ok: false, error: "La cita no trae una fecha de inicio válida." };
      }
      return {
        ok: true,
        evento: {
          tipo: "agendada",
          uuidInvitado,
          inicio,
          correoInvitado: typeof p.email === "string" ? p.email : null,
          correoHost: correoDelHost(cita),
          utmContent: esObjeto(p.tracking) && typeof p.tracking.utm_content === "string" ? p.tracking.utm_content : null,
          nombreInvitado: typeof p.name === "string" ? p.name : null,
          telefonoInvitado: typeof p.text_reminder_number === "string" ? p.text_reminder_number : null,
          uuidAnterior: uuidDeInvitado(p.old_invitee),
        },
      };
    }
    case "invitee.canceled":
      return { ok: true, evento: { tipo: "cancelada", uuidInvitado, reagendada: p.rescheduled === true } };
    case "invitee_no_show.created":
      return { ok: true, evento: { tipo: "no_show", uuidInvitado } };
    default:
      return { ok: true, evento: { tipo: "no_show_retirado", uuidInvitado } };
  }
}
