import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { calls, deals, leads, motivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { trabajaLeads, type Rol } from "@/lib/auth/roles";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { moverEtapa, RESULTADOS_FALLIDOS } from "./mover-etapa";
import { puedeTrabajarDeal } from "./permiso";
import { transicion, transicionPendiente, unaCitaMueveAAgendado, type EtapaDeal } from "./etapas";

/**
 * Agregar una llamada NATIVA a un deal, y completar la `agendada` que el sistema dejó
 * sin fecha (ticket 057, ADR 0037, ADR 0015, ADR 0049, decisión del 24-sep "un deal,
 * muchas llamadas").
 *
 * Una llamada es trabajo sobre una OPORTUNIDAD concreta (ADR 0037, enmienda al 0010):
 * cuelga del deal, no de la persona. Por eso una llamada nativa **no puede existir sin
 * deal** —la única Call sin deal es la suelta que trae Calendly y no se pudo colgar
 * sin duda (ADR 0049), que no nace aquí sino en el emparejador del ticket 096—.
 *
 * ## Quién puede
 *
 * Registrar una llamada es trabajar el lead: lo hace quien `trabajaLeads` (closer o
 * developer, ADR 0025 — nunca `rol === "closer"` a mano, o el developer queda afuera).
 * Un gerente administra pero no registra (ADR 0003), así que no puede. Y además tiene
 * que ser el DUEÑO del deal: reclamar un deal sin dueño es el ticket 070, fuera de
 * alcance, así que aquí un deal sin dueño se rechaza con un mensaje que lo dice.
 *
 * ## Toda escritura de `calls` pasa por `crearConRastro`/`editarConRastro`
 *
 * (ADR 0042, guardián `tests/rastro-operativo.test.ts`): la fila y su `change_log` en
 * la misma operación, y el actor sale de la sesión, nunca del input. La lectura del
 * deal y de la llamada pasa por `vigente(...)`/`incluyendoAnulados(...)` de
 * `lib/queries/vigente.ts` (ADR 0026, guardián `tests/vigencia-centralizada.test.ts`).
 *
 * ## La etapa nunca se escribe aquí
 *
 * El único camino para mover `deals.etapa` es `moverEtapa()` (ADR 0037 punto 4). Al
 * agregar una llamada, si el deal está en una etapa que avanza a Agendado, se llama a
 * `moverEtapa()`; la etapa jamás se toca a mano.
 */

/** El actor que registra: siempre una persona (sale de la sesión), con su rol de vista. */
export interface ActorDeLlamada {
  userId: string;
  rol: Rol;
}

/** `unaCitaMueveAAgendado` es la única regla para el efecto de una cita nueva. */

type Transaccion = {
  transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T>;
};

/**
 * Datos de una llamada nativa que se agrega a un deal. La fecha de agenda es un
 * INSTANTE (`timestamptz`), no un día de calendario: quien la arma la construye en
 * Bogotá (`-05:00`), nunca con `new Date(a, m, d)` ni `toISOString().slice(0, 10)`.
 */
export const esquemaAgregarLlamada = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  fechaAgenda: z.date({ message: "Falta la fecha de la cita." }),
  linkCalendly: z
    .string()
    .url("El link de la reunión no es una URL válida.")
    .optional(),
  notas: z.string().trim().min(1).optional(),
});

export type DatosAgregarLlamada = z.input<typeof esquemaAgregarLlamada>;

/** Lo que dejó `agregarLlamada`: el id de la llamada y si el deal se movió a Agendado. */
export interface LlamadaAgregada {
  callId: string;
  /** `true` si el deal pasó a Agendado (`unaCitaMueveAAgendado`); `false` si no cambió. */
  movioAAgendado: boolean;
}

/**
 * Agrega una llamada nativa a un deal vigente y abierto, con el actor como dueño de la
 * llamada (`closer_user_id`), y —según la etapa del deal— la mueve a Agendado.
 *
 * La llamada nace con `deal_id`, `program_id` y `cohort_id` HEREDADOS del deal (no los
 * pasa el llamador: el deal es la frontera, ADR 0043), `resultado = "agendada"` y
 * `origen = "crm"`. La fecha de agenda es lo que satisface el requisito
 * `llamada_con_fecha` de las flechas a Agendado, así que se escribe ANTES de mover, en
 * la misma transacción del motor cuando corresponde.
 */
