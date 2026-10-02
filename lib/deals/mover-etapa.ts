import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  abonos,
  calls,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  programs,
  submissions,
} from "@/lib/db/schema";
import { exigirAreaActiva } from "@/lib/catalogo/areas";
import { crearConRastro, crearVariosConRastro, editarConRastro } from "@/lib/crm/rastro";
import { esViolacionUnica } from "@/lib/db/errores";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import type { Rol } from "@/lib/auth/roles";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { exigirFechaLimiteValida } from "./pago";
import { puedeTrabajarDeal } from "./permiso";
import {
  NOMBRE_DE_ETAPA,
  ETAPAS_VENDIDAS,
  transicion,
  transicionPendiente,
  transicionRetomar,
  type EtapaDeal,
  type FlechaBase,
  type PendienteDeal,
  type TipoMotivo,
  type Transicion,
  type TransicionPendiente,
} from "./etapas";
import {
  MENSAJES,
  queLeFalta,
  queLeFaltaTransicion,
  requisitosDeTransicion,
  type CodigoRequisito,
  type HechosDelDeal,
  type RequisitoFaltante,
} from "./requisitos";
import { congelarValorVendido } from "./valor-vendido";

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
 * pasar "ya tiene valor vendido", cada escritor podria afirmar algo distinto y la reja no
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
 * del input: este modulo lo recibe aparte y no lo busca en ningun otro lado. Trae su
 * ROL de vista para que el motor —y no quien lo llame— decida si esta persona puede
 * mover ESTE deal (Mani, 27-sep, ticket 103): "quien puede mover que deal" era la
 * segunda puerta que alguien olvidaba, asi que vive con la reja y no afuera.
 */
export type Actor =
  | { tipo: "sistema" }
  | { tipo: "usuario"; userId: string; rol: Rol };

/**
 * Datos que la flecha PIDE y que se escriben en el mismo movimiento (Mani, 27-sep,
 * ticket 103, punto 6; como en HubSpot). Antes la pantalla tenia que escribir la
 * fecha —u otro campo— en una operacion y mover en otra: si la segunda fallaba, el
 * campo quedaba puesto y el deal sin mover. Aqui van juntos en la MISMA transaccion.
 *
 * 🎯 **Nada que PRUEBE un hecho entra por aca.** Las llamadas, los contactos y los
 * abonos se leen de la base, nunca del input: si el llamador pudiera afirmar "ya tiene
 * abono", la reja no seria una reja (mismo principio que los hechos). Estos son datos
 * del propio deal (descuento, fechas, acuerdo, cohorte destino), no evidencia de un
 * evento.
 */
export interface DatosMovimiento {
  descuentoUsd?: number;
  areaDeclaradaId?: string | null;
  fechaLimitePago?: string | null;
  acuerdoPago?: string | null;
  /** La cohorte a la que quiere entrar (Proxima Cohorte). `deals.cohorte_destino_id`. */
  cohorteDestinoId?: string | null;
  fechaSeguimiento?: string | null;
}

export interface Movimiento {
  dealId: string;
  a: EtapaDeal;
  /** Pendiente DESPUES del movimiento. Todo cambio de etapa lo limpia por defecto. */
  pendiente?: PendienteDeal | null;
  actor: Actor;
  /** Del catalogo `motivos`. Lo exigen las flechas con `exigeMotivo` (043). */
  motivoId?: string | null;
  /**
   * Los campos que la flecha pide, escritos en la misma transaccion que el movimiento
   * (punto 6). Opcional: una flecha que no pide nada no los necesita.
   */
  datos?: DatosMovimiento;
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
  pendienteDe: PendienteDeal | null;
  pendienteA: PendienteDeal | null;
  transicion: Transicion | TransicionPendiente;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/**
 * Qué flecha toma un movimiento y con qué pendiente queda el deal. Pura: la usan
 * `moverEtapa` y `revisarMovimiento`, así que la vista previa y el motor no pueden
 * resolver distinto. Si `a` es otra etapa, es una flecha de etapa (el pendiente queda
 * nulo, salvo RETRO, que deja Seguimiento, y R a En gestión con Próxima Cohorte). Si es
 * la misma etapa con un pendiente, es una flecha de pendiente. Si es la misma sin
 * pendiente, solo E7 (Agendado) o RET.
 */
export function resolverTransicion(
  de: EtapaDeal,
  pendienteDe: PendienteDeal | null,
  a: EtapaDeal,
  pendiente: PendienteDeal | null,
): { transicion: Transicion | TransicionPendiente | null; pendienteA: PendienteDeal | null } {
  if (a !== de) {
    const t = transicion(de, a);
    if (t?.id === "RETRO") return { transicion: t, pendienteA: "seguimiento" };
    if (t?.id === "R" && a === "en_gestion" && pendiente === "proxima_cohorte") {
      return { transicion: t, pendienteA: "proxima_cohorte" };
    }
    return { transicion: t, pendienteA: null };
  }
  if (pendiente != null) return { transicion: transicionPendiente(de, pendiente), pendienteA: pendiente };
  return { transicion: de === "agendado" ? transicion(de, de) : transicionRetomar(de, pendienteDe), pendienteA: null };
}

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
    const pendienteDe = deal.pendiente;
    const { transicion: t, pendienteA } = resolverTransicion(de, pendienteDe, mov.a, mov.pendiente ?? null);
    if (!t) {
      const faltantes = mov.a === de
        ? [{ codigo: "transicion_no_permitida" as const, mensaje: `Este movimiento no está permitido en ${NOMBRE_DE_ETAPA[de]}.` }]
        : queLeFalta(de, mov.a, HECHOS_VACIOS);
      throw new MovimientoRechazado(faltantes[0].mensaje, faltantes);
    }
    if (t.tipo === "etapa" && t.soloConPendiente && pendienteDe == null) {
      const faltantes = [{ codigo: "transicion_no_permitida" as const, mensaje: "Atendido solo vuelve a Agendado cuando tiene un pendiente." }];
      throw new MovimientoRechazado(faltantes[0].mensaje, faltantes, 409);
    }
    if (t.id === "PC" && de === "agendado" && pendienteDe == null) {
      const faltantes = [{ codigo: "transicion_no_permitida" as const, mensaje: "Agendado solo pasa a Próxima Cohorte cuando ya tiene un pendiente." }];
      throw new MovimientoRechazado(faltantes[0].mensaje, faltantes, 409);
    }

