import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { calls, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esAdministrador, trabajaLeads, type Rol } from "@/lib/auth/roles";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { moverEtapa } from "./mover-etapa";
import type { EtapaDeal } from "./etapas";

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

/**
 * Las etapas desde las que agregar una llamada MUEVE el deal a Agendado (decisión del
 * 24-sep, ADR 0049 punto 4): 1, 2, 3, 9 y 11. Las flechas son T2, T3, T6, T23 y T27,
 * todas hacia Agendado y ya en la tabla de transiciones (`lib/deals/etapas.ts`); si
 * alguna faltara, `moverEtapa()` la rechazaría y el error saldría a la luz en vez de
 * inventarse una transición.
 *
 * ⚠️ Ninguna regla compara NÚMEROS de etapa: el número es un nombre, no un orden
 * (`lib/deals/etapas.ts`). Cada etapa va por su nombre del enum.
 */
const ETAPAS_QUE_AVANZAN_A_AGENDADO: readonly EtapaDeal[] = [
  "pendiente_setteo", // 1
  "en_contacto", // 2
  "pendiente_reagenda", // 3
  "proxima_cohorte", // 9
  "seguimiento", // 11
];

// En 5, 6 y 7 (atendido, compromiso_verbal, abonado) agregar una llamada NO cambia la
// etapa (decisión del 24-sep): el lead ya está más adelante que "acaba de agendar".

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
    .url("El link de Calendly no es una URL válida.")
    .optional(),
  notas: z.string().trim().min(1).optional(),
});

export type DatosAgregarLlamada = z.input<typeof esquemaAgregarLlamada>;

/** Lo que dejó `agregarLlamada`: el id de la llamada y si el deal se movió a Agendado. */
export interface LlamadaAgregada {
  callId: string;
  /** `true` si el deal pasó a Agendado (etapas 1, 2, 3, 9, 11); `false` si no cambió. */
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

      // La etapa NUNCA se escribe aquí: si el deal está en 1, 2, 3, 9 u 11 se mueve a
      // Agendado por `moverEtapa()`, que ya ve la llamada recién creada (misma `db`) y
      // pasa el requisito `llamada_con_fecha`. En 5, 6 o 7 no se mueve.
      if (ETAPAS_QUE_AVANZAN_A_AGENDADO.includes(deal.etapa)) {
        await moverEtapa(db, {
          dealId: deal.id,
          a: "agendado",
          actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
        });
        return { callId, movioAAgendado: true };
      }

      // En 5, 6 o 7 la etapa no cambia (decisión del 24-sep). Cualquier otra etapa
      // abierta que no esté en ninguna de las dos listas se deja también sin mover: la
      // llamada queda registrada y no se inventa una transición que la tabla no tiene.
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
    .url("El link de Calendly no es una URL válida.")
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

    const [call] = await db
      .select()
      .from(calls)
      .where(and(eq(calls.id, callId), vigente(calls)));
    if (!call)
      throw new ErrorDeApp("No existe la llamada, o está anulada.", 404);
    if (call.resultado !== "agendada") {
      throw new ErrorDeApp("Solo se completa una llamada agendada.", 409);
    }
    if (call.closerUserId != null) {
      throw new ErrorDeApp(
        "Esta llamada ya tiene closer: no se vuelve a completar.",
        409,
      );
    }
    if (call.dealId == null) {
      throw new ErrorDeApp(
        "La llamada está suelta: asígnala a un deal antes de completarla.",
        409,
      );
    }

    // Que el actor sea el dueño del deal abierto de la llamada, y que el deal cuente.
    await dealAbiertoDelActor(db, call.dealId, actor);

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
        fechaAgenda,
        closerUserId: actor.userId,
        ...(linkCalendly !== undefined ? { linkCalendly } : {}),
      },
    );
  });
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
  if (deal.etapa === "completo" || deal.etapa === "cierre_perdido") {
    throw new ErrorDeApp(
      "El deal está cerrado: no se le agregan llamadas nuevas.",
      409,
    );
  }
  if (!esAdministrador(actor.rol)) {
    if (deal.ownerUserId == null) {
      throw new ErrorDeApp(
        "Este deal no tiene dueño: reclámalo antes de registrar una llamada.",
        409,
      );
    }
    if (deal.ownerUserId !== actor.userId) {
      throw new ErrorDeApp(
        "Solo el dueño del deal puede registrar sus llamadas.",
        403,
      );
    }
  }
  return { deal, emailLead };
}
