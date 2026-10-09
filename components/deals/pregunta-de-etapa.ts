import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { etapaTrasActividad } from "@/lib/deals/actividad-mueve";

/**
 * La pregunta de cada etapa y sus respuestas (ADR 0072 punto 1; Atendido, ADR 0071
 * punto 5). La respuesta ES la flecha: elige el destino y dice qué dato pide, y
 * `moverEtapa()` valida y escribe como siempre. La ficha la muestra en vez de un menú
 * de "mover", y el Kanban la abre al soltar una tarjeta (punto 2).
 *
 * Que ninguna respuesta apunte a una flecha que no existe, y que ninguna flecha que
 * toma una persona se quede sin respuesta, lo garantiza `tests/pregunta-de-etapa.test.ts`
 * contra la tabla del motor.
 *
 * `import type` se borra en compilacion: este archivo es client-safe, como
 * `etapa-tono.ts`, y no arrastra el motor al bundle.
 */
export type AccionDeRespuesta =
  /** Una flecha del motor: a otra etapa, o la misma etapa con otro pendiente. */
  | { tipo: "mover"; a: EtapaDeal; pendiente: PendienteDeal | null }
  /** El retroceso de Compromiso Verbal: el destino lo calcula el motor del historial. */
  | { tipo: "retroceder"; destinos: readonly EtapaDeal[] }
  /** Registrar una actividad: `registrarActividad` mueve el deal (ADR 0071 puntos 1 y 2). */
  | { tipo: "actividad"; actividad: "contacto" }
  /** A ganado solo se entra con plata (ADR 0037). */
  | { tipo: "abono" }
  /** Los formularios de llamada: una cita con fecha mueve, una fallida pone Re-agenda. */
  | { tipo: "llamada"; uso: "agendar" | "reprogramar" | "fallida" };

export interface Respuesta {
  id: string;
  etiqueta: string;
  accion: AccionDeRespuesta;
  /** Solo se ofrece cuando el deal ya tiene un pendiente (E9, y PC desde Agendado). */
  soloConPendiente?: boolean;
}

export interface PreguntaDeEtapa {
  pregunta: string | null;
  respuestas: readonly Respuesta[];
}

const descartar = (etiqueta = "Descartar"): Respuesta => ({
  id: "descartar",
  etiqueta,
  accion: { tipo: "mover", a: "cierre_perdido", pendiente: null },
});

const proximaCohorte = (etapa: EtapaDeal, soloConPendiente = false): Respuesta => ({
  id: "proxima_cohorte",
  etiqueta: "Próxima cohorte",
  accion: { tipo: "mover", a: etapa, pendiente: "proxima_cohorte" },
  ...(soloConPendiente ? { soloConPendiente } : {}),
});

const registrarContacto: Respuesta = {
  id: "contacto",
  etiqueta: "Registrar contacto",
  accion: { tipo: "actividad", actividad: "contacto" },
};
const pago = (etiqueta: string): Respuesta => ({ id: "abono", etiqueta, accion: { tipo: "abono" } });

export const PREGUNTA_DE_ETAPA: Readonly<Record<EtapaDeal, PreguntaDeEtapa>> = {
  potencial: {
    pregunta: null,
    respuestas: [registrarContacto, proximaCohorte("potencial"), descartar()],
  },
  registrado: {
    pregunta: null,
    respuestas: [registrarContacto, proximaCohorte("registrado"), descartar()],
  },
  en_gestion: {
    pregunta: "¿Se logró el contacto?",
    respuestas: [{ ...registrarContacto, etiqueta: "Sí" }, proximaCohorte("en_gestion"), descartar()],
  },
  contactado: {
    pregunta: "¿Califica?",
    respuestas: [
      { id: "califica", etiqueta: "Sí", accion: { tipo: "mover", a: "calificado", pendiente: null } },
      { id: "negocia", etiqueta: "Negocia", accion: { tipo: "mover", a: "compromiso_verbal", pendiente: null } },
      proximaCohorte("contactado"),
      descartar("No califica"),
    ],
  },
  calificado: {
    pregunta: "¿Qué pasó?",
    respuestas: [
      { id: "agendo", etiqueta: "Agendó", accion: { tipo: "llamada", uso: "agendar" } },
      { id: "negocia", etiqueta: "Negocia", accion: { tipo: "mover", a: "compromiso_verbal", pendiente: null } },
      pago("Pagó"),
      {
        id: "seguimiento",
        etiqueta: "Interesado, más adelante",
        accion: { tipo: "mover", a: "calificado", pendiente: "seguimiento" },
      },
      proximaCohorte("calificado"),
      descartar(),
    ],
  },
  agendado: {
    pregunta: "¿Cómo va la cita?",
    respuestas: [
      { id: "termino", etiqueta: "Terminó", accion: { tipo: "mover", a: "atendido", pendiente: null } },
      { id: "se_movio", etiqueta: "Se movió", accion: { tipo: "llamada", uso: "reprogramar" } },
      { id: "fallida", etiqueta: "No asistió o canceló", accion: { tipo: "llamada", uso: "fallida" } },
      proximaCohorte("agendado", true),
      descartar(),
    ],
  },
  atendido: {
    pregunta: "¿Cómo terminó?",
    respuestas: [
      { id: "agendo", etiqueta: "Agendó", accion: { tipo: "llamada", uso: "agendar" }, soloConPendiente: true },
      pago("Pagó ahora"),
      { id: "compromiso", etiqueta: "Compromiso", accion: { tipo: "mover", a: "compromiso_verbal", pendiente: null } },
      { id: "seguimiento", etiqueta: "Seguimiento", accion: { tipo: "mover", a: "atendido", pendiente: "seguimiento" } },
      { id: "otra_llamada", etiqueta: "Otra llamada", accion: { tipo: "mover", a: "atendido", pendiente: "reagenda" } },
      proximaCohorte("atendido"),
      descartar("Perdido"),
    ],
  },
  compromiso_verbal: {
    pregunta: "¿Cómo va la negociación?",
    respuestas: [
      pago("Pagó"),
      {
        id: "revisando",
        etiqueta: "Revisando propuesta",
        accion: { tipo: "mover", a: "compromiso_verbal", pendiente: "seguimiento" },
      },
      {
        id: "retroceso",
        etiqueta: "Se echó para atrás",
        accion: { tipo: "retroceder", destinos: ["atendido", "contactado", "calificado"] },
      },
      proximaCohorte("compromiso_verbal"),
      descartar(),
    ],
  },
  ganado_parcial: {
    pregunta: null,
    respuestas: [pago("Registrar abono"), descartar("Desistió")],
  },
  ganado_completo: { pregunta: null, respuestas: [] },
  cierre_perdido: {
    pregunta: "¿Se recupera?",
    respuestas: [
      { id: "recuperar", etiqueta: "A gestión", accion: { tipo: "mover", a: "en_gestion", pendiente: null } },
    ],
  },
};

