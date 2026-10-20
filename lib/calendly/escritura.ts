import { and, eq } from "drizzle-orm";
import { deals, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { ETAPAS_DE_SETTEO } from "@/lib/deals/etapas";
import { vigente } from "@/lib/queries/vigente";
import { codigoDeDeal } from "./link-de-agenda";
import { BASE, coleccionCompleta, organizacionDelToken, type FetchLike } from "./cita";

export interface CitaReservada {
  uuidInvitado: string;
  uriEvento: string;
  fecha: Date;
  hostEmail: string | null;
  joinUrl: string | null;
}

export interface EventoParaAgendar {
  token: string;
  eventTypeUri: string;
  conLocation: boolean;
  tracking: { utmContent: string | null };
  etiqueta: string;
}

export interface TipoDeEventoCalendly { uri: string; nombre: string }

export async function eventosDelUsuario(
  token: string,
  correo: string,
  fetchImpl?: FetchLike,
): Promise<TipoDeEventoCalendly[]> {
  const fetcher = fetchDisponible(fetchImpl);
  const organizacion = await organizacionDelToken(fetcher, token);
  const membresias = await coleccionCompleta(
    fetcher,
    `${BASE}/organization_memberships?organization=${encodeURIComponent(organizacion)}&email=${encodeURIComponent(correo)}&count=100`,
    token,
    "membresías de la organización",
  );
  const usuarios = membresias.flatMap((m) => {
    if (typeof m !== "object" || m === null) return [];
    const user = (m as { user?: unknown }).user;
    return typeof user === "object" && user !== null && typeof (user as { uri?: unknown }).uri === "string"
      ? [(user as { uri: string }).uri]
      : [];
  });
  if (usuarios.length !== 1) throw new ErrorDeApp("No se encontró una única cuenta de Calendly con ese correo.", 422);
  const tipos = await coleccionCompleta(fetcher, `${BASE}/event_types?user=${encodeURIComponent(usuarios[0])}&count=100`, token, "tipos de evento");
  return tipos.flatMap((tipo) => {
    if (typeof tipo !== "object" || tipo === null) return [];
    const valor = tipo as { uri?: unknown; name?: unknown; active?: unknown };
    return typeof valor.uri === "string" && typeof valor.name === "string" && valor.active !== false
      ? [{ uri: valor.uri, nombre: valor.name }]
      : [];
  });
}

type Json = Record<string, unknown>;

function fetchDisponible(fetchImpl?: FetchLike): FetchLike {
  const elegido = fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  if (!elegido) throw new ErrorDeApp("No hay implementación de fetch disponible.", 502);
  return elegido;
}

async function jsonDeCalendly(res: Awaited<ReturnType<FetchLike>>): Promise<Json> {
  let cuerpo: unknown;
  try {
    cuerpo = await res.json();
  } catch {
    cuerpo = null;
  }
  if (!res.ok) {
    const mensaje = typeof cuerpo === "object" && cuerpo !== null && typeof (cuerpo as Json).message === "string"
      ? (cuerpo as Json).message as string
      : `Calendly respondió ${res.status}.`;
    throw new ErrorDeApp(mensaje, 502);
  }
  if (typeof cuerpo !== "object" || cuerpo === null) {
    throw new ErrorDeApp("Calendly devolvió una respuesta con forma inesperada.", 502);
  }
  return cuerpo as Json;
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function tokenDeCalendlyDelPrograma(db: Db, programId: string): Promise<string> {
  const [programa] = await db.select({ token: programs.calendlyToken }).from(programs).where(eq(programs.id, programId));
  if (!programa?.token) throw new ErrorDeApp("El programa no tiene conectado Calendly.", 422);
  return programa.token;
}

export async function horasDisponibles(
  token: string,
  eventTypeUri: string,
  desde: Date,
  hasta: Date,
  fetchImpl?: FetchLike,
): Promise<Date[]> {
  const fetcher = fetchDisponible(fetchImpl);
  const url = `${BASE}/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}&start_time=${encodeURIComponent(desde.toISOString())}&end_time=${encodeURIComponent(hasta.toISOString())}`;
  const cuerpo = await jsonDeCalendly(await fetcher(url, { method: "GET", headers: headers(token) }));
  if (!Array.isArray(cuerpo.collection)) throw new ErrorDeApp("Calendly no devolvió las horas disponibles.", 502);
  return cuerpo.collection.flatMap((fila) => {
    if (typeof fila !== "object" || fila === null) return [];
    const valor = fila as { status?: unknown; start_time?: unknown };
    if (valor.status !== "available" || typeof valor.start_time !== "string") return [];
    const fecha = new Date(valor.start_time);
    return Number.isNaN(fecha.getTime()) ? [] : [fecha];
  });
}

export async function reservarCita(
  token: string,
  datos: {
    eventTypeUri: string;
    startTime: Date;
    invitado: { nombre: string; correo: string };
    conLocation: boolean;
    tracking: { utmContent: string | null };
  },
  fetchImpl?: FetchLike,
): Promise<CitaReservada> {
  const fetcher = fetchDisponible(fetchImpl);
  const cuerpo = await jsonDeCalendly(await fetcher(`${BASE}/invitees`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      event_type: datos.eventTypeUri,
      start_time: datos.startTime.toISOString(),
      invitee: { name: datos.invitado.nombre, email: datos.invitado.correo, timezone: "America/Bogota" },
      ...(datos.conLocation ? { location: { kind: "google_conference" } } : {}),
      tracking: {
        utm_source: "crm",
        utm_medium: "agenda",
        utm_campaign: null,
        utm_content: datos.tracking.utmContent,
        utm_term: null,
        salesforce_uuid: null,
      },
    }),
  }));
  const recurso = cuerpo.resource as { uri?: unknown; event?: unknown } | undefined;
  if (typeof recurso?.uri !== "string" || typeof recurso.event !== "string") {
    throw new ErrorDeApp("Calendly no devolvió la cita reservada.", 502);
  }
  const evento = await jsonDeCalendly(await fetcher(recurso.event, { method: "GET", headers: headers(token) }));
  const e = evento.resource as { uri?: unknown; start_time?: unknown; event_memberships?: unknown; location?: unknown } | undefined;
  if (typeof e?.uri !== "string" || typeof e.start_time !== "string") {
    throw new ErrorDeApp("Calendly no devolvió los datos del evento reservado.", 502);
  }
  const fecha = new Date(e.start_time);
  if (Number.isNaN(fecha.getTime())) throw new ErrorDeApp("Calendly devolvió una fecha inválida.", 502);
  const membresias = Array.isArray(e.event_memberships) ? e.event_memberships : [];
  const host = membresias[0] as { user_email?: unknown } | undefined;
  const location = typeof e.location === "object" && e.location !== null ? e.location as { join_url?: unknown } : null;
  return {
    uuidInvitado: recurso.uri.split("/").filter(Boolean).at(-1) ?? recurso.uri,
    uriEvento: e.uri,
    fecha,
    hostEmail: typeof host?.user_email === "string" ? host.user_email.trim().toLowerCase() : null,
    joinUrl: typeof location?.join_url === "string" ? location.join_url : null,
  };
}