    // Quien puede tomar la flecha: primero la clase (sistema vs persona), y para una
    // persona ademas si es el dueño o administra (punto 3). Un 403 sin escribir nada.
    const rechazoPorActor = quienNoPuede(t, mov.actor, deal);
    if (rechazoPorActor) throw new MovimientoRechazado(rechazoPorActor, [], 403);

    // Punto 6: los datos que la flecha pide se escriben AHORA, en esta transaccion, y
    // por `editarConRastro` (asi quedan en `change_log`). Se hace ANTES de leer los
    // hechos para que el requisito se mida contra lo recien escrito, y como todo va en
    // la misma transaccion, si el requisito falla mas abajo esta escritura tambien se
    // deshace. La etapa NUNCA se toca aca: la mueve el update de mas abajo.
    const dealActualizado = await escribirDatos(tx, deal, mov);

    if (t.id === "E8" && mov.actor.tipo === "usuario") {
      await darPorAtendida(tx, dealActualizado, mov.actor.userId);
    }

    const hechos = await leerHechos(tx, dealActualizado, mov.motivoId ?? null, t.tipoDeMotivo);
    const faltantes = queLeFaltaTransicion(t, hechos);
    if (t.id === "R" && pendienteA === "proxima_cohorte" && hechos.cohorteDestinoId == null) {
      faltantes.push({ codigo: "cohorte_destino", mensaje: "Falta la cohorte a la que quiere entrar." });
    }
    if (faltantes.length > 0) {
      throw new MovimientoRechazado(faltantes.map((f) => f.mensaje).join(" "), faltantes);
    }

    // A1: al anular el unico abono, Ganado Pago Parcial vuelve a la etapa de donde vino.
    // dice el historial, no quien llama.
    if (t.id === "A1") {
      const previa = await etapaALaQueVuelve(tx, deal.id);
      if (previa !== mov.a) {
        throw new MovimientoRechazado(
          `Al anular el abono, el deal vuelve a ${NOMBRE_DE_ETAPA[previa]}, no a ${NOMBRE_DE_ETAPA[mov.a]}.`,
          [],
          409,
        );
      }
    }
    if (t.id === "RETRO") {
      const previa = await etapaAntesDeCompromiso(tx, deal.id);
      if (previa == null) {
        throw new MovimientoRechazado("El historial no dice desde qué etapa entró a Compromiso Verbal.", [], 409);
      }
      if (previa !== mov.a) {
        throw new MovimientoRechazado(
          `El deal vuelve a ${NOMBRE_DE_ETAPA[previa]}, no a ${NOMBRE_DE_ETAPA[mov.a]}.`,
          [],
          409,
        );
      }
    }

    const mudaDeCohorte = pendienteDe === "proxima_cohorte" && pendienteA !== "proxima_cohorte" && t.id !== "P";
    if (mudaDeCohorte && deal.cohorteDestinoId != null) {
      await editarConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: mov.actor.tipo === "usuario" ? mov.actor.userId : null, etiqueta: deal.id },
        deal.id,
        { cohortId: deal.cohorteDestinoId },
      );
    }

    // La condicion `etapa = de` es la reja contra dos movimientos simultaneos: si otro
    // movio el deal entre la lectura y esta escritura, no se pisa, se rechaza.
    // Al perder (P) se escribe `deals.motivo_id` en la misma transaccion (punto 5): la
    // ficha del deal muestra el motivo, no solo el historial.
    let comisionPorcentaje: string | null | undefined;
    if ((ETAPAS_VENDIDAS as readonly EtapaDeal[]).includes(mov.a) && deal.comisionPorcentaje === null) {
      const [programa] = await tx
        .select({ comisionPorcentaje: programs.comisionPorcentaje })
        .from(programs)
        .where(eq(programs.id, deal.programId));
      comisionPorcentaje = programa?.comisionPorcentaje ?? null;
    }

    const escritas = await tx
      .update(deals)
      .set({
        etapa: mov.a,
        pendiente: pendienteA,
        updatedAt: new Date(),
        ...(comisionPorcentaje !== undefined ? { comisionPorcentaje } : {}),
        ...(mov.a === "cierre_perdido" ? { motivoId: mov.motivoId ?? null } : {}),
      })
      .where(and(eq(deals.id, deal.id), eq(deals.etapa, de), sql`${deals.pendiente} IS NOT DISTINCT FROM ${pendienteDe}`))
      .returning();
    if (escritas.length === 0) {
      throw new ErrorDeApp("El deal cambió de etapa mientras tanto. Vuelve a cargarlo.", 409);
    }

    await tx.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      de,
      a: mov.a,
      pendienteDe,
      pendienteA,
      userId: mov.actor.tipo === "usuario" ? mov.actor.userId : null,
      motivoId: mov.motivoId ?? null,
      fecha: sql`clock_timestamp()`,
    });

    return { de, a: mov.a, pendienteDe, pendienteA, transicion: t };
  });
}

