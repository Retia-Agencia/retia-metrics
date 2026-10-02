import { etapaDealEnum, tipoMotivoEnum, type EtapaDeal } from "@/lib/db/schema";

/**
 * Las once etapas del Deal y que movimiento entre ellas es legal (ADR 0037,
 * ticket 043).
 *
 * La tabla de transiciones es DATO, no una cadena de `if`: vive en `TRANSICIONES`,
 * se lee, y la copia en prosa es `docs/structure.md` §3.1 (adoptada por Mani el
 * 24-sep). Cada fila lleva el id de esa tabla (T1 a T29, P, R, A1, A2) para que
 * una fila del codigo y una fila del documento se puedan cruzar a ojo.
 *
 * Este modulo solo contesta *"¿se puede pasar de A a B?"*. Lo que le falta a un
 * deal para entrar a una etapa es del ticket 044, escribir el movimiento y su
 * historial es de `moverEtapa()` (045), y exigir el motivo es del 047. Aqui el
 * motivo es solo un dato de la fila (`exigeMotivo`), para que el 047 no tenga que
 * volver a escribir la lista.
 *
 * ⚠️ **Ninguna regla compara numeros de etapa** ("4 o mas" no significa nada): el
 * numero es un nombre, no el orden. Re-agenda (3) viene despues de Agendado (4) y
 * Seguimiento (11) despues de Atendido (5). Toda regla nombra las etapas una por una.
 */

export type { EtapaDeal };

/** Las cuatro listas de motivos (ADR 0012, Mani 27-sep, ticket 103). */
export type TipoMotivo = (typeof tipoMotivoEnum.enumValues)[number];

/** Todas las etapas, en el orden del enum de la base. */
export const ETAPAS: readonly EtapaDeal[] = etapaDealEnum.enumValues;

/**
 * Las etapas en el orden en que las recorre un deal: el de la tabla de
 * `docs/structure.md` §3. Es el orden de pantalla (columnas del Kanban). No es el del
 * enum (Seguimiento se agrego al final) ni el del numero: Re-agenda (3) va despues de
 * Agendado (4) y Seguimiento (11) despues de Atendido (5).
 */
export const ETAPAS_EN_ORDEN: readonly EtapaDeal[] = [
  "pendiente_setteo",
  "en_contacto",
  "agendado",
  "pendiente_reagenda",
  "atendido",
  "seguimiento",
  "compromiso_verbal",
  "abonado",
  "completo",
  "proxima_cohorte",
  "cierre_perdido",
];

/**
 * El numero con el que Comercial nombra cada etapa. **Es un nombre, no un orden**:
 * no se ordena ni se compara por el.
 */
export const NUMERO_DE_ETAPA: Readonly<Record<EtapaDeal, number>> = {
  pendiente_setteo: 1,
  en_contacto: 2,
  pendiente_reagenda: 3,
  agendado: 4,
  atendido: 5,
  compromiso_verbal: 6,
  abonado: 7,
  completo: 8,
  proxima_cohorte: 9,
  cierre_perdido: 10,
  seguimiento: 11,
};

/** Como se lee cada etapa en pantalla. */
export const NOMBRE_DE_ETAPA: Readonly<Record<EtapaDeal, string>> = {
  pendiente_setteo: "Pendiente Setteo",
  en_contacto: "En Contacto",
  pendiente_reagenda: "Pendiente Re-agenda",
  agendado: "Agendado",
  atendido: "Atendido",
  seguimiento: "Seguimiento",
  compromiso_verbal: "Compromiso Verbal",
  abonado: "Abonado",
  completo: "Completo",
  proxima_cohorte: "Próxima Cohorte",
  cierre_perdido: "Cierre Perdido",
};

/**
 * Quien mueve el deal por esta flecha. `sistema`: el CRM, cuando pasa el evento
 * (se pega el Grain, entra un abono, llega la agenda). `closer`: una persona, y el
 * motor exige el requisito antes de aceptar. `ambos`: cualquiera de los dos.
 */
export type QuienMueve = "sistema" | "closer" | "ambos";

