import { and, eq } from "drizzle-orm";
import { deals, miembrosPrograma, programs, users } from "@/lib/db/schema";
import { tokenCalendly } from "@/lib/integraciones";
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
  tracking: { codigoDeTracking: string | null };
  etiqueta: string;
}

export interface HorarioDeEvento {
  dias: { wday: string; intervalos: { desde: string; hasta: string }[] }[];
  esRoundRobin: boolean;
}

export interface TipoDeEventoCalendly { uri: string; nombre: string; schedulingUrl: string | null }

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
    const valor = tipo as { uri?: unknown; name?: unknown; active?: unknown; pooling_type?: unknown; scheduling_url?: unknown };
    // Un evento de equipo (round robin) no es la agenda del closer: ahí Calendly escoge el host
    // y la cita podría caerle a otro (ADR 0096 punto 2). Solo se ofrecen los individuales.
    return typeof valor.uri === "string" && typeof valor.name === "string" && valor.active !== false && valor.pooling_type == null
      ? [{ uri: valor.uri, nombre: valor.name, schedulingUrl: typeof valor.scheduling_url === "string" ? valor.scheduling_url : null }]
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
  const token = await tokenCalendly(db, programId);
  if (!token) throw new ErrorDeApp("El programa no tiene conectado Calendly.", 422);
  return token;
}

export async function horasDisponibles(
  token: string,
  eventTypeUri: string,
  desde: Date,
  hasta: Date,
  fetchImpl?: FetchLike,
): Promise<Date[]> {
  const fetcher = fetchDisponible(fetchImpl);
  // Calendly rechaza (400) un inicio que ya pasó y un rango de 7 días o más: el inicio se
  // corre a un minuto en el futuro y el fin se recorta justo antes de los 7 días.
  const MINUTO = 60_000;
  const inicio = new Date(Math.max(desde.getTime(), Date.now() + MINUTO));
  const fin = new Date(Math.min(hasta.getTime(), inicio.getTime() + 7 * 24 * 60 * MINUTO - MINUTO));
  if (fin <= inicio) return [];
  const url = `${BASE}/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}&start_time=${encodeURIComponent(inicio.toISOString())}&end_time=${encodeURIComponent(fin.toISOString())}`;
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

const DIAS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function partesEnZona(fecha: Date, timeZone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha).map((parte) => [parte.type, parte.value]));
}

/** Convierte una hora de pared de cualquier zona a un instante, sin depender de la zona del proceso. */
function instanteEnZona(dia: string, hora: string, timeZone: string): Date | null {
  const [year, month, day] = dia.split("-").map(Number);
  const [hour, minute] = hora.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const deseado = Date.UTC(year, month - 1, day, hour, minute);
  let candidato = new Date(deseado);
  for (let intento = 0; intento < 3; intento += 1) {
    const p = partesEnZona(candidato, timeZone);
    const visto = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    candidato = new Date(candidato.getTime() + deseado - visto);
  }
  return candidato;
}

function proximaFechaDelDia(wday: string, timeZone: string): string | null {
  const inicio = new Date();
  for (let n = 0; n < 14; n += 1) {
    const candidato = new Date(inicio.getTime() + n * 86_400_000);
    const p = partesEnZona(candidato, timeZone);
    if (p.weekday.toLowerCase() === wday) return `${p.year}-${p.month}-${p.day}`;
  }
  return null;
}

/**
 * Lee el horario semanal del evento. Las excepciones puntuales `type: date` se ignoran en
 * esta primera versión: las horas reales de los próximos siete días siguen viniendo de
 * `event_type_available_times`, que sí aplica esas excepciones.
 */
