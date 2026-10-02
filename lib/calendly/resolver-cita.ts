import { citaDeCalendly, ErrorDeCalendly, uuidInvitadoDelLink, type FetchLike } from "./cita";
import type { ResultadoCita } from "@/lib/ingesta/regla-de-deals";

/**
 * Resuelve la cita de Calendly de un envio "Con Calendly" a un `ResultadoCita` que la
 * regla de deals entiende (ticket 052, ADR 0049, ADR 0057).
 *
 * 🎯 Se llama FUERA de la transaccion de ingesta: una llamada HTTP dentro retendria una
 * conexion del pooler mientras espera a la red (AGENTS.md). El webhook la usa para armar
 * el mapa `citasPorCorreo` que le pasa a `ingerirEntradas`.
 *
 * El token NUNCA se loguea ni sale en el resultado: un error de Calendly se traduce a un
 * mensaje que ya viene sin el token (`ErrorDeCalendly`), y aqui solo se copia ese texto.
 *
 * `fetch` es inyectable para probar sin red (cero llamadas reales en los tests).
 */
export async function resolverCitaDeEnvio(params: {
  token: string;
  correo: string;
  linkAgenda: string | null | undefined;
  fetch?: FetchLike;
}): Promise<ResultadoCita> {
  const uuidInvitado = params.linkAgenda ? uuidInvitadoDelLink(params.linkAgenda) : null;
  // Sin link o sin uuid en el link no hay a quien preguntarle: la cita no se encuentra.
  if (!uuidInvitado) return { estado: "no_encontrada" };

  try {
    const cita = await citaDeCalendly({
      token: params.token,
      correo: params.correo,
      uuidInvitado,
      fetch: params.fetch,
    });
    if (cita === null) return { estado: "no_encontrada" };
    if (cita.cancelada) return { estado: "cancelada" };
    return { estado: "vigente", inicio: cita.inicio, uuidInvitado, correoHost: cita.correoHost };
  } catch (e) {
    // Un token vencido o un 5xx tiene que verse (ADR 0057): se reporta como error visible,
    // el deal se queda en Calificado, y el mensaje (sin el token) va a la nota.
    if (e instanceof ErrorDeCalendly) return { estado: "error", mensaje: e.message };
    throw e;
  }
}