export async function agregarLlamada(
  db: Db,
  actor: ActorDeLlamada,
  datos: DatosAgregarLlamada,
): Promise<LlamadaAgregada> {
  return normalizando(async () => {
    const { dealId, fechaAgenda, linkCalendly, notas } =
      esquemaAgregarLlamada.parse(datos);

    exigirQueTrabajeLeads(actor);

    // Una transaccion: la llamada y el movimiento a Agendado van juntos o no va
    // ninguno. Sin ella, un rechazo del motor dejaria la llamada creada y el deal
    // en su etapa vieja. `moverEtapa` abre la suya adentro (savepoint), igual que
    // cuando la llama la ingesta.
    return (db as unknown as Transaccion).transaction(async (db) => {
      const { deal, emailLead } = await dealAbiertoDelActor(db, dealId, actor);

      const callId = await crearConRastro(
        {
          db,
          tabla: calls,
          nombreTabla: "calls",
          actorId: actor.userId,
          etiqueta: emailLead ?? deal.id,
        },
        {
          dealId: deal.id,
          programId: deal.programId,
          cohortId: deal.cohortId,
          emailLead,
          closerUserId: actor.userId,
          fechaAgenda,
          linkCalendly: linkCalendly ?? null,
          resultado: "agendada" as const,
          origen: "crm",
          notas: notas ?? null,
        },
      );

      // La etapa nunca se escribe aquí: el motor ve la llamada recién creada en la misma transacción.
      if (unaCitaMueveAAgendado(deal.etapa, deal.pendiente)) {
        await moverEtapa(db, {
          dealId: deal.id,
          a: "agendado",
          actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
        });
        return { callId, movioAAgendado: true };
      }

      // Si la regla no mueve, la llamada queda registrada sin inventar una transición.
      return { callId, movioAAgendado: false };
    });
  });
}

/**
 * Datos para completar la `agendada` que el sistema dejó sin fecha (la que crea la
 * regla de Calendly, ADR 0049, con `closer_user_id` nulo). El dueño del deal le pone la
 * fecha y el link, y queda como su `closer_user_id`, todo por `editarConRastro` para
 * que el `change_log` registre quién lo hizo.
 */
export const esquemaCompletarAgendada = z.object({
  callId: z.string().uuid("La llamada no es válida."),
  fechaAgenda: z.date({ message: "Falta la fecha de la cita." }),
  linkCalendly: z
    .string()
    .url("El link de la reunión no es una URL válida.")
    .optional(),
});

export type DatosCompletarAgendada = z.input<typeof esquemaCompletarAgendada>;

/**
 * Completa una llamada `agendada` SIN closer (la que crea el sistema, ADR 0049): el
 * dueño del deal escribe fecha y link, y queda como `closer_user_id`. Por
 * `editarConRastro`, así el `change_log` guarda quién la completó.
 *
 * Solo se completa una llamada que:
 *  - está vigente (no anulada),
 *  - tiene `resultado = "agendada"`,
 *  - todavía no tiene `closer_user_id` (una ya reclamada no se re-completa aquí),
 *  - cuelga de un deal vigente y abierto del que el actor es dueño.
 */
export async function completarAgendada(
  db: Db,
  actor: ActorDeLlamada,
  datos: DatosCompletarAgendada,
): Promise<void> {
  return normalizando(async () => {
    const { callId, fechaAgenda, linkCalendly } =
      esquemaCompletarAgendada.parse(datos);

    exigirQueTrabajeLeads(actor);

    return (db as unknown as Transaccion).transaction(async (tx) => {
      const [call] = await tx.select().from(calls).where(and(eq(calls.id, callId), vigente(calls)));
      if (!call) throw new ErrorDeApp("No existe la llamada, o está anulada.", 404);
      if (call.resultado !== "agendada") throw new ErrorDeApp("Solo se completa una llamada agendada.", 409);
      if (call.closerUserId != null) throw new ErrorDeApp("Esta llamada ya tiene closer: no se vuelve a completar.", 409);
      if (call.dealId == null) throw new ErrorDeApp("La llamada está suelta: asígnala a un deal antes de completarla.", 409);

      const { deal } = await dealAbiertoDelActor(tx, call.dealId, actor);
      await editarConRastro(
        { db: tx, tabla: calls, nombreTabla: "calls", actorId: actor.userId, etiqueta: call.emailLead ?? call.id },
        call.id,
        { fechaAgenda, closerUserId: actor.userId, ...(linkCalendly !== undefined ? { linkCalendly } : {}) },
      );
      if (unaCitaMueveAAgendado(deal.etapa, deal.pendiente)) {
        await moverEtapa(tx, {
          dealId: deal.id,
          a: "agendado",
          actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
        });
      }
    });
  });
}