export async function horarioDelEvento(
  token: string,
  eventTypeUri: string,
  fetchImpl?: FetchLike,
): Promise<HorarioDeEvento | null> {
  try {
    const fetcher = fetchDisponible(fetchImpl);
    const url = `${BASE}/event_type_availability_schedules?event_type=${encodeURIComponent(eventTypeUri)}`;
    const cuerpo = await jsonDeCalendly(await fetcher(url, { method: "GET", headers: headers(token) }));
    if (!Array.isArray(cuerpo.collection) || cuerpo.collection.length === 0) return null;
    if (cuerpo.collection.length > 1) return { dias: [], esRoundRobin: true };
    const fila = cuerpo.collection[0];
    if (typeof fila !== "object" || fila === null) return null;
    const regla = (fila as { availability_rule?: unknown }).availability_rule;
    if (typeof regla !== "object" || regla === null) return null;
    const { timezone, rules } = regla as { timezone?: unknown; rules?: unknown };
    if (typeof timezone !== "string" || !Array.isArray(rules)) return null;

    const agrupados = new Map<string, { desde: string; hasta: string }[]>();
    for (const rule of rules) {
      if (typeof rule !== "object" || rule === null) continue;
      const r = rule as { type?: unknown; wday?: unknown; intervals?: unknown };
      if (r.type !== "wday" || typeof r.wday !== "string" || !Array.isArray(r.intervals)) continue;
      const fecha = proximaFechaDelDia(r.wday, timezone);
      if (!fecha) continue;
      for (const intervalo of r.intervals) {
        if (typeof intervalo !== "object" || intervalo === null) continue;
        const { from, to } = intervalo as { from?: unknown; to?: unknown };
        if (typeof from !== "string" || typeof to !== "string") continue;
        const desde = instanteEnZona(fecha, from, timezone);
        const hasta = instanteEnZona(fecha, to, timezone);
        if (!desde || !hasta) continue;
        const pDesde = partesEnZona(desde, "America/Bogota");
        const pHasta = partesEnZona(hasta, "America/Bogota");
        const wday = pDesde.weekday.toLowerCase();
        const intervalos = agrupados.get(wday) ?? [];
        intervalos.push({ desde: `${pDesde.hour}:${pDesde.minute}`, hasta: `${pHasta.hour}:${pHasta.minute}` });
        agrupados.set(wday, intervalos);
      }
    }
    return {
      dias: DIAS.flatMap((wday) => agrupados.has(wday) ? [{ wday, intervalos: agrupados.get(wday)! }] : []),
      esRoundRobin: false,
    };
  } catch {
    return null;
  }
}

export async function reservarCita(
  token: string,
  datos: {
    eventTypeUri: string;
    startTime: Date;
    invitado: { nombre: string; correo: string };
    conLocation: boolean;
    tracking: { codigoDeTracking: string | null };
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
        utm_content: datos.tracking.codigoDeTracking,
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

/**
 * Resuelve la URI del event type round robin de un programa por su URL de agenda
 * (`scheduling_url`), con el token del programa (ADR 0098, ticket 289). El listado por
 * organizacion NO trae los eventos de equipo (round robin), medido el 19-oct; el de cada
 * miembro si. Se juntan los de todos los miembros, sin repetir por URI, y se busca el que
 * tiene exactamente esa `scheduling_url`. Cero o mas de uno es un error visible (422): no
 * se adivina cual es el round robin.
 */
export async function resolverRoundRobin(
  token: string,
  schedulingUrl: string,
  fetchImpl?: FetchLike,
): Promise<string> {
  const fetcher = fetchDisponible(fetchImpl);
  const organizacion = await organizacionDelToken(fetcher, token);
  const miembros = await coleccionCompleta(fetcher, `${BASE}/organization_memberships?organization=${encodeURIComponent(organizacion)}&count=100`, token, "miembros");
  const porUri = new Map<string, unknown>();
  for (const miembro of miembros) {
    const usuario = (miembro as { user?: { uri?: unknown } } | null)?.user?.uri;
    if (typeof usuario !== "string") continue;
    const tipos = await coleccionCompleta(fetcher, `${BASE}/event_types?user=${encodeURIComponent(usuario)}&count=100`, token, "tipos de evento");
    for (const tipo of tipos) {
      const uri = (tipo as { uri?: unknown } | null)?.uri;
      if (typeof uri === "string") porUri.set(uri, tipo);
    }
  }
  const encontrados = [...porUri.values()].filter((tipo) => (tipo as { scheduling_url?: unknown }).scheduling_url === schedulingUrl);
  if (encontrados.length === 0) throw new ErrorDeApp("No se encontró el evento round robin configurado para el programa.", 422);
  if (encontrados.length > 1) throw new ErrorDeApp("Hay más de un evento round robin con la URL configurada para el programa.", 422);
  const uri = (encontrados[0] as { uri?: unknown }).uri;
  if (typeof uri !== "string") throw new ErrorDeApp("El evento round robin de Calendly no tiene una URI válida.", 422);
  return uri;
}

export async function eventoParaAgendar(
  db: Db,
  dealId: string,
): Promise<EventoParaAgendar> {
  const [fila] = await db
    .select({
      etapa: deals.etapa,
      programId: deals.programId,
      ownerNombre: users.nombre,
      ownerEmail: users.email,
      eventTypeUri: miembrosPrograma.calendlyEventType,
      roundRobinUri: programs.calendlyEventType,
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
    return { token, eventTypeUri: fila.eventTypeUri, conLocation: true, tracking: { codigoDeTracking: null }, etiqueta: `Agenda de ${dueno}` };
  }
  // El round robin se resuelve al configurarlo (ADR 0098, ticket 289) y se guarda en
  // `programs.calendly_event_type`: ya no se busca por la API en cada reserva.
  if (!fila.roundRobinUri) throw new ErrorDeApp("El programa no tiene configurado su evento round robin de Calendly.", 422);
  return { token, eventTypeUri: fila.roundRobinUri, conLocation: false, tracking: { codigoDeTracking: codigoDeDeal(dealId) }, etiqueta: "Round robin del programa: Calendly asigna el closer" };
}
