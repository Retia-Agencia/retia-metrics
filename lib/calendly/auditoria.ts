import { and, eq, inArray } from "drizzle-orm";
import { calls, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { huellaDeCita } from "./colgar-llamada";
import {
  BASE,
  coleccionCompleta,
  ErrorDeCalendly,
  organizacionDelToken,
  uuidDeUri,
  type FetchLike,
} from "./cita";
import { EVENTOS_CALENDLY } from "./evento-webhook";
import { rutaDelWebhookDeCalendly } from "./suscripcion";
import { tokenCalendly } from "@/lib/integraciones";

/**
 * Auditoria de Calendly (ticket 270), nacida del incidente del 15-oct: una cita
 * sin llamada o una suscripcion caida debe verse sin buscar el hueco a mano.
 * Es derivada, no se guarda, y solo avisa: nunca crea ni modifica llamadas.
 */

export type EstadoSuscripcion =
  | { tipo: "activa" }
  | { tipo: "ausente" }
  | { tipo: "deshabilitada"; estado: string }
  | { tipo: "eventos_incompletos"; faltan: string[] };

export interface CitaSinLlamada {
  uuidInvitado: string;
  nombre: string | null;
  correo: string | null;
  inicio: Date;
  creada: Date;
  cancelada: boolean;
  motivo: "sin_llamada" | "reagenda_sin_llamada";
}

export type AuditoriaCalendly =
  | { estado: "sin_token" }
  | { estado: "error"; mensaje: string }
  | {
      estado: "ok";
      suscripcion: EstadoSuscripcion;
      citasRevisadas: number;
      faltantes: CitaSinLlamada[];
    };

interface EventoCalendly {
  uri?: unknown;
  start_time?: unknown;
  status?: unknown;
}

interface InvitadoCalendly {
  uri?: unknown;
  name?: unknown;
  email?: unknown;
  created_at?: unknown;
  status?: unknown;
  rescheduled?: unknown;
  new_invitee?: unknown;
}

interface InvitadoConEvento {
  invitado: InvitadoCalendly;
  evento: EventoCalendly;
}

const HORA = 60 * 60 * 1000;
const MINUTO = 60 * 1000;

function estadoDeSuscripcion(filas: unknown[], programId: string): EstadoSuscripcion {
  const ruta = rutaDelWebhookDeCalendly(programId);
  const candidatas = filas
    .filter((fila): fila is Record<string, unknown> => typeof fila === "object" && fila !== null)
    .filter((fila) => typeof fila.callback_url === "string" && fila.callback_url.endsWith(ruta));
  if (candidatas.length === 0) return { tipo: "ausente" };

  const faltantes = (fila: Record<string, unknown>) => {
    const eventos = Array.isArray(fila.events) ? fila.events : [];
    return EVENTOS_CALENDLY.filter((evento) => !eventos.includes(evento));
  };
  if (candidatas.some((fila) => fila.state === "active" && faltantes(fila).length === 0)) {
    return { tipo: "activa" };
  }
  const activa = candidatas.find((fila) => fila.state === "active");
  if (activa) return { tipo: "eventos_incompletos", faltan: faltantes(activa) };
  const estado = candidatas[0].state;
  return { tipo: "deshabilitada", estado: typeof estado === "string" ? estado : "desconocido" };
}

async function invitadosDeEventos(
  fetchImpl: FetchLike,
  token: string,
  eventos: EventoCalendly[],
): Promise<InvitadoConEvento[]> {
  let siguiente = 0;
  const resultado: InvitadoConEvento[] = [];
  async function trabajador(): Promise<void> {
    while (true) {
      const evento = eventos[siguiente++];
      if (!evento) return;
      if (typeof evento.uri !== "string") continue;
      const invitados = await coleccionCompleta(
        fetchImpl,
        `${evento.uri}/invitees?count=100`,
        token,
        "invitados",
      );
      for (const invitado of invitados) {
        if (typeof invitado === "object" && invitado !== null) {
          resultado.push({ invitado: invitado as InvitadoCalendly, evento });
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, eventos.length) }, () => trabajador()));
  return resultado;
}

async function recursoInvitado(
  fetchImpl: FetchLike,
  token: string,
  uri: string,
): Promise<InvitadoCalendly> {
  let respuesta: Awaited<ReturnType<FetchLike>>;
  try {
    respuesta = await fetchImpl(uri, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch (error) {
    throw new ErrorDeCalendly(
      `No se pudo consultar Calendly: ${error instanceof Error ? error.message : "error de red"}.`,
    );
  }
  if (!respuesta.ok) {
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorDeCalendly(
        `Calendly rechazó el token (${respuesta.status}): puede estar vencido o el owner salió de la organización.`,
      );
    }
    throw new ErrorDeCalendly(`Calendly respondió ${respuesta.status}.`);
  }
  let cuerpo: unknown;
  try {
    cuerpo = await respuesta.json();
  } catch {
    throw new ErrorDeCalendly("Calendly devolvió una respuesta que no es JSON.");
  }
  const recurso =
    typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { resource?: unknown }).resource : null;
  if (typeof recurso !== "object" || recurso === null) {
    throw new ErrorDeCalendly("Calendly no devolvió el invitado de la reagenda.");
  }
  return recurso as InvitadoCalendly;
}

export async function auditarCalendly(
  db: Db,
  programId: string,
  opciones: { fetch?: FetchLike; ahora?: Date } = {},
): Promise<AuditoriaCalendly> {
  const [programa] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.id, programId));
  if (!programa) throw new ErrorDeApp("No existe un programa con ese id.", 404);
  const token = await tokenCalendly(db, programId);
  if (!token) return { estado: "sin_token" };

  const fetchImpl = opciones.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const ahora = opciones.ahora ?? new Date();
  try {
    if (!fetchImpl) throw new ErrorDeCalendly("No hay implementación de fetch disponible.");
    const organizacion = await organizacionDelToken(fetchImpl, token);
    const suscripciones = await coleccionCompleta(
      fetchImpl,
      `${BASE}/webhook_subscriptions?organization=${encodeURIComponent(organizacion)}&scope=organization&count=100`,
      token,
      "suscripciones",
    );
    const suscripcion = estadoDeSuscripcion(suscripciones, programId);

    const desde = new Date(ahora.getTime() - 48 * HORA);
    const hastaInicio = new Date(ahora.getTime() + 60 * 24 * HORA);
    const eventosCrudos = await coleccionCompleta(
      fetchImpl,
      `${BASE}/scheduled_events?organization=${encodeURIComponent(organizacion)}&min_start_time=${encodeURIComponent(desde.toISOString())}&max_start_time=${encodeURIComponent(hastaInicio.toISOString())}&count=100`,
      token,
      "eventos",
    );
    const eventos = eventosCrudos.filter(
      (evento): evento is EventoCalendly => typeof evento === "object" && evento !== null,
    );
    const todos = await invitadosDeEventos(fetchImpl, token, eventos);
    const limiteReciente = ahora.getTime() - 10 * MINUTO;
    const revisados = todos.filter(({ invitado }) => {
      if (typeof invitado.created_at !== "string") return false;
      const creada = new Date(invitado.created_at).getTime();
      return !Number.isNaN(creada) && creada >= desde.getTime() && creada <= limiteReciente;
    });

    const porUuid = new Map<string, InvitadoConEvento>();
    for (const entrada of todos) {
      const uuid = uuidDeUri(entrada.invitado.uri);
      if (uuid) porUuid.set(uuid, entrada);
    }
    const cadenas = new Map<InvitadoConEvento, string[]>();
    for (const entrada of revisados) {
      const uuid = uuidDeUri(entrada.invitado.uri);
      if (!uuid) throw new ErrorDeCalendly("Un invitado de Calendly no trae UUID.");
      const cadena = [uuid];
      let invitado = entrada.invitado;
      for (let salto = 0; salto < 5 && invitado.rescheduled === true; salto++) {
        if (typeof invitado.new_invitee !== "string") break;
        const uuidNuevo = uuidDeUri(invitado.new_invitee);
        if (!uuidNuevo || cadena.includes(uuidNuevo)) break;
        cadena.push(uuidNuevo);
        const conocido = porUuid.get(uuidNuevo)?.invitado;
        invitado =
          conocido ?? (await recursoInvitado(fetchImpl, token, invitado.new_invitee));
        if (!conocido) porUuid.set(uuidNuevo, { invitado, evento: entrada.evento });
      }
      cadenas.set(entrada, cadena);
    }

    const huellas = [...new Set([...cadenas.values()].flat().map(huellaDeCita))];
    const filas =
      huellas.length === 0
        ? []
        : await db
            .select({ huellaFila: calls.huellaFila })
            .from(calls)
            .where(
              and(
                eq(calls.programId, programId),
                inArray(calls.huellaFila, huellas),
                incluyendoAnulados(calls),
              ),
            );
    const presentes = new Set(filas.map((fila) => fila.huellaFila));
    const faltantes: CitaSinLlamada[] = [];
    for (const entrada of revisados) {
      const cadena = cadenas.get(entrada)!;
      if (cadena.some((uuid) => presentes.has(huellaDeCita(uuid)))) continue;
      const inicioTexto = entrada.evento.start_time;
      const creadaTexto = entrada.invitado.created_at;
      const inicio = new Date(typeof inicioTexto === "string" ? inicioTexto : "");
      const creada = new Date(typeof creadaTexto === "string" ? creadaTexto : "");
      if (Number.isNaN(inicio.getTime())) {
        throw new ErrorDeCalendly("Un evento de Calendly no trae fecha de inicio válida.");
      }
      faltantes.push({
        uuidInvitado: cadena[0],
        nombre: typeof entrada.invitado.name === "string" ? entrada.invitado.name : null,
        correo: typeof entrada.invitado.email === "string" ? entrada.invitado.email : null,
        inicio,
        creada,
        cancelada: entrada.evento.status === "canceled" || entrada.invitado.status === "canceled",
        motivo: entrada.invitado.rescheduled === true ? "reagenda_sin_llamada" : "sin_llamada",
      });
    }
    faltantes.sort((a, b) => b.creada.getTime() - a.creada.getTime());
    return { estado: "ok", suscripcion, citasRevisadas: revisados.length, faltantes };
  } catch (error) {
    if (error instanceof ErrorDeCalendly) return { estado: "error", mensaje: error.message };
    throw error;
  }
}