// ─────────────────────────────────────────── 058 · pegar el Grain = sucedió

/**
 * Datos para pegar el link de Grain a una llamada (ticket 058). El link es lo único
 * que teclea el closer: el `show`, la fecha y el movimiento a Atendido salen de él.
 *
 * El link se valida SOLO como URL razonable: el ticket dice explícito que NO se
 * comprueba que sea de Grain de verdad, porque una reja que rechace un link válido de
 * otra herramienta cuesta más de lo que protege.
 */
export const esquemaPegarGrain = z.object({
  callId: z.string().uuid("La llamada no es válida."),
  linkGrain: z.string().url("El link de la grabación no es una URL válida."),
});

export type DatosPegarGrain = z.input<typeof esquemaPegarGrain>;

/** Lo que dejó `pegarGrain`: si el deal se movió a Atendido, y su etapa final. */
export interface GrainPegado {
  /** `true` si el deal pasó a Atendido; `false` si ya estaba ahí o más adelante. */
  movioAAtendido: boolean;
  etapa: EtapaDeal;
}

/**
 * Pegar el link de Grain **es** decir que la llamada sucedió (ticket 058, ADR 0037):
 * en una sola operación escribe `link_grain`, pone `resultado = "show"`, llena
 * `fecha_llamada` SOLO si estaba vacía (no la pisa), y mueve el deal a **Atendido**
 * por `moverEtapa()` si la tabla lo permite desde la etapa actual.
 *
 * ## Qué transición se usa, y de qué etapa
 *
 * Atendido se alcanza desde Agendado por E8. Exige `llamada_sucedio`, y `resultado = "show"` lo cumple
 * (`RESULTADOS_QUE_OCURRIERON` en `mover-etapa.ts`). Al pegar Grain el movimiento lo
 * toma `{ tipo: "sistema" }`: el enlace es el hecho que el CRM observa. A mano, el
 * closer puede dar por atendida la ultima llamada vigente con fecha sin inventar Grain.
 *
 * Si el deal ya está en Atendido —o en cualquier etapa desde la que la tabla no tiene
 * flecha a Atendido (por ejemplo Compromiso Verbal o Seguimiento)— **no se mueve**: se
 * escribe el Grain y el `show` igual, y `movioAAtendido` sale `false`. No se inventa
 * ninguna transición: se pregunta a `transicion()` y, si no existe, no se mueve.
 *
 * ## Todo en UNA transacción
 *
 * La escritura de la llamada y el movimiento van juntos o nada: si el motor rechaza el
 * movimiento, la escritura del Grain se deshace con él.
 */
export async function pegarGrain(
  db: Db,
  actor: ActorDeLlamada,
  datos: DatosPegarGrain,
): Promise<GrainPegado> {
  return normalizando(async () => {
    const { callId, linkGrain } = esquemaPegarGrain.parse(datos);

    exigirQueTrabajeLeads(actor);

    // Pegar el Grain escribe el `link_grain` ADEMÁS de marcar el show: el cuerpo común
    // (resultado show, fecha si estaba vacía, movimiento a Atendido) vive en
    // `marcarComoShow`; aquí solo se le suma el campo del enlace.
    return (db as unknown as Transaccion).transaction(async (db) => {
      const { call, deal } = await llamadaVigenteDeDealAbierto(db, callId, actor);
      return marcarComoShow(db, actor, call, deal, { linkGrain });
    });
  });
}