export async function cancelarCita(
  token: string,
  uriEvento: string,
  motivo: "Reagendada" | "Cancelada",
  fetchImpl?: FetchLike,
): Promise<"cancelada" | "ya_cancelada" | "pasada"> {
  const fetcher = fetchDisponible(fetchImpl);
  const res = await fetcher(`${uriEvento}/cancellation`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ reason: motivo }),
  });
  if (res.status === 201) return "cancelada";
  let mensaje = "";
  try {
    const cuerpo = await res.json() as { message?: unknown };
    mensaje = typeof cuerpo?.message === "string" ? cuerpo.message : "";
  } catch { /* respuesta sin JSON */ }
  if (res.status === 403 && /already canceled/i.test(mensaje)) return "ya_cancelada";
  if ((res.status === 400 || res.status === 403) && /event in the past/i.test(mensaje)) return "pasada";
  throw new ErrorDeApp(mensaje || `Calendly respondió ${res.status}.`, 502);
}

export async function eventoParaAgendar(
  db: Db,
  dealId: string,
  fetchImpl?: FetchLike,
): Promise<EventoParaAgendar> {
  const [fila] = await db
    .select({
      etapa: deals.etapa,
      programId: deals.programId,
      ownerNombre: users.nombre,
      ownerEmail: users.email,
      eventTypeUri: miembrosPrograma.calendlyEventType,
      calendlyUrl: programs.calendlyUrl,
    })
    .from(deals)
    .innerJoin(programs, eq(programs.id, deals.programId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .leftJoin(miembrosPrograma, and(eq(miembrosPrograma.programId, deals.programId), eq(miembrosPrograma.userId, deals.ownerUserId), eq(miembrosPrograma.activo, true)))
    .where(and(eq(deals.id, dealId), vigente(deals)));
  if (!fila) throw new ErrorDeApp("No existe el deal, o está anulado.", 404);
  const token = await tokenDeCalendlyDelPrograma(db, fila.programId);
  if (!ETAPAS_DE_SETTEO.includes(fila.etapa)) {
    const dueno = fila.ownerNombre ?? fila.ownerEmail ?? "El dueño";
    if (!fila.eventTypeUri) throw new ErrorDeApp(`${dueno} no tiene su evento de Calendly configurado en este programa.`, 422);
    return { token, eventTypeUri: fila.eventTypeUri, conLocation: true, tracking: { utmContent: null }, etiqueta: `Agenda de ${dueno}` };
  }
  if (!fila.calendlyUrl) throw new ErrorDeApp("El programa no tiene configurado su evento round robin de Calendly.", 422);
  const fetcher = fetchDisponible(fetchImpl);
  const organizacion = await organizacionDelToken(fetcher, token);
  const tipos = await coleccionCompleta(fetcher, `${BASE}/event_types?organization=${encodeURIComponent(organizacion)}&count=100`, token, "tipos de evento");
  const encontrados = tipos.filter((tipo) => typeof tipo === "object" && tipo !== null && (tipo as { scheduling_url?: unknown }).scheduling_url === fila.calendlyUrl);
  if (encontrados.length === 0) throw new ErrorDeApp("No se encontró el evento round robin configurado para el programa.", 422);
  if (encontrados.length > 1) throw new ErrorDeApp("Hay más de un evento round robin con la URL configurada para el programa.", 422);
  const uri = (encontrados[0] as { uri?: unknown }).uri;
  if (typeof uri !== "string") throw new ErrorDeApp("El evento round robin de Calendly no tiene una URI válida.", 422);
  return { token, eventTypeUri: uri, conLocation: false, tracking: { utmContent: codigoDeDeal(dealId) }, etiqueta: "Round robin del programa: Calendly asigna el closer" };
}