/**
 * Escribe en el deal, dentro de la transaccion del movimiento, los datos que trae el
 * movimiento (punto 6). No filtra por flecha: quien puede mover el deal (su dueño o
 * quien administra) tambien puede editarlo, asi que un dato de mas no abre ninguna
 * puerta; lo que la flecha EXIGE lo sigue midiendo `queLeFalta`. Valida cada uno antes:
 *  - **descuento**: se calcula contra el ticket de la cohorte y congela el total.
 *  - **cohorte destino**: del mismo programa (ADR 0043) y distinta de la de origen
 *    (`cohort_id`); no se exige estado `futuro` (Mani, 27-sep: no decidido).
 *
 * Pasa por `editarConRastro` para que quede en `change_log`, y usa la `tx` como base
 * asi la escritura vive o muere con el movimiento. Devuelve el deal con los valores ya
 * aplicados, para que `leerHechos` mida el requisito contra lo recien escrito sin
 * re-consultar la fila.
 */
async function escribirDatos(tx: Db, deal: FilaDeal, mov: Movimiento): Promise<FilaDeal> {
  const datos = mov.datos;
  if (!datos) return deal;

  const cambios: Record<string, unknown> = {};
  const aplicar = <K extends keyof FilaDeal>(campo: K, valor: FilaDeal[K]) => {
    cambios[campo as string] = valor;
  };

  if (datos.descuentoUsd !== undefined) {
    const congelado = await congelarValorVendido(tx, {
      deal,
      descuentoUsd: datos.descuentoUsd,
      actorId: mov.actor.tipo === "usuario" ? mov.actor.userId : null,
      etiqueta: deal.id,
    });
    deal = { ...deal, cohortId: congelado.cohortId, valorVendidoUsd: String(congelado.valorVendidoUsd) };
  }
  if (datos.areaDeclaradaId !== undefined) {
    if (datos.areaDeclaradaId !== null) await exigirAreaActiva(tx, datos.areaDeclaradaId);
    aplicar("areaDeclaradaId", datos.areaDeclaradaId);
  }
  if (datos.fechaLimitePago !== undefined) {
    // El inicio de clases de la cohorte es el tope del plazo de pago (ticket 061).
    if (datos.fechaLimitePago !== null) await exigirFechaLimiteValida(tx, deal, datos.fechaLimitePago);
    aplicar("fechaLimitePago", datos.fechaLimitePago);
  }
  if (datos.acuerdoPago !== undefined) aplicar("acuerdoPago", datos.acuerdoPago);
  if (datos.fechaSeguimiento !== undefined) aplicar("fechaSeguimiento", datos.fechaSeguimiento);
  if (datos.cohorteDestinoId !== undefined) {
    if (datos.cohorteDestinoId !== null) {
      // El programa es frontera (ADR 0043): la cohorte destino tiene que ser del mismo
      // programa del deal, o mezclaria dos economias sin lanzar ningun error.
      const [coh] = await tx
        .select({ id: cohorts.id })
        .from(cohorts)
        .where(and(eq(cohorts.id, datos.cohorteDestinoId), eq(cohorts.programId, deal.programId)));
      if (!coh) {
        throw new MovimientoRechazado("La cohorte destino no existe o es de otro programa.", [], 422);
      }
      // Mudarse a la MISMA cohorte de origen no es Proxima Cohorte: es un no-op que
      // dejaria el deal apuntando a si mismo.
      if (datos.cohorteDestinoId === deal.cohortId) {
        throw new MovimientoRechazado("La cohorte destino tiene que ser distinta a la de origen.", [], 422);
      }
    }
    aplicar("cohorteDestinoId", datos.cohorteDestinoId);
  }

  if (Object.keys(cambios).length === 0) return deal;

  await editarConRastro(
    {
      db: tx,
      tabla: deals,
      nombreTabla: "deals",
      actorId: mov.actor.tipo === "usuario" ? mov.actor.userId : null,
      etiqueta: deal.id,
    },
    deal.id,
    cambios,
  );

  return { ...deal, ...cambios } as FilaDeal;
}

/**
 * Donde puede NACER un deal, y quien puede abrirlo ahi (ticket 047; `structure.md` §2.1).
 *
 * Una persona abre a mano en En gestión, con ella como dueña. El sistema abre en
 * Potencial, Registrado, Calificado o Agendado.
 */
const NACIMIENTOS: Readonly<Record<Actor["tipo"], readonly EtapaDeal[]>> = {
  usuario: ["en_gestion"],
  sistema: ["potencial", "registrado", "calificado", "agendado"],
};

export interface AltaDeDeal {
  leadId: string;
  programId: string;
  etapa: EtapaDeal;
  actor: Actor;
  areaDeclaradaId?: string | null;
  fechaLimitePago?: string | null;
  cohortId?: string | null;
  submissionOrigenId?: string | null;
  /** Solo el sistema lo pasa (el host de Calendly, ADR 0049). A mano, el dueño es quien crea. */
  ownerUserId?: string | null;
}