// ─────────────────────────────────────────── 177 · "Show" en un clic (sin Grain)

/** Datos para marcar una llamada como show en un clic (ticket 177): solo la llamada. */
export const esquemaMarcarShow = z.object({
  callId: z.string().uuid("La llamada no es válida."),
});

export type DatosMarcarShow = z.input<typeof esquemaMarcarShow>;

/**
 * Marcar una llamada como **show** en un clic (ticket 177, decisión de Mani del 3-oct),
 * sin pegar el link de Grain. Hermana de `pegarGrain`: mismo molde (transacción,
 * `llamadaVigenteDeDealAbierto`, `editarConRastro`), misma regla de `fecha_llamada` (se
 * llena solo si estaba vacía) y el mismo movimiento a **Atendido** por `moverEtapa()` si
 * la tabla tiene la flecha desde la etapa actual.
 *
 * El Grain deja de ser requisito para decir "la llamada sucedió": `resultado = "show"`
 * cumple `llamada_sucedio` (`RESULTADOS_QUE_OCURRIERON`). Una llamada show sin Grain no
 * bloquea ningún movimiento; su falta de link sale como alerta amarilla, nunca como reja.
 *
 * Si la llamada ya tiene un resultado (no sigue `agendada`), se rechaza con 409: "marcar
 * show" es la salida de una cita pendiente, no un re-marcado de una llamada ya resuelta
 * (quien pega el Grain sobre una ya atendida usa `pegarGrain`, que solo suma el link).
 */
export async function marcarShow(
  db: Db,
  actor: ActorDeLlamada,
  datos: DatosMarcarShow,
): Promise<GrainPegado> {
  return normalizando(async () => {
    const { callId } = esquemaMarcarShow.parse(datos);

    exigirQueTrabajeLeads(actor);

    return (db as unknown as Transaccion).transaction(async (db) => {
      const { call, deal } = await llamadaVigenteDeDealAbierto(db, callId, actor);
      if (call.resultado !== "agendada") {
        throw new ErrorDeApp("Solo se marca como show una llamada agendada.", 409);
      }
      return marcarComoShow(db, actor, call, deal, {});
    });
  });
}

/**
 * El cuerpo COMÚN de `pegarGrain` y `marcarShow` (ticket 058, 177): sobre una llamada
 * vigente de un deal abierto del actor (ya leídos por el llamador), escribe
 * `resultado = "show"`, llena `fecha_llamada` SOLO si estaba vacía, y mueve el deal a
 * **Atendido** por `moverEtapa()` si la tabla tiene la flecha desde la etapa actual. El
 * movimiento lo toma el SISTEMA: el hecho (la llamada sucedió) lo observa el CRM.
 *
 * `extra` suma lo que diferencia a cada llamador: `pegarGrain` pasa `{ linkGrain }` y
 * `marcarShow` no pasa nada. Debe correr DENTRO de una transacción (la abren sus dos
 * llamadores): la escritura de la llamada y el movimiento van juntos o nada.
 */
async function marcarComoShow(
  db: Db,
  actor: ActorDeLlamada,
  call: typeof calls.$inferSelect,
  deal: FilaDeal,
  extra: { linkGrain?: string },
): Promise<GrainPegado> {
  const ahora = new Date();
  const fechaLlamada = call.fechaAgenda != null && call.fechaAgenda <= ahora
    ? call.fechaAgenda
    : ahora;

  await editarConRastro(
    {
      db,
      tabla: calls,
      nombreTabla: "calls",
      actorId: actor.userId,
      etiqueta: call.emailLead ?? call.id,
    },
    call.id,
    {
      ...(extra.linkGrain !== undefined ? { linkGrain: extra.linkGrain } : {}),
      resultado: "show" as const,
      ...(call.fechaLlamada == null ? { fechaLlamada } : {}),
    },
  );

  // Mover a Atendido solo si la tabla tiene la flecha desde la etapa actual. Si no hay
  // flecha (ya está en Atendido o más adelante), no se mueve y no se inventa una transición.
  if (transicion(deal.etapa, "atendido") != null) {
    const hecho = await moverEtapa(db, {
      dealId: deal.id,
      a: "atendido",
      actor: { tipo: "sistema" },
    });
    return { movioAAtendido: true, etapa: hecho.a };
  }

  return { movioAAtendido: false, etapa: deal.etapa };
}