/** Las respuestas que el deal puede tomar hoy, según tenga o no un pendiente. */
export function respuestasDe(etapa: EtapaDeal, pendiente: PendienteDeal | null): Respuesta[] {
  return PREGUNTA_DE_ETAPA[etapa].respuestas.filter((r) => !r.soloConPendiente || pendiente != null);
}

/** Si la respuesta deja la tarjeta en la columna `columna` del Kanban. */
export function llevaA(accion: AccionDeRespuesta, etapa: EtapaDeal, columna: EtapaDeal): boolean {
  switch (accion.tipo) {
    case "mover":
      return accion.a === columna && accion.a !== etapa;
    case "retroceder":
      return accion.destinos.includes(columna);
    case "abono":
      return columna === "ganado_parcial" || columna === "ganado_completo";
    case "actividad":
      return columna === "en_gestion" || columna === "contactado";
    case "llamada":
      return accion.uso === "agendar" && columna === "agendado";
  }
}

export type ClaveDestino = EtapaDeal | "ganado";

export interface GrupoDeRespuestas {
  destino: ClaveDestino;
  respuestas: Respuesta[];
}

type AccionDescriptible = Respuesta | "contacto" | "nota";

/** Explica una accion con la misma regla de destino que agrupa los botones de Transicion. */
export function queHace(
  etapa: EtapaDeal,
  pendiente: PendienteDeal | null,
  accionOId: AccionDescriptible,
  orden: readonly EtapaDeal[],
  nombreDeEtapa: Record<EtapaDeal, string>,
  nombreDePendiente: Record<PendienteDeal, string>,
): string {
  const respuesta = typeof accionOId === "string" ? null : accionOId;
  const accion = respuesta?.accion;
  const id = typeof accionOId === "string" ? accionOId : accionOId.id;
  const actividad = id === "contacto" ? id : accion?.tipo === "actividad" ? accion.actividad : null;
  const registro = id === "nota"
    ? "Una nota en el historial."
    : id === "descartar"
      ? "Se pierde; pide el motivo."
      : accion?.tipo === "abono"
        ? "Registra el pago."
        : accion?.tipo === "retroceder"
          ? "Vuelve a la etapa anterior según el historial."
          : accion?.tipo === "llamada"
            ? accion.uso === "agendar"
              ? "Anota la cita con fecha."
              : accion.uso === "reprogramar"
                ? "La cita cambió de fecha."
                : "Queda para re-agendar."
            : actividad === "contacto"
              ? "Hablaste con el lead."
              : null;
  const con = (consecuencia: string) => (registro ? `${registro} ${consecuencia}` : consecuencia);
  const pasaA = (destino: EtapaDeal | undefined) =>
    destino && destino !== etapa ? con(`El deal pasa a ${nombreDeEtapa[destino]}.`) : con("No cambia la etapa.");

  // Una actividad mueve con la regla del motor, no con la de las columnas del Kanban.
  if (actividad) return pasaA(etapaTrasActividad(etapa, actividad));
  if (accion?.tipo === "abono") return con("El deal pasa a Ganado.");
  if (accion?.tipo === "mover" && accion.a === etapa && accion.pendiente != null) {
    return con(`Queda en ${nombreDeEtapa[etapa]} con ${nombreDePendiente[accion.pendiente]}.`);
  }
  return pasaA(accion ? orden.filter((candidato) => llevaA(accion, etapa, candidato)).at(-1) : undefined);
}