/**
 * Abre un deal en su etapa de nacimiento y escribe su PRIMERA fila de historial (`de`
 * nulo), junto con el rastro de la creacion, en una transaccion. Es el otro escritor de
 * la etapa, y por eso vive aqui y no en quien lo llama.
 *
 * Reaplicar despues de un Cierre Perdido pasa por aqui: abre un deal NUEVO (ADR 0037
 * punto 1). Si el lead ya tiene un deal abierto en el programa, la base lo rechaza
 * (`deals_uno_abierto_por_lead_y_programa_idx`) y se devuelve un 409 que lo dice.
 */
export async function abrirDeal(db: Db, alta: AltaDeDeal): Promise<string> {
  if (!NACIMIENTOS[alta.actor.tipo].includes(alta.etapa)) {
    const quien = alta.actor.tipo === "usuario" ? "A mano" : "Automáticamente";
    throw new MovimientoRechazado(`${quien}, un deal no puede nacer en ${NOMBRE_DE_ETAPA[alta.etapa]}.`, [], 422);
  }
  return (db as unknown as Transaccion).transaction(async (tx) => {
    // El programa es frontera (ADR 0043): un deal de un programa sobre un lead de otro
    // mezclaria las dos economias sin lanzar ningun error.
    const [lead] = await tx.select().from(leads).where(eq(leads.id, alta.leadId));
    if (!lead) throw new ErrorDeApp("No existe el lead.", 404);
    if (lead.programId !== alta.programId) {
      throw new ErrorDeApp("El lead es de otro programa: el deal tiene que abrirse en el programa del lead.", 422);
    }
    const cohortId = alta.cohortId === undefined ? (await cohorteActiva(alta.programId, tx))?.id ?? null : alta.cohortId;
    if (alta.fechaLimitePago) {
      await exigirFechaLimiteValida(tx, { programId: alta.programId, cohortId }, alta.fechaLimitePago);
    }
    if (alta.areaDeclaradaId) await exigirAreaActiva(tx, alta.areaDeclaradaId);
    // El origen de la venta (ADR 0060): la FK solo mira que el envio exista, y uno de otro
    // lead le atribuiria a este deal el clic de otra persona sin ningun error.
    if (alta.submissionOrigenId) {
      const [env] = await tx
        .select({ id: submissions.id })
        .from(submissions)
        .where(and(eq(submissions.id, alta.submissionOrigenId), eq(submissions.leadId, alta.leadId)));
      if (!env) throw new ErrorDeApp("El envío de origen no existe o es de otro lead.", 422);
    }

    const usuario = alta.actor.tipo === "usuario" ? alta.actor.userId : null;
    let id: string;
    try {
      id = await crearConRastro(
        {
          db: tx,
          tabla: deals,
          nombreTabla: "deals",
          actorId: usuario,
          etiqueta: lead.nombre ?? lead.emailNormalizado,
          desdeElMotor: true,
        },
        {
          leadId: alta.leadId,
          programId: alta.programId,
          etapa: alta.etapa,
          ownerUserId: usuario ?? alta.ownerUserId ?? null,
          areaDeclaradaId: alta.areaDeclaradaId ?? null,
          fechaLimitePago: alta.fechaLimitePago ?? null,
          cohortId,
          submissionOrigenId: alta.submissionOrigenId ?? null,
          creadoPor: usuario,
        },
      );
    } catch (e) {
      if (esViolacionUnica(e)) {
        throw new ErrorDeApp("Este lead ya tiene un deal abierto en el programa: trabaja ese.", 409);
      }
      throw e;
    }

    await tx.insert(dealEtapaHistorial).values({
      dealId: id,
      de: null,
      a: alta.etapa,
      pendienteDe: null,
      pendienteA: null,
      userId: usuario,
      fecha: sql`clock_timestamp()`,
    });
    return id;
  });
}

/**
 * Un deal que viene de las pestañas de gestion de la hoja (ADR 0059, ticket 078).
 *
 * `actorId` es quien corrio la migracion (`actorDelScript()`) y va SOLO a `change_log`:
 * el historial y las notas son del sistema (`user_id` nulo), porque lo que hizo un closer
 * en la hoja no se le atribuye a quien corre el script.
 */
export interface AltaHistorica {
  leadId: string;
  programId: string;
  /** La que dice la hoja. Cualquiera de las once: no se recorre el motor (ADR 0059 punto 1). */
  etapa: EtapaDeal;
  /** Pendiente con el que nació según el histórico. */
  pendiente?: PendienteDeal | null;
  /** `sheets:<programa>:<pestaña>:<llave>`. La garantia contra la segunda corrida (punto 2). */
  huella: string;
  actorId: string;
  /** Cuando entro a esa etapa, si la hoja lo sabe. Sin fecha, el momento de la migracion. */
  fechaEtapa?: Date | null;
  /** Solo si el nombre de la hoja es un usuario del CRM (`duenoDesdeLaHoja`); si no, sin dueño. */
  ownerUserId?: string | null;
  cohortId?: string | null;
  acuerdoPago?: string | null;
  onboardedAt?: Date | null;
  /**
   * El envío más reciente del lead al migrar (`enviosDeOrigenPorLead`), o nulo si no tiene
   * ninguno (ADR 0060 punto 3). Tiene que ser un envío de ESTE lead.
   */
  submissionOrigenId?: string | null;
  /** Los `Registro 1-5` de Setteo. Toda actividad migrada es una `nota` (punto 5). */
  notas?: readonly { texto: string; fecha?: Date | null }[];
}

export type DealHistorico =
  | { estado: "creado"; dealId: string }
  /** La segunda corrida: esta fila de la hoja ya entro. No se toca nada. */
  | { estado: "ya_migrado"; dealId: string }
  /** El lead ya tiene un deal abierto en el programa: gana el vivo (punto 3). Es una rareza. */
  | { estado: "lead_con_deal_vivo"; dealVivoId: string };