// ─────────────────────────────────────────── 177 · Reagendar: cierra la cita vieja

/**
 * Datos para reagendar una cita (ticket 177): la llamada vieja que se cierra y los datos
 * de la nueva, iguales a los de `agregarLlamada`.
 */
export const esquemaReagendar = z.object({
  callId: z.string().uuid("La llamada no es válida."),
  fechaAgenda: z.date({ message: "Falta la fecha de la cita." }),
  motivoId: z.string().uuid("El motivo no es válido.").optional(),
  linkCalendly: z
    .string()
    .url("El link de la reunión no es una URL válida.")
    .optional(),
  notas: z.string().trim().min(1).optional(),
});

export type DatosReagendar = z.input<typeof esquemaReagendar>;

/**
 * Reagendar una cita en un solo acto (ticket 177): marca la cita vieja `reagendada` y
 * crea la nueva, TODO en la misma transacción. Antes esto era "agregar una llamada" y
 * dejaba la vieja `agendada` sin resultado para siempre, saliendo en "Llamadas que ya
 * pasaron sin resultado" del Inbox (176). Calendly ya cierra la vieja (ADR 0049,
 * `eventos-de-cita.ts`); esto hace lo mismo desde la ficha.
 *
 * Solo se reagenda una llamada que sigue `agendada`: una que ya tiene resultado se
 * rechaza con 409 (ya se resolvió con un show, un no-show o una cancelación). La cita
 * nueva nace y mueve el deal con los MISMOS helpers que `agregarLlamada` —no se copia la
 * lógica—: `dealAbiertoDelActor`, `unaCitaMueveAAgendado` y `moverEtapa`.
 */
export async function reagendarLlamada(
  db: Db,
  actor: ActorDeLlamada,
  datos: DatosReagendar,
): Promise<LlamadaAgregada> {
  return normalizando(async () => {
    const { callId, fechaAgenda, motivoId, linkCalendly, notas } = esquemaReagendar.parse(datos);

    exigirQueTrabajeLeads(actor);

    return (db as unknown as Transaccion).transaction(async (db) => {
      // La cita vieja y su deal, con las mismas rejas que las demás mutaciones de llamada.
      const { call: vieja, deal } = await llamadaVigenteDeDealAbierto(db, callId, actor);
      if (vieja.resultado !== "agendada") {
        throw new ErrorDeApp("Solo se reagenda una llamada agendada.", 409);
      }

      if (motivoId) {
        const [motivo] = await db
          .select({ id: motivos.id })
          .from(motivos)
          .where(and(eq(motivos.id, motivoId), eq(motivos.tipo, "reagenda"), eq(motivos.activo, true)));
        if (!motivo) throw new ErrorDeApp("El motivo de re-agenda no existe o está inactivo.", 422);
      }

      // La vieja queda `reagendada`: deja de contar como "cita sin resultado" y sale del
      // Inbox (seccionLlamadasDeHoy filtra `resultado = 'agendada'`).
      await editarConRastro(
        {
          db,
          tabla: calls,
          nombreTabla: "calls",
          actorId: actor.userId,
          etiqueta: vieja.emailLead ?? vieja.id,
        },
        vieja.id,
        { resultado: "reagendada" as const, ...(motivoId ? { motivoId } : {}) },
      );

      // La nueva cita nace exactamente como en `agregarLlamada`: heredando del deal,
      // `agendada`, `origen = "crm"`, y moviendo a Agendado si la regla lo pide.
      const callId2 = await crearConRastro(
        {
          db,
          tabla: calls,
          nombreTabla: "calls",
          actorId: actor.userId,
          etiqueta: vieja.emailLead ?? deal.id,
        },
        {
          dealId: deal.id,
          programId: deal.programId,
          cohortId: deal.cohortId,
          emailLead: vieja.emailLead,
          closerUserId: actor.userId,
          fechaAgenda,
          linkCalendly: linkCalendly ?? null,
          resultado: "agendada" as const,
          origen: "crm",
          notas: notas ?? null,
        },
      );

      if (unaCitaMueveAAgendado(deal.etapa, deal.pendiente)) {
        await moverEtapa(db, {
          dealId: deal.id,
          a: "agendado",
          actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
        });
        return { callId: callId2, movioAAgendado: true };
      }

      return { callId: callId2, movioAAgendado: false };
    });
  });
}

