import { and, inArray } from "drizzle-orm";
import { abonos, calls, deals, users } from "@/lib/db/schema";
import { crearVariosConRastro } from "@/lib/crm/rastro";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { mismoCloser } from "@/lib/closers/identidad";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { duenosPosibles } from "./duenos";

export { abrirDealHistorico, abrirDealesHistoricos, type AltaHistorica, type DealHistorico } from "./mover-etapa";

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
  const [r] = await registrarAbonosHistoricos(db, [abono]);
  return r;
}

/**
 * `registrarAbonoHistorico` en lote (ticket 078): las mismas reglas, en una transaccion y con
 * un insert de varias filas. La huella repetida la decide el indice (`ON CONFLICT DO
 * NOTHING`, ADR 0005) y despues se busca cual era. Un resultado por abono, en orden.
 */
export async function registrarAbonosHistoricos(db: Db, lista: readonly AbonoHistorico[]): Promise<EscrituraHistorica[]> {
  for (const abono of lista) {
    exigirHuella(abono.huella);
    if (!(Number(abono.monto) > 0)) throw new ErrorDeApp("El monto de un abono tiene que ser mayor que cero.", 422);
  }
  if (lista.length === 0) return [];
  const actorId = unSoloActor(lista);

  return (db as unknown as Transaccion).transaction(async (tx) => {
    const deal = await dealesDeLaMigracion(tx, lista.map((a) => a.dealId));
    const ids = await crearVariosConRastro(
      { db: tx, tabla: abonos, nombreTabla: "abonos", actorId, omitirChoques: true },
      lista.map((abono) => {
        const d = deal.get(abono.dealId)!;
        return {
          etiqueta: d.id,
          valores: {
            dealId: d.id,
            programId: d.programId,
            fecha: abono.fecha,
            monto: abono.monto,
            moneda: "USD",
            plataformaId: abono.plataformaId ?? null,
            closerId: abono.closer ?? null,
            origen: "sheets",
            huellaMigracion: abono.huella,
          },
        };
      }),
    );

    const chocadas = lista.filter((_, i) => ids[i] == null).map((a) => a.huella);
    const previos = new Map<string, string>();
    if (chocadas.length > 0) {
      const filas = await tx
        .select({ id: abonos.id, huella: abonos.huellaMigracion })
        .from(abonos)
        .where(and(inArray(abonos.huellaMigracion, chocadas), incluyendoAnulados(abonos)));
      for (const f of filas) if (f.huella) previos.set(f.huella, f.id);
    }
    return lista.map((abono, i) => resultado(ids[i], previos.get(abono.huella)));
  });
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
  const [r] = await registrarLlamadasHistoricas(db, [llamada]);
  return r;
}

/** `registrarLlamadaHistorica` en lote (ticket 078), con las reglas de `registrarAbonosHistoricos`. */
export async function registrarLlamadasHistoricas(
  db: Db,
  lista: readonly LlamadaHistorica[],
): Promise<EscrituraHistorica[]> {
  for (const llamada of lista) exigirHuella(llamada.huella);
  if (lista.length === 0) return [];
  const actorId = unSoloActor(lista);

  return (db as unknown as Transaccion).transaction(async (tx) => {
    const deal = await dealesDeLaMigracion(
      tx,
      lista.flatMap((l) => (l.dealId ? [l.dealId] : [])),
    );
    const ids = await crearVariosConRastro(
      { db: tx, tabla: calls, nombreTabla: "calls", actorId, omitirChoques: true },
      lista.map((llamada) => {
        let cohortId: string | null = null;
        if (llamada.dealId) {
          const d = deal.get(llamada.dealId)!;
          // El programa es frontera (ADR 0043): una llamada de un programa colgada de un deal
          // de otro mezclaria las dos economias sin lanzar ningun error.
          if (d.programId !== llamada.programId) {
            throw new ErrorDeApp("El deal es de otro programa: la llamada no se puede colgar de el.", 422);
          }
          cohortId = d.cohortId;
        }
        return {
          etiqueta: llamada.emailLead ?? llamada.huella,
          valores: {
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
        };
      }),
    );

    const chocadas = lista.filter((_, i) => ids[i] == null);
    const previas = new Map<string, string>();
    if (chocadas.length > 0) {
      const filas = await tx
        .select({ id: calls.id, programId: calls.programId, huella: calls.huellaFila })
        .from(calls)
        .where(and(inArray(calls.huellaFila, chocadas.map((l) => l.huella)), incluyendoAnulados(calls)));
      for (const f of filas) if (f.huella) previas.set(`${f.programId}:${f.huella}`, f.id);
    }
    return lista.map((llamada, i) => resultado(ids[i], previas.get(`${llamada.programId}:${llamada.huella}`)));
  });
}

function exigirHuella(huella: string): void {
  if (huella.trim() === "") {
    throw new Error("Una fila historica sin huella no se puede volver a encontrar: la migracion la tiene que dar.");
  }
}

function unSoloActor(lista: readonly { actorId: string }[]): string {
  const actorId = lista[0].actorId;
  if (lista.some((x) => x.actorId !== actorId)) throw new Error("Un lote historico tiene un solo actor.");
  return actorId;
}

/**
 * Escrita, o ya estaba: quien decide que ya entro es el indice, no un `select` previo
 * (ADR 0005). Si no se escribio y tampoco esta su huella, choco con OTRO indice unico, y
 * eso no se esconde.
 */
function resultado(escrita: string | null, previa: string | undefined): EscrituraHistorica {
  if (escrita) return { estado: "creado", id: escrita };
  if (previa) return { estado: "ya_migrado", id: previa };
  throw new Error("Una fila historica choco con un indice unico que no es su huella.");
}

/**
 * Los deals a los que se les cuelga algo: tienen que existir, no estar anulados y **haber
 * salido de la migracion**. Al deal vivo del CRM no se le cuelga nada (ADR 0059 punto 3): un
 * abono historico sobre el no lo moveria de etapa y dejaria su saldo y su etapa en desacuerdo.
 */
async function dealesDeLaMigracion(tx: Db, dealIds: readonly string[]): Promise<Map<string, typeof deals.$inferSelect>> {
  const unicos = [...new Set(dealIds)];
  if (unicos.length === 0) return new Map();
  const filas = await tx.select().from(deals).where(and(inArray(deals.id, unicos), incluyendoAnulados(deals)));
  const porId = new Map(filas.map((d) => [d.id, d]));
  for (const id of unicos) {
    const deal = porId.get(id);
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado: no se le cuelga nada.", 409);
    if (deal.huellaMigracion == null) {
      throw new ErrorDeApp("El deal es del CRM, no de la migración: gana el vivo y no se le cuelga nada.", 409);
    }
  }
  return porId;
}