/**
 * Abre un deal HISTORICO directamente en la etapa que dice la hoja, con UNA fila de
 * historial (`de` nulo), su rastro y sus notas, en una transaccion (ADR 0059).
 *
 * Es el otro camino de nacimiento, al lado de `abrirDeal`, y vive en el motor porque
 * escribe la etapa. **No pasa por `queLeFalta`**: lo que la hoja no trae (valor vendido,
 * fecha limite) le falta al deal y la Ficha lo dice, como a cualquier otro. Lo usa solo
 * la migracion, y `tests/migracion-escritor-guardian.test.ts` lo fija.
 *
 * Las dos formas de chocar las decide la BASE (ADR 0005) y aqui solo se nombran: la huella
 * repetida es la segunda corrida, y el cupo ocupado es el deal vivo que gana.
 */
export async function abrirDealHistorico(db: Db, alta: AltaHistorica): Promise<DealHistorico> {
  const [r] = await abrirDealesHistoricos(db, [alta]);
  return r;
}

/**
 * `abrirDealHistorico` para todo un programa: las mismas reglas, en lote (ticket 078). Fila
 * por fila eran ~20 viajes a la base por deal, y la corrida de un programa tardo 40 minutos
 * con una transaccion abierta en produccion; en lote son unas diez consultas por cada 500.
 *
 * Todo en una transaccion: la frontera de programa se valida para TODAS las altas antes de
 * escribir (una sola mala tumba el lote, como tumbaba la corrida), y los choques los sigue
 * decidiendo el indice (`ON CONFLICT DO NOTHING`, ADR 0005); despues solo se pregunta cual
 * de los dos fue. Devuelve un resultado por alta, en el mismo orden.
 */
export async function abrirDealesHistoricos(db: Db, altas: readonly AltaHistorica[]): Promise<DealHistorico[]> {
  for (const alta of altas) {
    if (alta.huella.trim() === "") {
      throw new Error("Un deal historico sin huella no se puede volver a encontrar: la migracion la tiene que dar.");
    }
  }
  if (altas.length === 0) return [];
  const actorId = altas[0].actorId;
  if (altas.some((a) => a.actorId !== actorId)) throw new Error("Un lote historico tiene un solo actor.");

  const leadIds = unicos(altas.map((a) => a.leadId));
  const cohortIds = unicos(altas.map((a) => a.cohortId));
  const envioIds = unicos(altas.map((a) => a.submissionOrigenId));

  return (db as unknown as Transaccion).transaction(async (tx) => {
    // Las tres lecturas de la frontera viajan juntas.
    const [filasLead, filasCoh, filasEnv] = await Promise.all([
      tx
        .select({ id: leads.id, programId: leads.programId, nombre: leads.nombre, email: leads.emailNormalizado })
        .from(leads)
        .where(inArray(leads.id, leadIds)),
      cohortIds.length > 0
        ? tx.select({ id: cohorts.id, programId: cohorts.programId }).from(cohorts).where(inArray(cohorts.id, cohortIds))
        : Promise.resolve([]),
      envioIds.length > 0
        ? tx.select({ id: submissions.id, leadId: submissions.leadId }).from(submissions).where(inArray(submissions.id, envioIds))
        : Promise.resolve([]),
    ]);
    const lead = new Map(filasLead.map((l) => [l.id, l]));
    const programaDeCohorte = new Map(filasCoh.map((c) => [c.id, c.programId]));
    const leadDeEnvio = new Map(filasEnv.map((s) => [s.id, s.leadId]));

    const etiquetas = altas.map((alta) => {
      const l = lead.get(alta.leadId);
      if (!l) throw new ErrorDeApp("No existe el lead.", 404);
      if (l.programId !== alta.programId) {
        throw new ErrorDeApp("El lead es de otro programa: el deal tiene que abrirse en el programa del lead.", 422);
      }
      // La frontera tambien vale para la cohorte: la FK solo mira que exista.
      if (alta.cohortId && programaDeCohorte.get(alta.cohortId) !== alta.programId) {
        throw new ErrorDeApp("La cohorte no existe o es de otro programa.", 422);
      }
      // El origen de la venta (ADR 0060): la FK solo mira que el envío exista, y uno de otro
      // lead le atribuiría a esta venta el clic de otra persona sin ningún error.
      if (alta.submissionOrigenId && leadDeEnvio.get(alta.submissionOrigenId) !== alta.leadId) {
        throw new ErrorDeApp("El envío de origen no existe o es de otro lead.", 422);
      }
      return l.nombre ?? l.email;
    });

    const ids = await crearVariosConRastro(
      { db: tx, tabla: deals, nombreTabla: "deals", actorId, desdeElMotor: true, omitirChoques: true },
      altas.map((alta, i) => ({
        etiqueta: etiquetas[i],
        valores: {
          leadId: alta.leadId,
          programId: alta.programId,
          etapa: alta.etapa,
          pendiente: alta.pendiente ?? null,
          ownerUserId: alta.ownerUserId ?? null,
          cohortId: alta.cohortId ?? null,
          acuerdoPago: alta.acuerdoPago ?? null,
          onboardedAt: alta.onboardedAt ?? null,
          submissionOrigenId: alta.submissionOrigenId ?? null,
          huellaMigracion: alta.huella,
          creadoPor: null,
        },
      })),
    );

    // Los que chocaron: se pregunta cual de los dos indices fue. La huella repetida es la
    // segunda corrida; el cupo ocupado es el deal vivo que gana.
    const chocados = altas.filter((_, i) => ids[i] == null);
    const migrados = new Map<string, string>();
    const vivos = new Map<string, string>();
    if (chocados.length > 0) {
      const [porHuella, abiertos] = await Promise.all([
        tx
          .select({ id: deals.id, huella: deals.huellaMigracion })
          .from(deals)
          .where(and(inArray(deals.huellaMigracion, chocados.map((a) => a.huella)), incluyendoAnulados(deals))),
        tx
          .select({ id: deals.id, leadId: deals.leadId, programId: deals.programId })
          .from(deals)
          .where(
            and(
              inArray(deals.leadId, unicos(chocados.map((a) => a.leadId))),
              notInArray(deals.etapa, ["ganado_completo", "cierre_perdido"]),
              vigente(deals),
            ),
          ),
      ]);
      for (const d of porHuella) if (d.huella) migrados.set(d.huella, d.id);
      for (const d of abiertos) vivos.set(`${d.leadId}:${d.programId}`, d.id);
    }

    const creados = altas.flatMap((alta, i) => {
      const dealId = ids[i];
      return dealId ? [{ alta, dealId, etiqueta: etiquetas[i] }] : [];
    });
    for (let i = 0; i < creados.length; i += 500) {
      await tx.insert(dealEtapaHistorial).values(
        creados.slice(i, i + 500).map(({ alta, dealId }) => ({
          dealId,
          de: null,
          a: alta.etapa,
          pendienteDe: null,
          pendienteA: alta.pendiente ?? null,
          userId: null,
          ...(alta.fechaEtapa ? { fecha: alta.fechaEtapa } : {}),
        })),
      );
    }
    await crearVariosConRastro(
      { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId },
      creados.flatMap(({ alta, dealId, etiqueta }) =>
        (alta.notas ?? [])
          .filter((n) => n.texto.trim() !== "")
          .map((nota) => ({
            etiqueta,
            valores: { dealId, tipo: "nota", userId: null, nota: nota.texto, ...(nota.fecha ? { fecha: nota.fecha } : {}) },
          })),
      ),
    );

    return altas.map((alta, i): DealHistorico => {
      const dealId = ids[i];
      if (dealId) return { estado: "creado", dealId };
      const migrado = migrados.get(alta.huella);
      if (migrado) return { estado: "ya_migrado", dealId: migrado };
      const vivo = vivos.get(`${alta.leadId}:${alta.programId}`);
      if (vivo) return { estado: "lead_con_deal_vivo", dealVivoId: vivo };
      throw new Error("Un deal historico choco con un indice unico que no es su huella ni el cupo del lead.");
    });
  });
}