// ─────────────────────────────── 059 · no_show / cancelada → pendiente Re-agenda

/**
 * Los dos resultados de una llamada fallida (ADR 0015). **Siguen siendo distintos**
 * —aviso antes (`cancelada`) no es lo mismo que no apareció (`no_show`)—: que disparen
 * el mismo pendiente Re-agenda no los fusiona.
 *
 * La lista es UNA y vive en `lib/deals/mover-etapa.ts` (el motor la lee para el hecho
 * `llamada_fallida`); aquí se re-exporta para no romper a quien la importa desde este
 * módulo (la server action de acciones de deal). Estuvo copiada en los dos y hoy eran
 * iguales (hallazgo A3 del ticket 114).
 */
export { RESULTADOS_FALLIDOS };

/**
 * Datos para marcar una llamada como fallida (ticket 059).
 */
export const esquemaMarcarFallida = z.object({
  callId: z.string().uuid("La llamada no es válida."),
  resultado: z.enum(RESULTADOS_FALLIDOS, {
    message: "El resultado tiene que ser no_show o cancelada.",
  }),
  motivoId: z.string().uuid("El motivo no es válido.").optional(),
});

export type DatosMarcarFallida = z.input<typeof esquemaMarcarFallida>;

/** Lo que dejó `marcarFallida`: la etapa final del deal tras el movimiento. */
export interface LlamadaFallida {
  etapa: EtapaDeal;
}

/**
 * Marca una llamada como `no_show` o `cancelada` y pone Re-agenda mediante PR1,
 * sin cambiar la etapa Agendado.
 *
 * En las dos, el requisito de dato es `llamada_fallida`, que mira la ÚLTIMA llamada del
 * deal (`mover-etapa.ts`); por eso el `resultado` se escribe ANTES de mover, en la
 * misma transacción. Desde cualquier otra etapa la tabla no tiene flecha a Re-agenda:
 * se rechaza por el motor (no se inventa transición) tras haber escrito el resultado
 * dentro de la transacción, que entonces se deshace entera.
 */
export async function marcarFallida(
  db: Db,
  actor: ActorDeLlamada,
  datos: DatosMarcarFallida,
): Promise<LlamadaFallida> {
  return normalizando(async () => {
    const { callId, resultado, motivoId } = esquemaMarcarFallida.parse(datos);

    exigirQueTrabajeLeads(actor);

    return (db as unknown as Transaccion).transaction(async (db) => {
      const { call, deal } = await llamadaVigenteDeDealAbierto(db, callId, actor);

      // El resultado se escribe ANTES de mover: `llamada_fallida` mira la última llamada
      // vigente del deal, así que el motor tiene que verlo ya escrito. Ambos van en la
      // misma transacción: si el movimiento se rechaza, el resultado se deshace.
      await editarConRastro(
        {
          db,
          tabla: calls,
          nombreTabla: "calls",
          actorId: actor.userId,
          etiqueta: call.emailLead ?? call.id,
        },
        call.id,
        { resultado },
      );

      // La flecha a Re-agenda decide quién la toma: desde Agendado es del sistema (PR1, el
      // resultado de la llamada es el hecho), desde Atendido es del closer con motivo (PR2).
      // Se pregunta a la tabla; si no hay flecha, el motor rechaza y no se inventa nada.
      const t = transicionPendiente(deal.etapa, "reagenda");
      const hecho = await moverEtapa(db, {
        dealId: deal.id,
        a: deal.etapa,
        pendiente: "reagenda",
        actor: t?.quien === "sistema"
          ? { tipo: "sistema" }
          : { tipo: "usuario", userId: actor.userId, rol: actor.rol },
        ...(motivoId !== undefined ? { motivoId } : {}),
      });

      return { etapa: hecho.a };
    });
  });
}

