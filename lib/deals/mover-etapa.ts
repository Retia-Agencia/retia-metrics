import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  abonos,
  calls,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  motivos,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { NOMBRE_DE_ETAPA, transicion, type EtapaDeal, type Transicion } from "./etapas";
import { queLeFalta, type HechosDelDeal, type RequisitoFaltante } from "./requisitos";

/**
 * `moverEtapa()`: el UNICO camino para cambiar `deals.etapa` (ADR 0037 punto 4,
 * ticket 045).
 *
 * Hay tres escritores —la ingesta, el closer y el sistema al registrar una llamada o
 * un abono— y si cada uno validara por su cuenta divergirian en silencio, como ya
 * paso con el saldo (ADR 0024) y con la vigencia (ADR 0026). Aqui se valida la flecha
 * (043), quien puede tomarla, y lo que le falta al deal (044), y se escribe la etapa
 * **y** su fila de `deal_etapa_historial` en la misma transaccion (ADR 0047).
 *
 * **Los hechos los lee este modulo, nunca el llamador.** Si el llamador pudiera
 * pasar "ya tiene producto", cada escritor podria afirmar algo distinto y la reja no
 * seria una reja.
 *
 * El rastro del movimiento es `deal_etapa_historial`, no `change_log`: la etapa no es
 * "un campo que cambio" sino el hecho del que salen la conversion y el tiempo en
 * etapa, y duplicarlo en los dos rastros crearia la divergencia que el ADR 0042
 * prohibe. Por eso este archivo es la excepcion nombrada del guardian de
 * `tests/rastro-operativo.test.ts`.
 */

/**
 * Quien mueve. El usuario sale SIEMPRE de la sesion (o de `actorDelScript()`), nunca
 * del input: este modulo lo recibe aparte y no lo busca en ningun otro lado.
 */
export type Actor = { tipo: "sistema" } | { tipo: "usuario"; userId: string };

export interface Movimiento {
  dealId: string;
  a: EtapaDeal;
  actor: Actor;
  /** Del catalogo `motivos`. Lo exigen las flechas con `exigeMotivo` (043). */
  motivoId?: string | null;
}

/** El movimiento no se hizo, y dice por que con lo que le falta al deal. */
export class MovimientoRechazado extends ErrorDeApp {
  constructor(
    mensaje: string,
    readonly faltantes: RequisitoFaltante[],
    status = 422,
  ) {
    super(mensaje, status);
  }
}

export interface MovimientoHecho {
  de: EtapaDeal;
  a: EtapaDeal;
  transicion: Transicion;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export async function moverEtapa(db: Db, mov: Movimiento): Promise<MovimientoHecho> {
  return (db as unknown as Transaccion).transaction(async (tx) => {
    const [deal] = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, mov.dealId), incluyendoAnulados(deals)));
    if (!deal) throw new ErrorDeApp("No existe el deal.", 404);
    if (deal.anuladoEn) {
      throw new ErrorDeApp("El deal está anulado: no cuenta en ninguna métrica y no se mueve.", 409);
    }

    const de = deal.etapa;
    const t = transicion(de, mov.a);
    if (!t) {
      const faltantes = queLeFalta(de, mov.a, HECHOS_VACIOS);
      throw new MovimientoRechazado(faltantes[0].mensaje, faltantes);
    }

    const rechazoPorActor = quienNoPuede(t, mov.actor);
    if (rechazoPorActor) throw new MovimientoRechazado(rechazoPorActor, [], 403);

    const hechos = await leerHechos(tx, deal, mov.motivoId ?? null);
    const faltantes = queLeFalta(de, mov.a, hechos);
    if (faltantes.length > 0) {
      throw new MovimientoRechazado(faltantes.map((f) => f.mensaje).join(" "), faltantes);
    }

    // A1: al anular el unico abono, Abonado vuelve a la etapa de donde vino, y esa la
    // dice el historial, no quien llama.
    if (t.id === "A1") {
      const previa = await etapaAntesDe(tx, deal.id, "abonado");
      if (previa !== mov.a) {
        throw new MovimientoRechazado(
          `Al anular el abono, el deal vuelve a ${previa ? NOMBRE_DE_ETAPA[previa] : "la etapa previa"}, no a ${NOMBRE_DE_ETAPA[mov.a]}.`,
          [],
          409,
        );
      }
    }

    // La condicion `etapa = de` es la reja contra dos movimientos simultaneos: si otro
    // movio el deal entre la lectura y esta escritura, no se pisa, se rechaza.
    const escritas = await tx
      .update(deals)
      .set({ etapa: mov.a, updatedAt: new Date() })
      .where(and(eq(deals.id, deal.id), eq(deals.etapa, de)))
      .returning();
    if (escritas.length === 0) {
      throw new ErrorDeApp("El deal cambió de etapa mientras tanto. Vuelve a cargarlo.", 409);
    }

    await tx.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      de,
      a: mov.a,
      userId: mov.actor.tipo === "usuario" ? mov.actor.userId : null,
      motivoId: mov.motivoId ?? null,
    });

    return { de, a: mov.a, transicion: t };
  });
}

/**
 * Una flecha del sistema la toma el CRM cuando pasa el evento (se pega el Grain,
 * entra un abono); una de closer la toma una persona. Que una persona "mueva a
 * Abonado" sin abono, o que el sistema decida por el closer que alguien dijo que no,
 * es justo lo que la tabla prohibe.
 */
