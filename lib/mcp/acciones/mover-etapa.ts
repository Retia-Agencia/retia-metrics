import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { etapaDealEnum, pendienteDealEnum } from "@/lib/db/schema";
import { estadoParaAccionDeal, huellaDeAccionDeal } from "@/lib/deals/estado-para-accion";
import { esquemaMover, moverDealComo, revisarMovimientoComo, type EntradaMover } from "@/lib/deals/mover-deal";
import { esquemaDescuentoUsdOpcional } from "@/lib/deals/valor-vendido";
import { esquemaProximoContacto } from "@/lib/deals/proximo-contacto";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const datos = z.object({
  descuento_usd: esquemaDescuentoUsdOpcional,
  fecha_limite_pago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida.").nullable().optional(),
  acuerdo_pago: z.string().trim().max(500).nullable().optional(),
  cohorte_destino_id: z.string().uuid().nullable().optional(),
  fecha_seguimiento: esquemaProximoContacto,
}).strict().optional();

const movimiento = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  a: z.enum(etapaDealEnum.enumValues),
  pendiente: z.enum(pendienteDealEnum.enumValues).nullable().optional(),
  motivo_id: z.string().uuid().nullable().optional(),
  comentario_motivo: z.string().trim().max(4000).optional(),
  datos,
}).strict();

export const argumentosMoverEtapa = z.object({
  movimientos: z.array(movimiento).min(1).max(50),
}).strict();

interface ObjetivoMover extends ObjetivoAccionMcp {
  movimiento: z.output<typeof movimiento>;
}

function aMovimientoApp(mov: z.output<typeof movimiento>): EntradaMover {
  return {
    dealId: mov.deal_id,
    a: mov.a,
    pendiente: mov.pendiente,
    motivoId: mov.motivo_id,
    comentarioMotivo: mov.comentario_motivo,
    datos: mov.datos ? {
      descuentoUsd: mov.datos.descuento_usd,
      fechaLimitePago: mov.datos.fecha_limite_pago,
      acuerdoPago: mov.datos.acuerdo_pago,
      cohorteDestinoId: mov.datos.cohorte_destino_id,
      fechaSeguimiento: mov.datos.fecha_seguimiento,
    } : undefined,
  };
}

export const moverEtapaMcp: AccionMcp<typeof argumentosMoverEtapa> = {
  clave: "mover_etapa",
  titulo: "Mover de etapa",
  cuandoUsarla: "Cuando una persona quiere cambiar uno o varios deals de etapa.",
  argumentos: argumentosMoverEtapa,
  ejemplo: { movimientos: [{ deal_id: "00000000-0000-4000-8000-000000000000", a: "contactado" }] },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: ({ movimientos }) => movimientos.map((mov) => ({ id: mov.deal_id, movimiento: mov })),
  async revisar(db, actor, objetivo) {
    const mov = (objetivo as ObjetivoMover).movimiento;
    const antes = await estadoParaAccionDeal(db, objetivo.id);
    const revision = await revisarMovimientoComo(db, actor, { ...aMovimientoApp(mov), a: mov.a });
    return {
      antes: antes ? { etapa: antes.etapa, pendiente: antes.pendiente } : null,
      despues: { etapa: revision.destinoRetro ?? mov.a, pendiente: mov.pendiente ?? null },
      sePuedeAplicar: revision.bloqueo == null && revision.requisitos.every((r) => r.cumple),
      razon: revision.bloqueo ?? revision.requisitos.find((r) => !r.cumple)?.mensaje ?? null,
      detalle: { requisitos: revision.requisitos },
    };
  },
  huella: (db, objetivo) => huellaDeAccionDeal(db, objetivo.id),
  aplicar: async (db, actor, objetivo, opciones) => {
    const mov = esquemaMover.parse(aMovimientoApp((objetivo as ObjetivoMover).movimiento));
    await moverDealComo(db, actor, mov, opciones);
  },
  seDeshace: true,
  efectoExterno: false,
};