/**
 * Lee una llamada VIGENTE (no anulada) y el deal ABIERTO del que cuelga, exigiendo que
 * el actor pueda trabajarlo (dueño, o `esAdministrador` — el developer pasa por ahí,
 * igual que en `dealAbiertoDelActor`). La usan las mutaciones que operan sobre una
 * llamada existente (058, 059): comparten el mismo cuerpo de rejas.
 *
 * Una llamada anulada no cuenta en ninguna métrica (ADR 0026) y no se toca; una suelta
 * (sin `deal_id`) tampoco se opera aquí (se asigna primero, ADR 0049).
 */
async function llamadaVigenteDeDealAbierto(
  db: Db,
  callId: string,
  actor: ActorDeLlamada,
): Promise<{ call: typeof calls.$inferSelect; deal: FilaDeal }> {
  const [call] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, callId), vigente(calls)));
  if (!call) throw new ErrorDeApp("No existe la llamada, o está anulada.", 404);
  if (call.dealId == null) {
    throw new ErrorDeApp(
      "La llamada está suelta: asígnala a un deal antes de operarla.",
      409,
    );
  }
  const { deal } = await dealAbiertoDelActor(db, call.dealId, actor);
  return { call, deal };
}

/**
 * Registrar una llamada es trabajar el lead: lo hace quien `trabajaLeads` (closer o
 * developer, ADR 0025). Un gerente administra pero no registra (ADR 0003). Nunca se
 * pregunta `rol === "closer"` a mano, o el developer quedaría afuera.
 */
function exigirQueTrabajeLeads(actor: ActorDeLlamada): void {
  if (!trabajaLeads(actor.rol)) {
    throw new ErrorDeApp("Solo un closer registra llamadas de un deal.", 403);
  }
}

/** El deal, tal como sale de la base (con la marca de anulación), con el correo de su lead. */
type FilaDeal = typeof deals.$inferSelect;
interface DealDelActor {
  deal: FilaDeal;
  /** El correo normalizado del lead del deal, para la etiqueta del rastro y `calls.email_lead`. */
  emailLead: string | null;
}

/**
 * Lee el deal por su id y exige que cuente y que el actor pueda trabajarlo:
 *  - existe (`incluyendoAnulados` para verlo aunque esté anulado y dar el mensaje justo),
 *  - no está anulado (un deal anulado no cuenta en ninguna métrica, ADR 0038),
 *  - está abierto (no `completo` ni `cierre_perdido`): sobre un deal cerrado no se
 *    registran llamadas nuevas,
 *  - tiene dueño y es el actor —salvo que el actor administre (ADR 0025)—. Un deal sin
 *    dueño no se toca aquí: reclamarlo es el ticket 070.
 *
 * Se lee con `incluyendoAnulados` a propósito: es "dame la fila que voy a tocar" por
 * clave primaria, no una métrica. Si un deal anulado se puede tocar o no es una regla
 * de este módulo (no: se rechaza abajo), no de la lectura, y escribirlo con su nombre
 * deja la decisión en el grep.
 */
async function dealAbiertoDelActor(
  db: Db,
  dealId: string,
  actor: ActorDeLlamada,
): Promise<DealDelActor> {
  const [fila] = await db
    .select({ deal: deals, emailLead: leads.emailNormalizado })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!fila) throw new ErrorDeApp("No existe el deal.", 404);
  const { deal, emailLead } = fila;
  if (deal.anuladoEn) {
    throw new ErrorDeApp(
      "El deal está anulado: no cuenta en ninguna métrica y no se le agregan llamadas.",
      409,
    );
  }
  if (deal.etapa === "ganado_completo" || deal.etapa === "cierre_perdido") {
    throw new ErrorDeApp(
      "El deal está cerrado: no se le agregan llamadas nuevas.",
      409,
    );
  }
  if (!puedeTrabajarDeal(actor, deal)) {
    if (deal.ownerUserId == null) {
      throw new ErrorDeApp(
        "Este deal no tiene dueño: reclámalo antes de registrar una llamada.",
        409,
      );
    }
    throw new ErrorDeApp(
      "Solo el dueño del deal puede registrar sus llamadas.",
      403,
    );
  }
  return { deal, emailLead };
}