/**
 * Agrupa la pregunta por el destino que se presenta en pantalla (ADR 0075). Cada
 * respuesta que cambia de etapa queda en un solo boton; las dos etapas de pago son
 * una sola intencion porque el saldo decide cual escribe el motor.
 */
export function respuestasPorDestino(
  etapa: EtapaDeal,
  pendiente: PendienteDeal | null,
  orden: readonly EtapaDeal[],
): { destinos: GrupoDeRespuestas[]; sinCambio: Respuesta[] } {
  const grupos = new Map<ClaveDestino, Respuesta[]>();
  const sinCambio: Respuesta[] = [];

  for (const respuesta of respuestasDe(etapa, pendiente)) {
    if (respuesta.accion.tipo === "abono") {
      grupos.set("ganado", [...(grupos.get("ganado") ?? []), respuesta]);
      continue;
    }
    const destinos = orden.filter((destino) => llevaA(respuesta.accion, etapa, destino));
    const destino = destinos.at(-1);
    if (!destino) {
      sinCambio.push(respuesta);
      continue;
    }
    grupos.set(destino, [...(grupos.get(destino) ?? []), respuesta]);
  }

  const indice = (destino: ClaveDestino) => orden.indexOf(destino === "ganado" ? "ganado_parcial" : destino);
  return {
    destinos: [...grupos]
      .map(([destino, respuestas]) => ({ destino, respuestas }))
      .sort((a, b) => indice(a.destino) - indice(b.destino)),
    sinCambio,
  };
}

/**
 * Las respuestas que llevan la tarjeta a la columna donde se soltó (ADR 0072 punto 2).
 * Ninguna: la tarjeta vuelve. Una: se abre ya elegida. Varias: se escoge entre ellas.
 */
export function respuestasHacia(etapa: EtapaDeal, pendiente: PendienteDeal | null, columna: EtapaDeal): Respuesta[] {
  if (columna === etapa) return [];
  return respuestasDe(etapa, pendiente).filter((r) => llevaA(r.accion, etapa, columna));
}

/** Si la respuesta cambia la etapa del deal (va al grupo "Mover a" de Transición, ticket 176). */
export function cambiaLaEtapa(etapa: EtapaDeal, accion: AccionDeRespuesta): boolean {
  switch (accion.tipo) {
    case "mover":
      return accion.a !== etapa;
    case "retroceder":
      return accion.destinos.length > 0;
    case "abono":
      return true;
    case "actividad":
      // Una actividad mueve con la regla del motor (`etapaTrasActividad`), no con las columnas.
      return etapaTrasActividad(etapa, accion.actividad) !== etapa;
    case "llamada":
      // "Agendó" mueve a Agendado; reprogramar y fallida dejan la MISMA etapa con un pendiente.
      return accion.uso === "agendar";
  }
}

export type TipoDeActividad = "contacto" | "nota";

export const TIPOS_DE_ACTIVIDAD: readonly TipoDeActividad[] = ["contacto", "nota"];

/**
 * Los tipos de actividad que NO cambian la etapa en esta etapa (ticket 176, decisión 1):
 * son los que ofrece el único botón "Registrar actividad". Contacto cuando mueve
 * (Potencial, Registrado, En gestión) vive en "Mover a" y sale de aquí. La regla la
 * decide `etapaTrasActividad`, no una lista.
 */
export function actividadesQueNoMueven(etapa: EtapaDeal): TipoDeActividad[] {
  return TIPOS_DE_ACTIVIDAD.filter((tipo) => etapaTrasActividad(etapa, tipo) === etapa);
}

export interface GruposDeTransicion {
  /** Cambian la etapa: un grupo por destino, cada grupo con sus respuestas. */
  moverA: GrupoDeRespuestas[];
  /** Misma etapa, queda un pendiente con fecha (Seguimiento, Re-agenda, Próxima cohorte). */
  enEspera: Respuesta[];
  /** Los tipos de actividad que no mueven y abre el único botón "Registrar actividad". */
  actividades: TipoDeActividad[];
}

/**
 * Los tres grupos de la tarjeta Transición (ticket 176, decisión 1): lo que cambia la
 * etapa ("Mover a"), lo que deja un pendiente con fecha ("Dejar en espera") y las
 * actividades que no mueven, que entran por un único botón "Registrar actividad". La
 * regla única: si una respuesta cambia la etapa, va en "Mover a".
 */
export function gruposDeTransicion(
  etapa: EtapaDeal,
  pendiente: PendienteDeal | null,
  orden: readonly EtapaDeal[],
): GruposDeTransicion {
  const { destinos, sinCambio } = respuestasPorDestino(etapa, pendiente, orden);
  // En "sinCambio" quedan los pendientes (mover a la misma etapa con pendiente) y las
  // actividades que no mueven; estas últimas se ofrecen por el botón de actividad, no sueltas.
  const enEspera = sinCambio.filter((respuesta) => respuesta.accion.tipo !== "actividad");
  return { moverA: destinos, enEspera, actividades: actividadesQueNoMueven(etapa) };
}