export interface Transicion {
  /** Id de la fila en `docs/structure.md` §3.1. */
  readonly id: string;
  readonly de: EtapaDeal;
  readonly a: EtapaDeal;
  readonly quien: QuienMueve;
  /** La flecha solo se toma con un motivo escrito (lo aplica el ticket 047). */
  readonly exigeMotivo: boolean;
  /**
   * A que LISTA de motivos pertenece el que exige esta flecha (Mani 27-sep, ticket
   * 103). La flecha decide la lista: P pierde (`perdida`), T29 re-agenda (`reagenda`),
   * T15 se echa atras (`retroceso`), R recupera (`recuperacion`). Va aqui, en la tabla,
   * y no en `requisitos.ts`: es el mismo sitio donde ya vive `exigeMotivo`, asi que la
   * lista y la exigencia no pueden divergir. `null` cuando la flecha no pide motivo.
   */
  readonly tipoDeMotivo: TipoMotivo | null;
}

type Fila = readonly [
  id: string,
  de: EtapaDeal | readonly EtapaDeal[],
  a: EtapaDeal | readonly EtapaDeal[],
  quien: QuienMueve,
  exigeMotivo?: boolean,
  tipoDeMotivo?: TipoMotivo,
];

/**
 * Las etapas de donde se puede caer a Cierre Perdido (P): todas las abiertas.
 * **Completo no**: es terminal, y un reembolso es otro flujo.
 */
const ABIERTAS_QUE_SE_PUEDEN_PERDER: readonly EtapaDeal[] = [
  "pendiente_setteo",
  "en_contacto",
  "pendiente_reagenda",
  "agendado",
  "atendido",
  "seguimiento",
  "compromiso_verbal",
  "abonado",
  "proxima_cohorte",
];

/**
 * La tabla de `docs/structure.md` §3.1, fila por fila. Una fila con varias etapas
 * (T5 "2 → 7 u 8", P "1 a 7, 9 y 11 → 10") se expande a una flecha por par.
 *
 * A1 es "7 → la etapa previa" al anular el unico abono: la etapa previa es la que
 * diga el historial del deal, y solo puede ser una de las que entran a Abonado
 * (2 por T5, 5 por T13, 6 por T16, 11 por T26). Aqui quedan las cuatro flechas;
 * cual se toma lo decide `moverEtapa()` leyendo el historial (045, 047).
 */
const FILAS: readonly Fila[] = [
  ["T1", "pendiente_setteo", "en_contacto", "closer"],
  ["T2", "pendiente_setteo", "agendado", "ambos"],
  ["T3", "en_contacto", "agendado", "ambos"],
  ["T4", "en_contacto", "compromiso_verbal", "closer"],
  ["T5", "en_contacto", ["abonado", "completo"], "sistema"],
  ["T6", "pendiente_reagenda", "agendado", "ambos"],
  ["T7", "pendiente_reagenda", "atendido", "ambos"],
  ["T8", "agendado", "pendiente_reagenda", "sistema"],
  ["T9", "agendado", "agendado", "sistema"],
  ["T10", "agendado", "atendido", "ambos"],
  // T11 se reemplazo el 24-sep por Seguimiento (T24).
  ["T12", "atendido", "compromiso_verbal", "closer"],
  ["T13", "atendido", "abonado", "sistema"],
  ["T14", "atendido", "completo", "sistema"],
  ["T15", "compromiso_verbal", "seguimiento", "closer", true, "retroceso"],
  ["T16", "compromiso_verbal", "abonado", "sistema"],
  ["T17", "compromiso_verbal", "completo", "sistema"],
  ["T19", "en_contacto", "proxima_cohorte", "closer"],
  ["T20", "atendido", "proxima_cohorte", "closer"],
  ["T21", "compromiso_verbal", "proxima_cohorte", "closer"],
  ["T18", "abonado", "completo", "sistema"],
  ["T22", "proxima_cohorte", "en_contacto", "closer"],
  ["T23", "proxima_cohorte", "agendado", "ambos"],
  ["T24", "atendido", "seguimiento", "closer"],
  ["T25", "seguimiento", "compromiso_verbal", "closer"],
  ["T26", "seguimiento", ["abonado", "completo"], "sistema"],
  ["T27", "seguimiento", "agendado", "ambos"],
  ["T28", "seguimiento", "proxima_cohorte", "closer"],
  ["T29", "atendido", "pendiente_reagenda", "closer", true, "reagenda"],
  ["P", ABIERTAS_QUE_SE_PUEDEN_PERDER, "cierre_perdido", "closer", true, "perdida"],
  ["R", "cierre_perdido", ["en_contacto", "agendado", "proxima_cohorte"], "closer", true, "recuperacion"],
  ["A1", "abonado", ["en_contacto", "atendido", "compromiso_verbal", "seguimiento"], "sistema"],
  ["A2", "completo", "abonado", "sistema"],
];

