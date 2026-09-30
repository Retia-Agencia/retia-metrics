import { and, desc, eq, gte, inArray, isNotNull, notInArray } from "drizzle-orm";
import {
  abonos,
  calls,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  productos,
  submissions,
} from "@/lib/db/schema";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { esViolacionUnica } from "@/lib/db/errores";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import type { Rol } from "@/lib/auth/roles";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { exigirFechaLimiteValida } from "./pago";
import { puedeTrabajarDeal } from "./permiso";
import { NOMBRE_DE_ETAPA, transicion, type EtapaDeal, type TipoMotivo, type Transicion } from "./etapas";
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
 * del propio deal (producto, fechas, acuerdo, cohorte destino), no evidencia de un
 * evento.
 */
export interface DatosMovimiento {
  productoId?: string | null;
  fechaLimitePago?: string | null;
  acuerdoPago?: string | null;
  /** La cohorte a la que quiere entrar (Proxima Cohorte). `deals.cohorte_destino_id`. */
  cohorteDestinoId?: string | null;
  fechaSeguimiento?: string | null;
}

export interface Movimiento {
  dealId: string;
  a: EtapaDeal;
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

    const hechos = await leerHechos(tx, dealActualizado, mov.motivoId ?? null, t.tipoDeMotivo);
    const faltantes = queLeFalta(de, mov.a, hechos);
    if (faltantes.length > 0) {
      throw new MovimientoRechazado(faltantes.map((f) => f.mensaje).join(" "), faltantes);
    }

    // A1: al anular el unico abono, Abonado vuelve a la etapa de donde vino, y esa la
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

    // La condicion `etapa = de` es la reja contra dos movimientos simultaneos: si otro
    // movio el deal entre la lectura y esta escritura, no se pisa, se rechaza.
    // Al perder (P) se escribe `deals.motivo_id` en la misma transaccion (punto 5): la
    // ficha del deal muestra el motivo, no solo el historial.
    const escritas = await tx
      .update(deals)
      .set({
        etapa: mov.a,
        updatedAt: new Date(),
        ...(mov.a === "cierre_perdido" ? { motivoId: mov.motivoId ?? null } : {}),
      })
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
 * Escribe en el deal, dentro de la transaccion del movimiento, los datos que trae el
 * movimiento (punto 6). No filtra por flecha: quien puede mover el deal (su dueño o
 * quien administra) tambien puede editarlo, asi que un dato de mas no abre ninguna
 * puerta; lo que la flecha EXIGE lo sigue midiendo `queLeFalta`. Valida cada uno antes:
 *  - **producto**: activo y del mismo programa del deal (frontera, ADR 0043).
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

