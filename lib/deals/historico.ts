import { and, eq } from "drizzle-orm";
import { abonos, calls, deals, users } from "@/lib/db/schema";
import { crearConRastro } from "@/lib/crm/rastro";
import { esViolacionUnica } from "@/lib/db/errores";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { mismoCloser } from "@/lib/closers/identidad";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { duenosPosibles } from "./duenos";

export { abrirDealHistorico, type AltaHistorica, type DealHistorico } from "./mover-etapa";

/**
 * El escritor de lo HISTORICO: lo que paso en las pestañas de gestion antes del CRM
 * (ADR 0059, ticket 078). Lo usa solo la migracion, y un guardian lo fija
 * (`tests/migracion-escritor-guardian.test.ts`).
 *
 * Las mutaciones de siempre no pueden expresar el pasado: `registrarAbono` exige que el
 * actor sea el dueño y mueve el deal, y `agregarLlamada` crea una `agendada` y tambien lo
 * mueve. Aqui nada mueve la etapa: el deal ya nacio en la que dice la hoja
 * (`abrirDealHistorico`, que vive en el motor porque escribe la etapa).
 *
 * - **El rastro es del script, los hechos del sistema** (punto 5): `change_log` lleva el
 *   `actorId` de `actorDelScript()`; el closer de la hoja queda como texto copiado en
 *   `closer_id` (ADR 0030), nunca como una cuenta a la que se le atribuye.
 * - **La segunda corrida no duplica porque la base lo rechaza** (punto 2, ADR 0005): el
 *   choque de la huella se devuelve como `ya_migrado`, no como error.
 */

export type EscrituraHistorica = { estado: "creado"; id: string } | { estado: "ya_migrado"; id: string };

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/**
 * El dueño de un deal historico sale del nombre que escribio la hoja SOLO si ese nombre es
 * un usuario del CRM que puede ser dueño en el programa (ADR 0059 punto 5, `duenosPosibles`).
 * Si no, el deal nace sin dueño y cae al Inbox (080). La comparacion de nombres es la de
 * siempre, `mismoCloser` (ADR 0030): `Maru` y `maru ` son la misma closer.
 */
export async function duenoDesdeLaHoja(db: Db, programId: string, nombre: string | null | undefined): Promise<string | null> {
  if (!nombre || nombre.trim() === "") return null;
  const posibles = new Set((await duenosPosibles(db, programId)).map((d) => d.id));
  const candidatos = await db.select({ id: users.id, closerId: users.closerId }).from(users);
  const encontrado = candidatos.find((u) => posibles.has(u.id) && mismoCloser(u.closerId, nombre));
  return encontrado?.id ?? null;
}

export interface AbonoHistorico {
  dealId: string;
  /** `sheets:<programa>:<pestaña>:<llave>`. */
  huella: string;
  actorId: string;
  /** Fecha de negocio de Bogota (`YYYY-MM-DD`). Sin fecha en la hoja, la aproximada del punto 6. */
  fecha: string;
  /** En USD, como todo el sistema (081 descartado). */
  monto: string;
  /** Nula si la plataforma de la hoja no esta en el catalogo: es rareza (punto 7). */
  plataformaId?: string | null;
  /** El nombre como lo escribio la hoja. */
  closer?: string | null;
}

/**
 * Registra un abono historico sobre un deal ya migrado. **No mueve la etapa** ni pasa por
 * la reja del sobrepago: la hoja dice lo que se cobro, y lo que no cuadre es rareza del
 * importador, no un rechazo que pierda la plata.
 */
export async function registrarAbonoHistorico(db: Db, abono: AbonoHistorico): Promise<EscrituraHistorica> {
  exigirHuella(abono.huella);
  if (!(Number(abono.monto) > 0)) throw new ErrorDeApp("El monto de un abono tiene que ser mayor que cero.", 422);

  return conHuella(
    () => buscarAbono(db, abono.huella),
    () =>
      (db as unknown as Transaccion).transaction(async (tx) => {
        const deal = await dealDeLaMigracion(tx, abono.dealId);
        return crearConRastro(
          { db: tx, tabla: abonos, nombreTabla: "abonos", actorId: abono.actorId, etiqueta: deal.id },
          {
            dealId: deal.id,
            programId: deal.programId,
            fecha: abono.fecha,
            monto: abono.monto,
            moneda: "USD",
            plataformaId: abono.plataformaId ?? null,
            closerId: abono.closer ?? null,
            origen: "sheets",
            huellaMigracion: abono.huella,
          },
        );
      }),
  );
}

