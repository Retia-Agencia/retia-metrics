import { and, eq } from "drizzle-orm";
import { deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";
import { abrirDeal, moverEtapa, MovimientoRechazado } from "@/lib/deals/mover-etapa";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { Calificacion } from "./calificacion";

/**
 * La regla de creacion y movimiento de deals de la ingesta (ticket 052, insumo §3.1,
 * ADR 0037).
 *
 * Cuando entra un lead por el webhook, su `calificacion` (el Estado que le puso el
 * formulario, ADR 0054) decide si nace o avanza un deal. La regla tiene dos mitades y
 * la separacion es a proposito:
 *
 *  - **DECIDE** (`decidirAccionDeDeal`): funcion PURA. Recibe la calificacion del lead
 *    y su deal abierto actual (con su etapa) o ninguno, y devuelve QUE hacer. No toca
 *    la base, asi que se prueba con una tabla de casos sin PGlite.
 *  - **DELEGA** (`aplicarReglaDeDeal`): traduce esa decision a una llamada al motor de
 *    la etapa 2 —`abrirDeal()` para crear, `moverEtapa()` para mover— con actor
 *    `sistema`. **NUNCA escribe `deals.etapa` por su cuenta** (ADR 0037 punto 4): el
 *    guardian `tests/motor-etapas-guardian.test.ts` caza cualquier atajo.
 *
 * ⚠️ **Ninguna regla compara numeros de etapa** (`lib/deals/etapas.ts`): el numero es
 * un nombre, no un orden. Cada caso nombra las etapas una por una. Los numeros del
 * insumo (1, 2, 9 para mover; 4, 5, 6, 7 para el re-envio) se traducen aca a sus
 * nombres reales del enum.
 *
 * Sin Call automatica (enmienda del 24-sep, ADR 0049): "Con Calendly" abre el deal en
 * Agendado y la Call llega de Calendly con su fecha real (ticket 096), o la crea el
 * closer a mano. Esta regla no crea llamadas.
 */

/** Las etapas 1, 2 y 9 del insumo: desde ellas "Con Calendly" MUEVE a Agendado (T2, T3, T23). */
const ETAPAS_QUE_AVANZAN_A_AGENDADO: readonly EtapaDeal[] = [
  "pendiente_setteo", // 1
  "en_contacto", // 2
  "proxima_cohorte", // 9
];

/**
 * Las etapas 4, 5, 6 y 7 del insumo: un re-envio con el deal ya en una de estas NO lo
 * mueve —el lead ya esta mas adelante que "acaba de agendar"—, solo se avisa al owner.
 */
const ETAPAS_AVANZADAS: readonly EtapaDeal[] = [
  "agendado", // 4
  "atendido", // 5
  "compromiso_verbal", // 6
  "abonado", // 7
];

/** El deal abierto del lead, o su ausencia. Lo minimo que la decision necesita. */
export type DealAbierto = { etapa: EtapaDeal } | null;

/**
 * Que hace la regla ante un lead. Cada variante es una fila de la tabla del insumo:
 *  - `nada`: descartado, sin calificacion, o un caso que no cambia el deal.
 *  - `abrir`: no hay deal abierto y la calificacion pide uno nuevo.
 *  - `mover`: hay deal abierto en 1/2/9 y "Con Calendly" lo avanza a Agendado.
 *  - `notificar_reenvio`: el deal ya esta avanzado (4/5/6/7); no se mueve, se avisa.
 */
export type AccionDeDeal =
  | { tipo: "nada"; motivo: string }
  | { tipo: "abrir"; etapa: EtapaDeal }
  | { tipo: "mover"; a: EtapaDeal }
  | { tipo: "notificar_reenvio"; etapa: EtapaDeal };

/**
 * La decision, pura. La tabla del insumo §3.1, leida sobre `leads.calificacion` (los
 * tres valores del ticket 051), no sobre numeros de etapa:
 *
 * | calificacion            | deal abierto        | accion                       |
 * |-------------------------|---------------------|------------------------------|
 * | `null` / `descartado`   | (cualquiera)        | nada                         |
 * | `setteo_no_calificado`  | ninguno             | abrir en Pendiente Setteo    |
 * | `setteo_no_calificado`  | (cualquiera)        | nada (ya tiene deal)         |
 * | `con_calendly`          | ninguno             | abrir en Agendado            |
 * | `con_calendly`          | en 1, 2 o 9         | mover a Agendado             |
 * | `con_calendly`          | en 4, 5, 6 o 7      | notificar re-envio           |
 * | `con_calendly`          | en otra etapa       | nada                         |
 */
export function decidirAccionDeDeal(
  calificacion: Calificacion | null,
  dealAbierto: DealAbierto,
): AccionDeDeal {
  // Descartado y sin calificacion no abren nada: el lead queda con su tag y sin deal.
  if (calificacion === null || calificacion === "descartado") {
    return { tipo: "nada", motivo: "el lead está descartado o sin calificación" };
  }

  if (calificacion === "setteo_no_calificado") {
    // Solo abre si no hay deal; si ya tiene uno, la regla no lo toca (los historicos
    // no re-abren, enmienda del 24-sep).
    if (dealAbierto === null) return { tipo: "abrir", etapa: "pendiente_setteo" };
    return { tipo: "nada", motivo: "el lead ya tiene un deal abierto" };
  }

  // con_calendly.
  if (dealAbierto === null) return { tipo: "abrir", etapa: "agendado" };
  if (ETAPAS_QUE_AVANZAN_A_AGENDADO.includes(dealAbierto.etapa)) {
    return { tipo: "mover", a: "agendado" };
  }
  if (ETAPAS_AVANZADAS.includes(dealAbierto.etapa)) {
    return { tipo: "notificar_reenvio", etapa: dealAbierto.etapa };
  }
  // Ya esta agendado por otra via, o en una etapa que no avanza a Agendado ni es
  // "avanzada" segun el insumo (p. ej. Pendiente Re-agenda): no se toca.
  return { tipo: "nada", motivo: `el deal está en ${dealAbierto.etapa} y no cambia con este re-envío` };
}

/** Lo que la regla hizo con UN lead, para que la ingesta lo reporte. */
export interface ResultadoReglaDeDeal {
  leadId: string;
  accion: AccionDeDeal;
  /** El id del deal que se abrió, cuando la acción fue `abrir`. */
  dealAbiertoId?: string;
  /**
   * El motor RECHAZÓ el movimiento por un requisito que le falta al deal (no es un
   * error de datos). El caso vivo: "Con Calendly" quiere mover a Agendado, pero T2/T3/
   * T23 exigen una llamada con fecha que todavía no llegó de Calendly (ticket 096). El
   * deal se queda donde está y el envío SÍ se guarda; el mensaje queda para el reporte.
   */
  rechazo?: string;
}

/** El deal abierto del lead con su id, o `null`. */
type DealAbiertoConId = { id: string; etapa: EtapaDeal } | null;

/**
 * El deal abierto del lead en su programa, o `null`. Mismo predicado que el indice
 * unico parcial `deals_uno_abierto_por_lead_y_programa_idx`: abierto es
 * `etapa NOT IN (completo, cierre_perdido) AND anulado_en IS NULL`. Como ese indice
 * garantiza a lo sumo uno, aqui basta con el primero. Un deal ANULADO no ocupa el cupo
 * (ADR 0038), por eso la lectura pasa por `vigente(deals)`.
 */
async function dealAbiertoDelLead(db: Db, leadId: string, programId: string): Promise<DealAbiertoConId> {
  const filas = await db
    .select({ id: deals.id, etapa: deals.etapa })
    .from(deals)
    .where(and(eq(deals.leadId, leadId), eq(deals.programId, programId), vigente(deals)));
  const abierto = filas.find((d) => d.etapa !== "completo" && d.etapa !== "cierre_perdido");
  return abierto ?? null;
}

/**
 * Aplica la regla a UN lead: lee su deal abierto, decide, y delega al motor. Recibe la
 * `db` (que puede ser la transacción de la ingesta) para vivir o morir con ella.
 *
 * Devuelve la acción tomada; la `notificar_reenvio` no muta nada, solo deja el dato
 * para que el llamador avise al owner (el canal es de la etapa 6, fuera de este ticket).
 */
export async function aplicarReglaDeDeal(
  db: Db,
  lead: { id: string; programId: string; calificacion: Calificacion | null },
): Promise<ResultadoReglaDeDeal> {
  const dealAbierto = await dealAbiertoDelLead(db, lead.id, lead.programId);
  const accion = decidirAccionDeDeal(lead.calificacion, dealAbierto);

  if (accion.tipo === "abrir") {
    const dealId = await abrirDeal(db, {
      leadId: lead.id,
      programId: lead.programId,
      etapa: accion.etapa,
      actor: { tipo: "sistema" },
    });
    return { leadId: lead.id, accion, dealAbiertoId: dealId };
  }

  if (accion.tipo === "mover" && dealAbierto !== null) {
    // El deal abierto existe (lo garantiza la decisión, que salió de esta misma lectura).
    // `moverEtapa` valida la flecha y escribe el historial; nunca la etapa a mano.
    //
    // Un `MovimientoRechazado` NO es un error de datos: es el motor diciendo que al deal
    // le falta un requisito (para T2/T3/T23, la llamada con fecha que llega de Calendly,
    // ticket 096). `moverEtapa` envuelve su trabajo en su propia transacción (un
    // savepoint cuando `db` ya es una transacción), así que el rechazo deshace SOLO ese
    // movimiento; el envío recién ingerido sobrevive. Se captura y se reporta.
    try {
      await moverEtapa(db, { dealId: dealAbierto.id, a: accion.a, actor: { tipo: "sistema" } });
    } catch (e) {
      if (e instanceof MovimientoRechazado) {
        return { leadId: lead.id, accion, rechazo: e.message };
      }
      throw e;
    }
    return { leadId: lead.id, accion };
  }

  // `nada` y `notificar_reenvio` no mutan el deal.
  return { leadId: lead.id, accion };
}