function unicos(xs: readonly (string | null | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => !!x))];
}

/**
 * Una flecha del sistema la toma el CRM cuando pasa el evento (se pega el Grain,
 * entra un abono); una de closer la toma una persona. Que una persona "mueva a
 * Ganado Pago Parcial" sin abono, o que el sistema decida por el closer que alguien dijo que no,
 * es justo lo que la tabla prohibe.
 *
 * Y para una PERSONA hay una segunda reja (Mani, 27-sep, punto 3): solo mueve el deal
 * su dueño o quien administra (`esAdministrador`, ADR 0025 — nunca `rol === "gerente"`
 * a mano, o el developer quedaria afuera). Un deal sin dueño no lo mueve una persona
 * que no administra: lo mueve el sistema hasta que alguien lo reclame. La reja vive
 * aca, en el motor, y no en quien lo llama, que era la puerta que alguien olvidaba.
 */
function quienNoPuede(t: FlechaBase & { a?: EtapaDeal }, actor: Actor, deal: FilaDeal): string | null {
  if (t.quien === "sistema" && actor.tipo === "usuario") {
    return `${t.a ? `A ${NOMBRE_DE_ETAPA[t.a]}` : "Ese pendiente"} no se mueve a mano: lo mueve el CRM cuando pasa el hecho (${t.id}).`;
  }
  if (t.quien === "closer" && actor.tipo === "sistema") {
    return `${t.a ? `A ${NOMBRE_DE_ETAPA[t.a]}` : "Ese pendiente"} lo mueve una persona, no el sistema (${t.id}).`;
  }
  if (actor.tipo === "usuario" && !puedeTrabajarDeal(actor, deal)) {
    if (deal.ownerUserId == null) {
      return "Este deal no tiene dueño: hasta que alguien lo reclame, solo lo mueve el sistema.";
    }
    return "Solo el dueño del deal o un administrador pueden moverlo.";
  }
  return null;
}

const HECHOS_VACIOS: HechosDelDeal = {
  tieneDueno: false,
  tieneActividadComercial: false,
  tieneContactoRegistrado: false,
  pendienteActual: null,
  tieneLlamadaConFecha: false,
  llamadaSucedio: false,
  llamadaFallida: false,
  valorVendidoUsd: null,
  areaDeclaradaId: null,
  esHistorico: false,
  fechaLimitePago: null,
  cohorteDestinoId: null,
  fechaInicioVentasCohorteDestino: null,
  fechaUltimoContacto: null,
  fechaSeguimiento: null,
  abonosVigentes: 0,
  abonoConComprobante: false,
  saldo: null,
  motivoId: null,
};

