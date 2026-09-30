import { and, eq, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import {
  abonos,
  calls,
  changeLog,
  cuotasPactadas,
  dealActividades,
  dealEtapaHistorial,
  deals,
  rarezasMigracion,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * La REVERSA de la migracion de las pestañas de gestion de UN programa (ticket 127,
 * `operations.md` §12.3 nivel 3): borra lo que escribio `importarGestion` y nada mas.
 *
 * - **Lo migrado se reconoce por su huella** (ADR 0059): deals y abonos por `huella_migracion`,
 *   llamadas por `huella_fila` que empieza con `sheets:` y `origen = 'sheets'`. Lo que entro por
 *   el webhook, Calendly o la app no lleva esa huella y no se toca. Los leads y los envios
 *   tampoco: la migracion de gestion no los crea (ADR 0004).
 * - **Se niega si alguien trabajo encima** y no borra nada: ahi ya es historia del negocio y se
 *   ANULA fila por fila (nivel 4, ADR 0038). Por que borrar aqui no rompe "no se borra lo que se
 *   uso" (ADR 0026): una carga equivocada que nadie toco no es un hecho que haya pasado.
 * - **Deja rastro:** una fila de `change_log` por registro borrado (deal, abono, llamada,
 *   actividad), con la huella como valor anterior y el actor del script.
 * - **El ensayo lo da quien llama**, como en el importador: esto corre dentro de una transaccion
 *   que el script deshace si no hay `--aplicar`. Los deals migrados se bloquean (`for update`)
 *   para que nadie les cuelgue algo entre la revision y el borrado; y si igual pasa, la FK
 *   `restrict` tumba la transaccion entera.
 */

export interface ConteoReversa {
  deals: number;
  historial: number;
  actividades: number;
  abonos: number;
  llamadas: number;
  rarezas: number;
}

/** Por que no se puede borrar en bloque. Cada motivo con cuantas filas lo causan. */
export type MotivoNegativa =
  | "deal_anulado"
  | "abono_anulado"
  | "llamada_anulada"
  | "abono_del_crm"
  | "llamada_del_crm"
  | "actividad_de_una_persona"
  | "etapa_movida"
  | "cuotas_pactadas"
  | "editado_despues";

export type ResultadoReversa =
  | { estado: "deshecho"; borrado: ConteoReversa }
  | { estado: "negado"; motivos: Partial<Record<MotivoNegativa, number>> };

export const DESCRIPCION_DE_MOTIVO: Record<MotivoNegativa, string> = {
  deal_anulado: "deals migrados que alguien anuló",
  abono_anulado: "abonos migrados que alguien anuló",
  llamada_anulada: "llamadas migradas que alguien anuló",
  abono_del_crm: "abonos registrados en el CRM sobre un deal migrado",
  llamada_del_crm: "llamadas del CRM o de Calendly sobre un deal migrado",
  actividad_de_una_persona: "actividades que registró una persona sobre un deal migrado",
  etapa_movida: "movimientos de etapa sobre un deal migrado",
  cuotas_pactadas: "cuotas pactadas sobre un deal migrado",
  editado_despues: "deals, abonos o llamadas migrados editados después de la migración",
};

const LOTE = 200;

export async function deshacerMigracion(db: Db, op: { programId: string; actorId: string }): Promise<ResultadoReversa> {
  const { programId, actorId } = op;

  // ── lo que escribio la migracion en este programa
  const dealsMigrados = await db
    .select({ id: deals.id, huella: deals.huellaMigracion, anuladoEn: deals.anuladoEn })
    .from(deals)
    .where(and(eq(deals.programId, programId), isNotNull(deals.huellaMigracion), incluyendoAnulados(deals)))
    .for("update");
  const abonosMigrados = await db
    .select({ id: abonos.id, huella: abonos.huellaMigracion, anuladoEn: abonos.anuladoEn })
    .from(abonos)
    .where(and(eq(abonos.programId, programId), isNotNull(abonos.huellaMigracion), incluyendoAnulados(abonos)));
  const llamadasMigradas = await db
    .select({ id: calls.id, huella: calls.huellaFila, anuladoEn: calls.anuladoEn })
    .from(calls)
    .where(and(eq(calls.programId, programId), eq(calls.origen, "sheets"), like(calls.huellaFila, "sheets:%"), incluyendoAnulados(calls)));

  const dealIds = dealsMigrados.map((d) => d.id);
  const actividades = dealIds.length
    ? await db
        .select({ id: dealActividades.id, dealId: dealActividades.dealId, userId: dealActividades.userId })
        .from(dealActividades)
        .where(inArray(dealActividades.dealId, dealIds))
    : [];

  // ── ¿alguien trabajo encima?
  const motivos = await trabajoEncima(db, {
    dealIds,
    dealsAnulados: dealsMigrados.filter((d) => d.anuladoEn).length,
    abonosAnulados: abonosMigrados.filter((a) => a.anuladoEn).length,
    llamadasAnuladas: llamadasMigradas.filter((l) => l.anuladoEn).length,
    actividadesDePersonas: actividades.filter((a) => a.userId != null).length,
    registros: [...dealIds, ...abonosMigrados.map((a) => a.id), ...llamadasMigradas.map((l) => l.id)],
  });
  if (Object.keys(motivos).length > 0) return { estado: "negado", motivos };

  // ── el rastro, antes de que las filas dejen de existir
  const rastro = [
    ...dealsMigrados.map((d) => ({ tabla: "deals", id: d.id, huella: d.huella })),
    ...abonosMigrados.map((a) => ({ tabla: "abonos", id: a.id, huella: a.huella })),
    ...llamadasMigradas.map((l) => ({ tabla: "calls", id: l.id, huella: l.huella })),
    ...actividades.map((a) => ({
      tabla: "deal_actividades",
      id: a.id,
      huella: dealsMigrados.find((d) => d.id === a.dealId)?.huella ?? null,
    })),
  ].map((r) => ({
    tabla: r.tabla,
    registroId: r.id,
    etiqueta: r.huella,
    campo: "reversa_migracion",
    valorAnterior: r.huella,
    valorNuevo: null,
    origen: "app" as const,
    userId: actorId,
  }));
  for (let i = 0; i < rastro.length; i += LOTE) await db.insert(changeLog).values(rastro.slice(i, i + LOTE));

  // ── el borrado, de las hojas hacia la raiz (todas las FK son `restrict`)
  const rarezas = await db.delete(rarezasMigracion).where(eq(rarezasMigracion.programId, programId)).returning();
  const borrar = async (ids: string[], fn: (lote: string[]) => Promise<unknown[]>) => {
    let n = 0;
    for (let i = 0; i < ids.length; i += LOTE) n += (await fn(ids.slice(i, i + LOTE))).length;
    return n;
  };
  const nAbonos = await borrar(abonosMigrados.map((a) => a.id), (l) =>
    db.delete(abonos).where(inArray(abonos.id, l)).returning(),
  );
  const nLlamadas = await borrar(llamadasMigradas.map((l) => l.id), (l) =>
    db.delete(calls).where(inArray(calls.id, l)).returning(),
  );
  const nActividades = await borrar(dealIds, (l) =>
    db.delete(dealActividades).where(inArray(dealActividades.dealId, l)).returning(),
  );
  const nHistorial = await borrar(dealIds, (l) =>
    db.delete(dealEtapaHistorial).where(inArray(dealEtapaHistorial.dealId, l)).returning(),
  );
  const nDeals = await borrar(dealIds, (l) => db.delete(deals).where(inArray(deals.id, l)).returning());

  return {
    estado: "deshecho",
    borrado: { deals: nDeals, historial: nHistorial, actividades: nActividades, abonos: nAbonos, llamadas: nLlamadas, rarezas: rarezas.length },
  };
}

interface Revision {
  dealIds: string[];
  dealsAnulados: number;
  abonosAnulados: number;
  llamadasAnuladas: number;
  actividadesDePersonas: number;
  /** Deals, abonos y llamadas migrados: los que pueden tener ediciones en `change_log`. */
  registros: string[];
}

/**
 * Lo que convierte lo migrado en historia del negocio. Cada pregunta mira un rastro distinto:
 *
 * - **anulado:** anular es una accion de una persona (ADR 0038).
 * - **abono o llamada sin huella de la migracion** colgados de un deal migrado: lo registro el
 *   CRM, Calendly o el webhook.
 * - **actividad con usuario:** las notas de la hoja entran con `user_id` nulo (el sistema).
 * - **historial con `de` o con usuario:** la migracion solo escribe la fila de nacimiento
 *   (`de` nulo, sin usuario); cualquier otra es un movimiento, de una persona o del sistema.
 * - **cuotas pactadas:** la migracion no las crea.
 * - **editado despues:** el alta de un registro deja todas sus filas de `change_log` en UNA
 *   transaccion, asi que comparten `detectado_en` (`now()` es el inicio de la transaccion). Una
 *   fila con otra hora es una edicion posterior: reclamar el deal, cambiarle el producto,
 *   colgar una llamada suelta de un deal desde el Inbox.
 */
async function trabajoEncima(db: Db, r: Revision): Promise<Partial<Record<MotivoNegativa, number>>> {
  const motivos: Partial<Record<MotivoNegativa, number>> = {};
  const anotar = (m: MotivoNegativa, n: number) => {
    if (n > 0) motivos[m] = (motivos[m] ?? 0) + n;
  };
  anotar("deal_anulado", r.dealsAnulados);
  anotar("abono_anulado", r.abonosAnulados);
  anotar("llamada_anulada", r.llamadasAnuladas);
  anotar("actividad_de_una_persona", r.actividadesDePersonas);

  for (let i = 0; i < r.dealIds.length; i += LOTE) {
    const lote = r.dealIds.slice(i, i + LOTE);
    const [a] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(abonos)
      .where(and(inArray(abonos.dealId, lote), isNull(abonos.huellaMigracion), incluyendoAnulados(abonos)));
    anotar("abono_del_crm", a.n);
    const [c] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(calls)
      .where(
        and(
          inArray(calls.dealId, lote),
          or(isNull(calls.huellaFila), sql`${calls.huellaFila} not like 'sheets:%'`, sql`${calls.origen} <> 'sheets'`),
          incluyendoAnulados(calls),
        ),
      );
    anotar("llamada_del_crm", c.n);
    const [h] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(dealEtapaHistorial)
      .where(and(inArray(dealEtapaHistorial.dealId, lote), or(isNotNull(dealEtapaHistorial.de), isNotNull(dealEtapaHistorial.userId))));
    anotar("etapa_movida", h.n);
    const [q] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cuotasPactadas)
      .where(inArray(cuotasPactadas.dealId, lote));
    anotar("cuotas_pactadas", q.n);
  }

  for (let i = 0; i < r.registros.length; i += LOTE) {
    const filas = await db
      .select({ registroId: changeLog.registroId, momentos: sql<number>`count(distinct ${changeLog.detectadoEn})::int` })
      .from(changeLog)
      .where(and(inArray(changeLog.tabla, ["deals", "abonos", "calls"]), inArray(changeLog.registroId, r.registros.slice(i, i + LOTE))))
      .groupBy(changeLog.registroId);
    anotar("editado_despues", filas.filter((f) => f.momentos > 1).length);
  }

  return motivos;
}