export interface LlamadaHistorica {
  programId: string;
  /** Nulo si la fila no se pudo colgar de un deal (sin correo, lead desconocido): es rareza. */
  dealId?: string | null;
  huella: string;
  actorId: string;
  resultado: (typeof calls.$inferInsert)["resultado"];
  fechaAgenda?: Date | null;
  fechaLlamada?: Date | null;
  closer?: string | null;
  emailLead?: string | null;
  motivoPerdida?: string | null;
  notas?: string | null;
}

/**
 * Registra una llamada historica con su resultado (`origen = "sheets"`), colgada de su deal
 * si se sabe cual. **No mueve la etapa**. La huella va en `huella_fila`, que `calls` ya
 * tenia con su indice unico por programa.
 */
export async function registrarLlamadaHistorica(db: Db, llamada: LlamadaHistorica): Promise<EscrituraHistorica> {
  exigirHuella(llamada.huella);

  return conHuella(
    () => buscarLlamada(db, llamada.programId, llamada.huella),
    () =>
      (db as unknown as Transaccion).transaction(async (tx) => {
        let cohortId: string | null = null;
        if (llamada.dealId) {
          const deal = await dealDeLaMigracion(tx, llamada.dealId);
          // El programa es frontera (ADR 0043): una llamada de un programa colgada de un deal
          // de otro mezclaria las dos economias sin lanzar ningun error.
          if (deal.programId !== llamada.programId) {
            throw new ErrorDeApp("El deal es de otro programa: la llamada no se puede colgar de el.", 422);
          }
          cohortId = deal.cohortId;
        }
        return crearConRastro(
          {
            db: tx,
            tabla: calls,
            nombreTabla: "calls",
            actorId: llamada.actorId,
            etiqueta: llamada.emailLead ?? llamada.huella,
          },
          {
            dealId: llamada.dealId ?? null,
            programId: llamada.programId,
            cohortId,
            closerId: llamada.closer ?? null,
            emailLead: llamada.emailLead ?? null,
            fechaAgenda: llamada.fechaAgenda ?? null,
            fechaLlamada: llamada.fechaLlamada ?? null,
            resultado: llamada.resultado,
            motivoPerdida: llamada.motivoPerdida ?? null,
            notas: llamada.notas ?? null,
            origen: "sheets",
            huellaFila: llamada.huella,
          },
        );
      }),
  );
}

function exigirHuella(huella: string): void {
  if (huella.trim() === "") {
    throw new Error("Una fila historica sin huella no se puede volver a encontrar: la migracion la tiene que dar.");
  }
}

/**
 * El deal al que se le cuelga algo: tiene que existir, no estar anulado y **haber salido de
 * la migracion**. Al deal vivo del CRM no se le cuelga nada (ADR 0059 punto 3): un abono
 * historico sobre el no lo moveria de etapa y dejaria su saldo y su etapa en desacuerdo.
 */
async function dealDeLaMigracion(tx: Db, dealId: string): Promise<typeof deals.$inferSelect> {
  const [deal] = await tx.select().from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
  if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado: no se le cuelga nada.", 409);
  if (deal.huellaMigracion == null) {
    throw new ErrorDeApp("El deal es del CRM, no de la migración: gana el vivo y no se le cuelga nada.", 409);
  }
  return deal;
}

/**
 * Escribe, y si la base rechaza la huella repetida devuelve la fila que ya estaba. La
 * pregunta se hace DESPUES del choque y fuera de la transaccion deshecha: quien decide que
 * ya entro es el indice, no un `select` previo (ADR 0005).
 */
async function conHuella(
  buscar: () => Promise<string | undefined>,
  escribir: () => Promise<string>,
): Promise<EscrituraHistorica> {
  try {
    return { estado: "creado", id: await escribir() };
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    const id = await buscar();
    if (id) return { estado: "ya_migrado", id };
    throw e;
  }
}

async function buscarAbono(db: Db, huella: string): Promise<string | undefined> {
  const [fila] = await db
    .select({ id: abonos.id })
    .from(abonos)
    .where(and(eq(abonos.huellaMigracion, huella), incluyendoAnulados(abonos)));
  return fila?.id;
}

async function buscarLlamada(db: Db, programId: string, huella: string): Promise<string | undefined> {
  const [fila] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.programId, programId), eq(calls.huellaFila, huella), incluyendoAnulados(calls)));
  return fila?.id;
}
