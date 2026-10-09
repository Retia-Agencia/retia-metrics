import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";
import { calls, dealActividades, deals } from "@/lib/db/schema";
import { crearConRastro } from "@/lib/crm/rastro";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { ErrorDeApp } from "@/lib/errors";
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
): Promise<{ etapa: EtapaDeal }> {
  return (db as unknown as Transaccion).transaction(async (tx) => {
    const { deal: inicial, emailLead } = await dealBloqueadoConLead(tx, entrada.dealId);
    if (inicial.anuladoEn) throw new ErrorDeApp("El deal está anulado: no se mueve.", 409);

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

    if (entrada.hecho?.tipo === "agendado") {
      await agregarLlamada(tx, actor, { dealId: inicial.id, fechaAgenda: entrada.hecho.fechaAgenda });
    } else if (entrada.hecho?.tipo === "atendido") {
      let callId = entrada.hecho.callId;
      if (!callId) {
        if (!entrada.hecho.fechaAgenda) throw new ErrorDeApp("Falta la fecha de la llamada.", 422);
        callId = (await agregarLlamada(tx, actor, {
          dealId: inicial.id,
          fechaAgenda: entrada.hecho.fechaAgenda,
        })).callId;
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
      .select({ etapa: deals.etapa, pendiente: deals.pendiente })
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
    return { etapa: entrada.a };
  });
}