async function darPorAtendida(tx: Db, deal: FilaDeal, actorUserId: string): Promise<void> {
  const [call] = await tx
    .select()
    .from(calls)
    .where(and(eq(calls.dealId, deal.id), vigente(calls)))
    .orderBy(desc(calls.createdAt))
    .limit(1);

  if (!call || call.fechaAgenda == null) {
    const mensaje = "No hay una llamada con fecha que dar por atendida. Crea o agenda la llamada primero.";
    throw new MovimientoRechazado(mensaje, [{ codigo: "llamada_con_fecha", mensaje }], 422);
  }

  if ((RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(call.resultado)) return;

  await editarConRastro(
    {
      db: tx,
      tabla: calls,
      nombreTabla: "calls",
      actorId: actorUserId,
      etiqueta: call.emailLead ?? call.id,
    },
    call.id,
    {
      resultado: "show" as const,
      ...(call.fechaLlamada == null ? { fechaLlamada: call.fechaAgenda } : {}),
    },
  );
}

/**
 * Resultados de llamada que prueban que la llamada OCURRIO. Mientras `calls` no tenga
 * el link de Grain (ticket 058), "sucedio" es que el closer la marco con uno de estos.
 */
/** Resultados que prueban que la llamada ocurrió, incluso cuando terminó perdida. */
export const RESULTADOS_QUE_OCURRIERON = ["show", "compromiso_pago", "cerrada", "perdida"] as const;

/**
 * Los dos resultados de una llamada fallida (ADR 0015): el motor los lee para el hecho
 * `llamada_fallida`. La lista es UNA y vive aquí; `lib/deals/llamadas.ts` la re-exporta
 * para su schema de `marcarFallida` y para la server action de acciones de deal. Estuvo
 * copiada en los dos módulos (hallazgo A3 del ticket 114).
 */
export const RESULTADOS_FALLIDOS = ["no_show", "cancelada"] as const;

type FilaDeal = typeof deals.$inferSelect;

/** Los hechos del deal, leidos de la base dentro de la misma transaccion. */
export async function leerHechos(
  tx: Db,
  deal: FilaDeal,
  motivoId: string | null,
  tipoEsperado: TipoMotivo | null,
): Promise<HechosDelDeal> {
  const actividades = await tx
    .select({ tipo: dealActividades.tipo, canal: dealActividades.canal, fecha: dealActividades.fecha })
    .from(dealActividades)
    .where(eq(dealActividades.dealId, deal.id))
    .orderBy(desc(dealActividades.fecha));
  const contacto = actividades.find((a) => a.tipo === "contacto" && a.canal != null);

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

  // Un motivo cuenta solo si existe, esta activo y es de la LISTA que la flecha pide
  // (punto 2, Mani 27-sep): un motivo de perdida no sirve para una re-agenda. Un motivo
  // inactivo o de otra lista es "no motivo" —el requisito lo reporta como faltante— sin
  // un error aparte, igual que ya pasaba con el desactivado.
  const motivoValido =
    motivoId && tipoEsperado
      ? await tx
          .select({ id: motivos.id })
          .from(motivos)
          .where(and(eq(motivos.id, motivoId), eq(motivos.activo, true), eq(motivos.tipo, tipoEsperado)))
      : motivoId
        ? await tx
            .select({ id: motivos.id })
            .from(motivos)
            .where(and(eq(motivos.id, motivoId), eq(motivos.activo, true)))
        : [];

  const saldo = (await saldosDeDeals(tx, [deal.id])).get(deal.id);
  const [cohorteDestino] = deal.cohorteDestinoId
    ? await tx.select({ fechaInicioVentas: cohorts.fechaInicioVentas }).from(cohorts).where(eq(cohorts.id, deal.cohorteDestinoId))
    : [];

  // La llamada mas reciente (`orderBy createdAt desc`, ya aplicado): "sucedio" mira SOLO
  // la ultima (punto 4, Mani 27-sep), no `some()` sobre todas. Con "un deal, muchas
  // llamadas" (ADR 0037), un `show` viejo no puede llevar a Atendido si la ultima
  // llamada —una agenda nueva— todavia no ocurrio.
  const ultimaLlamada = llamadas[0];

  return {
    tieneDueno: deal.ownerUserId != null,
    tieneActividadComercial: actividades.some((a) => a.tipo === "contacto" || a.tipo === "intento"),
    tieneContactoRegistrado: contacto != null,
    pendienteActual: deal.pendiente,
    tieneLlamadaConFecha: llamadas.some((l) => l.resultado === "agendada" && l.fechaAgenda != null),
    llamadaSucedio:
      ultimaLlamada != null && (RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(ultimaLlamada.resultado),
    llamadaFallida:
      ultimaLlamada != null && (RESULTADOS_FALLIDOS as readonly string[]).includes(ultimaLlamada.resultado),
    valorVendidoUsd: deal.valorVendidoUsd == null ? null : Number(deal.valorVendidoUsd),
    areaDeclaradaId: deal.areaDeclaradaId,
    esHistorico: deal.huellaMigracion != null,
    fechaLimitePago: deal.fechaLimitePago,
    // La cohorte destino es la columna aparte (Mani 27-sep, punto 1): `cohort_id` sigue
    // siendo la de origen y no se toca al ir a Proxima Cohorte, asi la conversion de la
    // cohorte de origen no pierde el deal. Ya no se exige que sea una cohorte `futuro`.
    cohorteDestinoId: deal.cohorteDestinoId,
    fechaInicioVentasCohorteDestino: cohorteDestino?.fechaInicioVentas ?? null,
    fechaUltimoContacto: contacto?.fecha ?? null,
    fechaSeguimiento: deal.fechaSeguimiento,
    abonosVigentes: saldo?.abonosVigentes ?? 0,
    abonoConComprobante: ultimoAbono?.comprobanteUrl != null && ultimoAbono.comprobanteUrl.trim() !== "",
    saldo: saldo?.saldo ?? null,
    motivoId: motivoValido[0]?.id ?? null,
  };
}

/**
 * La etapa a la que vuelve un deal cuando se anula su ultimo abono (A1): de donde venia
 * la última vez que entró a una etapa ganada desde Contactado, Calificado, Atendido o
 * Compromiso Verbal. Se miran las dos etapas ganadas porque un pago total puede entrar
 * directamente a Ganado Pagado Completo. Las entradas de A2 quedan fuera por `de`.
 *
 * Un deal sin historial de pago (los que trae la migracion, ticket 080) vuelve a
 * **Compromiso Verbal** (Mani, 28-sep): es donde esta un lead que ya dijo que si.
 */
export async function etapaALaQueVuelve(tx: Db, dealId: string): Promise<EtapaDeal> {
  const [fila] = await tx
    .select({ de: dealEtapaHistorial.de })
    .from(dealEtapaHistorial)
    .where(
      and(
        eq(dealEtapaHistorial.dealId, dealId),
        inArray(dealEtapaHistorial.a, ["ganado_parcial", "ganado_completo"]),
        inArray(dealEtapaHistorial.de, ["contactado", "calificado", "atendido", "compromiso_verbal"]),
      ),
    )
    .orderBy(desc(dealEtapaHistorial.fecha))
    .limit(1);
  return fila?.de ?? "compromiso_verbal";
}

export async function etapaAntesDeCompromiso(tx: Db, dealId: string): Promise<EtapaDeal | null> {
  const [fila] = await tx
    .select({ de: dealEtapaHistorial.de })
    .from(dealEtapaHistorial)
    .where(and(
      eq(dealEtapaHistorial.dealId, dealId),
      eq(dealEtapaHistorial.a, "compromiso_verbal"),
      inArray(dealEtapaHistorial.de, ["atendido", "contactado", "calificado"]),
    ))
    .orderBy(desc(dealEtapaHistorial.fecha))
    .limit(1);
  return fila?.de ?? null;
}

/** Un requisito de la flecha y si el deal ya lo cumple. */
export interface RequisitoRevisado {
  codigo: CodigoRequisito;
  mensaje: string;
  cumple: boolean;
}

export interface RevisionDeMovimiento {
  /** Lo que la flecha pide, en verde (cumple) y en rojo (falta). */
  requisitos: RequisitoRevisado[];
  /** Por qué no se puede aunque se llene todo: no hay flecha, o no le toca a este actor. */
  bloqueo: string | null;
  /** RETRO: la etapa a la que vuelve, según el historial. */
  destinoRetro: EtapaDeal | null;
}

/** El ensayo termina siempre deshaciendo: este error lo marca. */
class EnsayoDeshecho extends Error {}

/**
 * Lo que el deal tiene y le falta para un movimiento, sin moverlo (ADR 0072 punto 2).
 *
 * Es un ENSAYO de `moverEtapa`: corre el movimiento de verdad dentro de una transaccion
 * que siempre se deshace, y devuelve lo que el motor contesto. Asi la vista previa no
 * puede decir algo distinto de lo que el motor acepta o rechaza: es el mismo codigo,
 * con los mismos datos. Para el retroceso de Compromiso Verbal (`retroceso`), el destino
 * lo dice el historial, no quien llama.
 */
export async function revisarMovimiento(
  db: Db,
  mov: Omit<Movimiento, "a"> & { a: EtapaDeal | "retroceso" },
): Promise<RevisionDeMovimiento> {
  const [deal] = await db
    .select({ etapa: deals.etapa, pendiente: deals.pendiente })
    .from(deals)
    .where(and(eq(deals.id, mov.dealId), incluyendoAnulados(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal.", 404);

  let a: EtapaDeal;
  let destinoRetro: EtapaDeal | null = null;
  if (mov.a === "retroceso") {
    destinoRetro = await etapaAntesDeCompromiso(db, mov.dealId);
    if (destinoRetro == null) {
      return { requisitos: [], bloqueo: "El historial no dice desde qué etapa entró a Compromiso Verbal.", destinoRetro };
    }
    a = destinoRetro;
  } else {
    a = mov.a;
  }

  const { transicion: t } = resolverTransicion(deal.etapa, deal.pendiente, a, mov.pendiente ?? null);
  const codigos = t ? requisitosDeTransicion(t) : [];

  let faltan: RequisitoFaltante[] = [];
  let bloqueo: string | null = null;
  try {
    await (db as unknown as Transaccion).transaction(async (tx) => {
      await moverEtapa(tx, { ...mov, a });
      throw new EnsayoDeshecho();
    });
  } catch (e) {
    if (e instanceof MovimientoRechazado) {
      faltan = e.faltantes;
      // Un rechazo sin faltantes de la flecha (403, 409, sin flecha) no se arregla
      // llenando campos: se dice tal cual.
      if (faltan.length === 0 || faltan.every((f) => !codigos.includes(f.codigo))) bloqueo = e.message;
    } else if (!(e instanceof EnsayoDeshecho)) {
      throw e;
    }
  }

  const requisitos = codigos.map((codigo) => {
    const falta = faltan.find((f) => f.codigo === codigo);
    return {
      codigo,
      mensaje: falta?.mensaje ?? (codigo === "transicion_no_permitida" ? "" : MENSAJES[codigo]),
      cumple: !falta,
    };
  });
  return { requisitos, bloqueo, destinoRetro };
}
