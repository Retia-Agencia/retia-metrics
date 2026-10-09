import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";
import { calls, dealActividades, deals } from "@/lib/db/schema";
import { crearConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { ErrorDeApp } from "@/lib/errors";
import { reclamarAlMoverPorE1 } from "./cambiar-dueno";
import { agregarLlamada, marcarShow, pegarGrain } from "./llamadas";
import { registrarAbono, type DatosRegistrarAbono } from "./abonos";
import { dealBloqueadoConLead } from "./leer-deal";
import { exigirTextoDelMotivo } from "./motivo-con-texto";
import {
  moverEtapa,
  resolverTransicion,
  type DatosMovimiento,
} from "./mover-etapa";
import type { ActorDeDeal } from "./permiso";
import type { EtapaDeal, PendienteDeal } from "./etapas";
import type { CambioHecho } from "./resumen-del-cambio";

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export type HechoDelMovimiento =
  | { tipo: "atendido"; callId?: string; fechaAgenda?: Date; linkGrain?: string }
  | { tipo: "agendado"; fechaAgenda: Date }
  | ({ tipo: "abono" } & Omit<DatosRegistrarAbono, "dealId">);

export interface DatosMoverConHecho {
  dealId: string;
  a: EtapaDeal;
  pendiente?: PendienteDeal | null;
  motivoId?: string | null;
  comentarioMotivo?: string;
  /**
   * Un comentario del closer que se guarda como NOTA antes de mover (ticket 228). Lo usa
   * "Lo estoy trabajando" (E1 → En gestión): la nota cuenta como la actividad que E1 exige.
   * A diferencia de `comentarioMotivo`, no está atado a un motivo de re-agenda.
   */
  comentario?: string;
  correccion?: boolean;
  datos?: DatosMovimiento;
  hecho?: HechoDelMovimiento;
}

/**
 * Registra el hecho que prueba la etapa y toma la flecha como una sola operación.
 * Las funciones de llamada y abono abren savepoints cuando reciben `tx`; el límite
 * exterior garantiza que un rechazo final del motor deshace también esos hechos.
 */
export async function moverConHecho(
  db: Db,
  actor: ActorDeDeal,
  entrada: DatosMoverConHecho,
): Promise<{ etapa: EtapaDeal; cambio: CambioHecho }> {
  return (db as unknown as Transaccion).transaction(async (tx) => {
    const { deal: inicial, emailLead } = await dealBloqueadoConLead(tx, entrada.dealId);
    if (inicial.anuladoEn) throw new ErrorDeApp("El deal está anulado: no se mueve.", 409);
    // Lo que había antes de tocar nada: de aquí sale el "antes" del aviso (ticket 220).
    const etapaAntes = inicial.etapa;
    const pendienteAntes = inicial.pendiente;

    const resuelta = resolverTransicion(
      inicial.etapa,
      inicial.pendiente,
      entrada.a,
      entrada.pendiente ?? null,
    );
    const motivoReagenda = resuelta.transicion?.tipoDeMotivo === "reagenda";
    if (motivoReagenda && entrada.motivoId) {
      await exigirTextoDelMotivo(tx, entrada.motivoId, entrada.comentarioMotivo);
      if (entrada.comentarioMotivo?.trim()) {
        await crearConRastro(
          { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: actor.userId, etiqueta: emailLead },
          {
            dealId: inicial.id,
            tipo: "nota",
            canal: null,
            userId: actor.userId,
            fecha: new Date(),
            nota: entrada.comentarioMotivo.trim(),
          },
        );
      }
    }

    // "Lo estoy trabajando" (E1, ticket 228) es el gesto con el que un closer toma un lead que
    // casi siempre llega sin dueño: pide comentario y, como Anotar y registrar un contacto,
    // reclama el deal si no tiene dueño. Sin esto, E1 fallaría por "falta dueño" justo en el
    // caso común.
    if (resuelta.transicion?.id === "E1") {
      if (!entrada.comentario?.trim()) {
        throw new ErrorDeApp("Escribe qué hiciste con el lead.", 400);
      }
      await reclamarAlMoverPorE1(tx, {
        idFlecha: resuelta.transicion.id,
        dealId: inicial.id,
        ownerUserId: inicial.ownerUserId,
        actor,
        etiqueta: emailLead,
      });
    }

    // Un comentario suelto (ticket 228, "Lo estoy trabajando") se guarda como nota ANTES de
    // mover: así cuenta como la actividad que E1 exige cuando el motor lee los hechos. Va en la
    // misma transacción, por `crearConRastro`, así que si el movimiento se rechaza también se
    // deshace. No se duplica con el de re-agenda: ese cuelga de un motivo, este no.
    if (entrada.comentario?.trim()) {
      await crearConRastro(
        { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: actor.userId, etiqueta: emailLead },
        {
          dealId: inicial.id,
          tipo: "nota",
          canal: null,
          userId: actor.userId,
          fecha: new Date(),
          nota: entrada.comentario.trim(),
        },
      );
    }

    // La fecha de agenda de la llamada que ESTA operación creó (hecho agendado, o atendido
    // sin callId): de ahí sale `llamadaCreada` del aviso. Null si no se creó ninguna.
    let fechaLlamadaCreada: Date | null = null;
    if (entrada.hecho?.tipo === "agendado") {
      await agregarLlamada(tx, actor, { dealId: inicial.id, fechaAgenda: entrada.hecho.fechaAgenda });
      fechaLlamadaCreada = entrada.hecho.fechaAgenda;
    } else if (entrada.hecho?.tipo === "atendido") {
      let callId = entrada.hecho.callId;
      if (!callId) {
        if (!entrada.hecho.fechaAgenda) throw new ErrorDeApp("Falta la fecha de la llamada.", 422);
        callId = (await agregarLlamada(tx, actor, {
          dealId: inicial.id,
          fechaAgenda: entrada.hecho.fechaAgenda,
        })).callId;
        fechaLlamadaCreada = entrada.hecho.fechaAgenda;
      } else {
        const [llamada] = await tx
          .select({ id: calls.id })
          .from(calls)
          .where(and(eq(calls.id, callId), eq(calls.dealId, inicial.id), vigente(calls)));
        if (!llamada) throw new ErrorDeApp("La llamada no pertenece a este deal.", 404);
      }
      await marcarShow(tx, actor, { callId });
      if (entrada.hecho.linkGrain?.trim()) {
        await pegarGrain(tx, actor, { callId, linkGrain: entrada.hecho.linkGrain.trim() });
      }
    } else if (entrada.hecho?.tipo === "abono") {
      await registrarAbono(tx, actor, {
        dealId: inicial.id,
        fecha: entrada.hecho.fecha,
        monto: entrada.hecho.monto,
        moneda: entrada.hecho.moneda,
        plataformaId: entrada.hecho.plataformaId,
        comprobanteUrl: entrada.hecho.comprobanteUrl,
      });
    }

    const [actual] = await tx
      .select({ etapa: deals.etapa, pendiente: deals.pendiente, fechaSeguimiento: deals.fechaSeguimiento })
      .from(deals)
      .where(and(eq(deals.id, inicial.id), incluyendoAnulados(deals)));
    if (!actual) throw new ErrorDeApp("No existe el deal.", 404);
    // El hecho puede haber dejado el deal donde se pedía (Show → Atendido, abono → Ganado).
    // Si no, el motor toma la flecha; también cuando solo cambia el PENDIENTE en la misma
    // etapa (PR2 pone Re-agenda, RET quita Próxima Cohorte): comparar solo la etapa la saltaría.
    if (actual.etapa !== entrada.a || actual.pendiente !== (entrada.pendiente ?? null)) {
      await moverEtapa(tx, {
        dealId: inicial.id,
        a: entrada.a,
        pendiente: entrada.pendiente,
        actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
        motivoId: entrada.motivoId ?? null,
        correccion: entrada.correccion,
        datos: entrada.datos,
      });
    }

    // El aviso se arma desde lo que quedó ESCRITO: se vuelve a leer la fila por si el motor
    // tocó la etapa o el pendiente después del hecho.
    const [final] = await tx
      .select({ etapa: deals.etapa, pendiente: deals.pendiente, fechaSeguimiento: deals.fechaSeguimiento })
      .from(deals)
      .where(and(eq(deals.id, inicial.id), incluyendoAnulados(deals)));
    if (!final) throw new ErrorDeApp("No existe el deal.", 404);

    const cambio: CambioHecho = {
      etapaAntes,
      etapaDespues: final.etapa,
      pendienteAntes,
      pendienteDespues: final.pendiente,
      fechaPendiente: final.pendiente === "seguimiento" ? final.fechaSeguimiento : null,
      llamadaCreada: fechaLlamadaCreada ? { fecha: fechaLlamadaCreada } : null,
      abonoRegistrado:
        entrada.hecho?.tipo === "abono"
          ? { monto: Number(entrada.hecho.monto), moneda: entrada.hecho.moneda ?? "USD" }
          : null,
    };
    return { etapa: entrada.a, cambio };
  });
}