function comoLista(valor: EtapaDeal | readonly EtapaDeal[]): readonly EtapaDeal[] {
  return typeof valor === "string" ? [valor] : valor;
}

/** Todas las flechas legales, una por par (de, a). */
export const TRANSICIONES: readonly Transicion[] = FILAS.flatMap(
  ([id, de, a, quien, exigeMotivo, tipoDeMotivo]) =>
    comoLista(de).flatMap((origen) =>
      comoLista(a).map((destino) => ({
        id,
        de: origen,
        a: destino,
        quien,
        exigeMotivo: exigeMotivo ?? false,
        tipoDeMotivo: tipoDeMotivo ?? null,
      })),
    ),
);

const clave = (de: EtapaDeal, a: EtapaDeal) => `${de}>${a}`;

const INDICE = new Map<string, Transicion>();
for (const t of TRANSICIONES) {
  // Dos filas sobre el mismo par dirian dos cosas distintas sobre quien lo mueve o si
  // exige motivo, y la que gane dependeria del orden del arreglo. Se falla al cargar.
  if (INDICE.has(clave(t.de, t.a))) {
    throw new Error(`Transicion duplicada ${t.de} → ${t.a} (${INDICE.get(clave(t.de, t.a))!.id} y ${t.id})`);
  }
  // Un tipo de motivo sin exigir motivo no significa nada: seria una lista que nadie
  // pide. Se falla al cargar para que la tabla no diga dos cosas.
  if (t.tipoDeMotivo != null && !t.exigeMotivo) {
    throw new Error(`La flecha ${t.id} declara tipo de motivo (${t.tipoDeMotivo}) pero no exige motivo.`);
  }
  INDICE.set(clave(t.de, t.a), t);
}

/** La flecha de `de` a `a`, o `null` si ese movimiento no es legal. */
export function transicion(de: EtapaDeal, a: EtapaDeal): Transicion | null {
  return INDICE.get(clave(de, a)) ?? null;
}

/**
 * Las etapas desde las que una CITA NUEVA (una llamada agendada, venga del CRM, de
 * Calendly o de un re-envío del formulario) mueve el deal a Agendado: 1, 2, 3, 9 y 11
 * (decisión de Mani del 24-sep, ADR 0049 punto 4; `docs/tasks/071-mi-dia-del-closer.md`
 * y `docs/tasks/096`). Las flechas son T2, T3, T6, T23 y T27, todas hacia Agendado y ya
 * en la tabla `TRANSICIONES`; si alguna faltara, `moverEtapa()` la rechazaría en vez de
 * inventar una transición.
 *
 * La pregunta —"¿desde qué etapas una cita nueva mueve el deal a Agendado?"— es UNA, así
 * que la respuesta vive UNA vez aquí y la importan sus tres consumidores
 * (`lib/deals/llamadas.ts`, `lib/calendly/colgar-llamada.ts`,
 * `lib/ingesta/regla-de-deals.ts`). Estuvo copiada en los tres y ya había divergido: la
 * ingesta decía 1, 2 y 9 (escrita antes de que existiera Seguimiento), así que un lead en
 * Pendiente Re-agenda o en Seguimiento que re-enviaba el formulario con una cita válida
 * **no pasaba a Agendado** (hallazgo A1 del ticket 114).
 *
 * ⚠️ Ninguna regla compara NÚMEROS de etapa: el número es un nombre, no un orden. Cada
 * etapa va por su nombre del enum.
 */
export const ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO: readonly EtapaDeal[] = [
  "pendiente_setteo", // 1
  "en_contacto", // 2
  "pendiente_reagenda", // 3
  "proxima_cohorte", // 9
  "seguimiento", // 11
];

/** ¿Se puede pasar de `de` a `a`? */
export function esTransicionPermitida(de: EtapaDeal, a: EtapaDeal): boolean {
  return INDICE.has(clave(de, a));
}

/** Las etapas a las que se puede ir desde `de`, en el orden del enum. */
export function siguientesDe(de: EtapaDeal): EtapaDeal[] {
  return ETAPAS.filter((a) => esTransicionPermitida(de, a));
}