function quienNoPuede(t: Transicion, actor: Actor): string | null {
  if (t.quien === "sistema" && actor.tipo === "usuario") {
    return `A ${NOMBRE_DE_ETAPA[t.a]} no se mueve a mano: la mueve el CRM cuando pasa el hecho (${t.id}).`;
  }
  if (t.quien === "closer" && actor.tipo === "sistema") {
    return `A ${NOMBRE_DE_ETAPA[t.a]} lo mueve una persona, no el sistema (${t.id}).`;
  }
  return null;
}

const HECHOS_VACIOS: HechosDelDeal = {
  tieneDueno: false,
  tieneContactoRegistrado: false,
  tieneLlamadaConFecha: false,
  llamadaSucedio: false,
  llamadaFallida: false,
  productoId: null,
  fechaLimitePago: null,
  cohorteDestinoId: null,
  fechaSeguimiento: null,
  abonosVigentes: 0,
  abonoConComprobante: false,
  saldo: null,
  motivoId: null,
};

/**
 * Resultados de llamada que prueban que la llamada OCURRIO. Mientras `calls` no tenga
 * el link de Grain (ticket 058), "sucedio" es que el closer la marco con uno de estos.
 */
const RESULTADOS_QUE_OCURRIERON = ["show", "compromiso_pago", "cerrada", "perdida"] as const;
const RESULTADOS_FALLIDOS = ["no_show", "cancelada"] as const;

type FilaDeal = typeof deals.$inferSelect;

/** Los hechos del deal, leidos de la base dentro de la misma transaccion. */
async function leerHechos(tx: Db, deal: FilaDeal, motivoId: string | null): Promise<HechosDelDeal> {
  const desde = await entradaALaEtapaActual(tx, deal);

  // Un contacto cuenta si se registro DESDE que el deal entro a su etapa actual: el
  // primero (T1) desde que nacio, uno nuevo (T22) desde que quedo en Proxima Cohorte.
  const [contacto] = await tx
    .select({ id: dealActividades.id })
    .from(dealActividades)
    .where(
      and(
        eq(dealActividades.dealId, deal.id),
        eq(dealActividades.tipo, "contacto"),
        isNotNull(dealActividades.canal),
        sql`${dealActividades.fecha} >= ${desde}`,
      ),
    )
    .limit(1);

  const llamadas = await tx
    .select({ resultado: calls.resultado, fechaAgenda: calls.fechaAgenda })
    .from(calls)
    .where(and(eq(calls.dealId, deal.id), vigente(calls)))
    .orderBy(desc(calls.createdAt));

  const [ultimoAbono] = await tx
    .select({ comprobanteUrl: abonos.comprobanteUrl })
    .from(abonos)
    .where(and(eq(abonos.dealId, deal.id), vigente(abonos)))
    .orderBy(desc(abonos.createdAt))
    .limit(1);

  const cohorteFutura = deal.cohortId
    ? await tx
        .select({ id: cohorts.id })
        .from(cohorts)
        .where(and(eq(cohorts.id, deal.cohortId), eq(cohorts.estado, "futuro")))
    : [];

  // Un motivo que no existe o esta desactivado no es un motivo.
  const motivoValido = motivoId
    ? await tx
        .select({ id: motivos.id })
        .from(motivos)
        .where(and(eq(motivos.id, motivoId), eq(motivos.activo, true)))
    : [];

  const saldo = (await saldosDeDeals(tx, [deal.id])).get(deal.id);

  return {
    tieneDueno: deal.ownerUserId != null,
    tieneContactoRegistrado: contacto != null,
    tieneLlamadaConFecha: llamadas.some((l) => l.resultado === "agendada" && l.fechaAgenda != null),
    llamadaSucedio: llamadas.some((l) => (RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(l.resultado)),
    llamadaFallida:
      llamadas.length > 0 && (RESULTADOS_FALLIDOS as readonly string[]).includes(llamadas[0].resultado),
    productoId: deal.productoId,
    fechaLimitePago: deal.fechaLimitePago,
    cohorteDestinoId: cohorteFutura[0]?.id ?? null,
    fechaSeguimiento: deal.fechaSeguimiento,
    abonosVigentes: saldo?.abonosVigentes ?? 0,
    abonoConComprobante: ultimoAbono?.comprobanteUrl != null && ultimoAbono.comprobanteUrl.trim() !== "",
    saldo: saldo?.saldo ?? null,
    motivoId: motivoValido[0]?.id ?? null,
  };
}

/** Cuando entro el deal a la etapa en la que esta: su ultimo movimiento hacia ella, o su alta. */
async function entradaALaEtapaActual(tx: Db, deal: FilaDeal): Promise<Date> {
  const [ultima] = await tx
    .select({ fecha: dealEtapaHistorial.fecha })
    .from(dealEtapaHistorial)
    .where(and(eq(dealEtapaHistorial.dealId, deal.id), eq(dealEtapaHistorial.a, deal.etapa)))
    .orderBy(desc(dealEtapaHistorial.fecha))
    .limit(1);
  return ultima?.fecha ?? deal.createdAt;
}

/** De que etapa venia el deal la ultima vez que entro a `etapa`. */
async function etapaAntesDe(tx: Db, dealId: string, etapa: EtapaDeal): Promise<EtapaDeal | null> {
  const [fila] = await tx
    .select({ de: dealEtapaHistorial.de })
    .from(dealEtapaHistorial)
    .where(
      and(
        eq(dealEtapaHistorial.dealId, dealId),
        eq(dealEtapaHistorial.a, etapa),
        inArray(dealEtapaHistorial.de, ["en_contacto", "atendido", "compromiso_verbal", "seguimiento"]),
      ),
    )
    .orderBy(desc(dealEtapaHistorial.fecha))
    .limit(1);
  return fila?.de ?? null;
}