  if (datos.productoId !== undefined) {
    if (datos.productoId !== null) {
      const [prod] = await tx
        .select({ id: productos.id })
        .from(productos)
        .where(and(eq(productos.id, datos.productoId), eq(productos.activo, true), eq(productos.programId, deal.programId)));
      if (!prod) {
        throw new MovimientoRechazado("El producto no existe, está inactivo o es de otro programa.", [], 422);
      }
    }
    aplicar("productoId", datos.productoId);
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
 * - Una persona abre a mano (el lead que llego por WhatsApp, ADR 0044) en Pendiente
 *   Setteo, En Contacto o Compromiso Verbal, y el deal nace con ella de dueña.
 * - El sistema abre en Pendiente Setteo (calificó y no agendó) o en Agendado (llego con
 *   agenda); lo usan el 052 y el 096.
 *
 * Ninguno nace en Atendido, Abonado o Completo: a esas se entra por un hecho (el Grain,
 * un abono), no por un alta.
 */
const NACIMIENTOS: Readonly<Record<Actor["tipo"], readonly EtapaDeal[]>> = {
  usuario: ["pendiente_setteo", "en_contacto", "compromiso_verbal"],
  sistema: ["pendiente_setteo", "agendado"],
};

export interface AltaDeDeal {
  leadId: string;
  programId: string;
  etapa: EtapaDeal;
  actor: Actor;
  productoId?: string | null;
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
  if (alta.etapa === "compromiso_verbal") {
    const faltantes = queLeFalta("en_contacto", "compromiso_verbal", {
      ...HECHOS_VACIOS,
      productoId: alta.productoId ?? null,
      fechaLimitePago: alta.fechaLimitePago ?? null,
    });
    if (faltantes.length > 0) {
      throw new MovimientoRechazado(faltantes.map((f) => f.mensaje).join(" "), faltantes);
    }
  }

  return (db as unknown as Transaccion).transaction(async (tx) => {
    // El programa es frontera (ADR 0043): un deal de un programa sobre un lead de otro
    // mezclaria las dos economias sin lanzar ningun error.
    const [lead] = await tx.select().from(leads).where(eq(leads.id, alta.leadId));
    if (!lead) throw new ErrorDeApp("No existe el lead.", 404);
    if (lead.programId !== alta.programId) {
      throw new ErrorDeApp("El lead es de otro programa: el deal tiene que abrirse en el programa del lead.", 422);
    }
    if (alta.fechaLimitePago) {
      await exigirFechaLimiteValida(tx, { programId: alta.programId, cohortId: alta.cohortId ?? null }, alta.fechaLimitePago);
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
          productoId: alta.productoId ?? null,
          fechaLimitePago: alta.fechaLimitePago ?? null,
          cohortId: alta.cohortId ?? null,
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

    await tx.insert(dealEtapaHistorial).values({ dealId: id, de: null, a: alta.etapa, userId: usuario });
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
  /** `sheets:<programa>:<pestaña>:<llave>`. La garantia contra la segunda corrida (punto 2). */
  huella: string;
  actorId: string;
  /** Cuando entro a esa etapa, si la hoja lo sabe. Sin fecha, el momento de la migracion. */
  fechaEtapa?: Date | null;
  /** Solo si el nombre de la hoja es un usuario del CRM (`duenoDesdeLaHoja`); si no, sin dueño. */
  ownerUserId?: string | null;
  productoId?: string | null;
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
 * escribe la etapa. **No pasa por `queLeFalta`**: lo que la hoja no trae (producto,
 * fecha limite) le falta al deal y la Ficha lo dice, como a cualquier otro. Lo usa solo
 * la migracion, y `tests/migracion-escritor-guardian.test.ts` lo fija.
 *
 * Las dos formas de chocar las decide la BASE (ADR 0005) y aqui solo se nombran: la huella
 * repetida es la segunda corrida, y el cupo ocupado es el deal vivo que gana.
 */
export async function abrirDealHistorico(db: Db, alta: AltaHistorica): Promise<DealHistorico> {
  if (alta.huella.trim() === "") {
    throw new Error("Un deal historico sin huella no se puede volver a encontrar: la migracion la tiene que dar.");
  }
  const notas = (alta.notas ?? []).filter((n) => n.texto.trim() !== "");

  try {
    return await (db as unknown as Transaccion).transaction(async (tx) => {
      const [lead] = await tx.select().from(leads).where(eq(leads.id, alta.leadId));
      if (!lead) throw new ErrorDeApp("No existe el lead.", 404);
      if (lead.programId !== alta.programId) {
        throw new ErrorDeApp("El lead es de otro programa: el deal tiene que abrirse en el programa del lead.", 422);
      }
      const etiqueta = lead.nombre ?? lead.emailNormalizado;
      // La frontera tambien vale para el producto y la cohorte: la FK solo mira que existan, y
      // un producto de otro programa haria el saldo con el precio equivocado sin ningun error.
      // No se exige que el producto este activo: una venta vieja pudo ser de uno ya retirado.
      if (alta.productoId) {
        const [prod] = await tx
          .select({ id: productos.id })
          .from(productos)
          .where(and(eq(productos.id, alta.productoId), eq(productos.programId, alta.programId)));
        if (!prod) throw new ErrorDeApp("El producto no existe o es de otro programa.", 422);
      }
      if (alta.cohortId) {
        const [coh] = await tx
          .select({ id: cohorts.id })
          .from(cohorts)
          .where(and(eq(cohorts.id, alta.cohortId), eq(cohorts.programId, alta.programId)));
        if (!coh) throw new ErrorDeApp("La cohorte no existe o es de otro programa.", 422);
      }
      // El origen de la venta (ADR 0060): la FK solo mira que el envío exista, y uno de otro
      // lead le atribuiría a esta venta el clic de otra persona sin ningún error.
      if (alta.submissionOrigenId) {
        const [env] = await tx
          .select({ id: submissions.id })
          .from(submissions)
          .where(and(eq(submissions.id, alta.submissionOrigenId), eq(submissions.leadId, alta.leadId)));
        if (!env) throw new ErrorDeApp("El envío de origen no existe o es de otro lead.", 422);
      }

      const dealId = await crearConRastro(
        { db: tx, tabla: deals, nombreTabla: "deals", actorId: alta.actorId, etiqueta, desdeElMotor: true },
        {
          leadId: alta.leadId,
          programId: alta.programId,
          etapa: alta.etapa,
          ownerUserId: alta.ownerUserId ?? null,
          productoId: alta.productoId ?? null,
          cohortId: alta.cohortId ?? null,
          acuerdoPago: alta.acuerdoPago ?? null,
          onboardedAt: alta.onboardedAt ?? null,
          submissionOrigenId: alta.submissionOrigenId ?? null,
          huellaMigracion: alta.huella,
          creadoPor: null,
        },
      );

      await tx.insert(dealEtapaHistorial).values({
        dealId,
        de: null,
        a: alta.etapa,
        userId: null,
        ...(alta.fechaEtapa ? { fecha: alta.fechaEtapa } : {}),
      });

      for (const nota of notas) {
        await crearConRastro(
          { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: alta.actorId, etiqueta },
          { dealId, tipo: "nota", userId: null, nota: nota.texto, ...(nota.fecha ? { fecha: nota.fecha } : {}) },
        );
      }

      return { estado: "creado", dealId } as const;
    });
  } catch (e) {
    if (!esViolacionUnica(e)) throw e;
    // La transaccion ya se deshizo; se pregunta afuera cual de los dos indices choco.
    const [migrado] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.huellaMigracion, alta.huella), incluyendoAnulados(deals)));
    if (migrado) return { estado: "ya_migrado", dealId: migrado.id };

    const [vivo] = await db
      .select({ id: deals.id })
      .from(deals)
      .where(
        and(
          eq(deals.leadId, alta.leadId),
          eq(deals.programId, alta.programId),
          notInArray(deals.etapa, ["completo", "cierre_perdido"]),
          vigente(deals),
        ),
      );
    if (vivo) return { estado: "lead_con_deal_vivo", dealVivoId: vivo.id };
    throw e;
  }
}

/**
 * Una flecha del sistema la toma el CRM cuando pasa el evento (se pega el Grain,
 * entra un abono); una de closer la toma una persona. Que una persona "mueva a
 * Abonado" sin abono, o que el sistema decida por el closer que alguien dijo que no,
 * es justo lo que la tabla prohibe.
 *
 * Y para una PERSONA hay una segunda reja (Mani, 27-sep, punto 3): solo mueve el deal
 * su dueño o quien administra (`esAdministrador`, ADR 0025 — nunca `rol === "gerente"`
 * a mano, o el developer quedaria afuera). Un deal sin dueño no lo mueve una persona
 * que no administra: lo mueve el sistema hasta que alguien lo reclame. La reja vive
 * aca, en el motor, y no en quien lo llama, que era la puerta que alguien olvidaba.
 */
function quienNoPuede(t: Transicion, actor: Actor, deal: FilaDeal): string | null {
  if (t.quien === "sistema" && actor.tipo === "usuario") {
    return `A ${NOMBRE_DE_ETAPA[t.a]} no se mueve a mano: la mueve el CRM cuando pasa el hecho (${t.id}).`;
  }
  if (t.quien === "closer" && actor.tipo === "sistema") {
    return `A ${NOMBRE_DE_ETAPA[t.a]} lo mueve una persona, no el sistema (${t.id}).`;
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
async function leerHechos(
  tx: Db,
  deal: FilaDeal,
  motivoId: string | null,
  tipoEsperado: TipoMotivo | null,
): Promise<HechosDelDeal> {
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
        // `gte` y no una plantilla `sql`: la plantilla manda el `Date` crudo al driver, y
        // postgres-js lo rechaza (ERR_INVALID_ARG_TYPE) contra un Postgres real. PGlite lo
        // acepta, asi que ningun test lo veia; salio sembrando la base local (113).
        gte(dealActividades.fecha, desde),
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

  // La llamada mas reciente (`orderBy createdAt desc`, ya aplicado): "sucedio" mira SOLO
  // la ultima (punto 4, Mani 27-sep), no `some()` sobre todas. Con "un deal, muchas
  // llamadas" (ADR 0037), un `show` viejo no puede llevar a Atendido si la ultima
  // llamada —una agenda nueva— todavia no ocurrio.
  const ultimaLlamada = llamadas[0];

  return {
    tieneDueno: deal.ownerUserId != null,
    tieneContactoRegistrado: contacto != null,
    tieneLlamadaConFecha: llamadas.some((l) => l.resultado === "agendada" && l.fechaAgenda != null),
    llamadaSucedio:
      ultimaLlamada != null && (RESULTADOS_QUE_OCURRIERON as readonly string[]).includes(ultimaLlamada.resultado),
    llamadaFallida:
      ultimaLlamada != null && (RESULTADOS_FALLIDOS as readonly string[]).includes(ultimaLlamada.resultado),
    productoId: deal.productoId,
    fechaLimitePago: deal.fechaLimitePago,
    // La cohorte destino es la columna aparte (Mani 27-sep, punto 1): `cohort_id` sigue
    // siendo la de origen y no se toca al ir a Proxima Cohorte, asi la conversion de la
    // cohorte de origen no pierde el deal. Ya no se exige que sea una cohorte `futuro`.
    cohorteDestinoId: deal.cohorteDestinoId,
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

/**
 * La etapa a la que vuelve un deal cuando se anula su ultimo abono (A1): de donde venia
 * la ultima vez que entro a Abonado **o a Completo** desde una de las cuatro etapas que
 * pagan (2, 5, 6, 11). Se miran las dos porque un deal que pago todo de una vez fue
 * directo a Completo (T5, T14, T17, T26) sin pasar por Abonado, y sin eso no habria a donde
 * volver. Las entradas que vienen de Completo (A2) quedan fuera por el filtro de `de`.
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
        inArray(dealEtapaHistorial.a, ["abonado", "completo"]),
        inArray(dealEtapaHistorial.de, ["en_contacto", "atendido", "compromiso_verbal", "seguimiento"]),
      ),
    )
    .orderBy(desc(dealEtapaHistorial.fecha))
    .limit(1);
  return fila?.de ?? "compromiso_verbal";
}
