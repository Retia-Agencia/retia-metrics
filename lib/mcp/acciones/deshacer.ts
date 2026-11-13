import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { entradaDeEventoDeshacible, eventosDeshacibles } from "@/lib/deshacer/deshacer";
import { estadoParaAccionDeal, huellaDeAccionDeal } from "@/lib/deals/estado-para-accion";
import { deshacerEventoComo } from "@/lib/deals/mover-deal";
import { ErrorDeApp } from "@/lib/errors";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

export const argumentosDeshacerEvento = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  evento_id: z.string().uuid("Evento inválido."),
  motivo: z.string().trim().max(500).optional(),
}).strict();

interface ObjetivoDeshacer extends ObjetivoAccionMcp {
  eventoId: string;
  motivo?: string;
}

async function eventoDelObjetivo(db: Parameters<typeof eventosDeshacibles>[0], actor: Parameters<typeof eventosDeshacibles>[1], objetivo: ObjetivoDeshacer) {
  return (await eventosDeshacibles(db, actor, objetivo.id)).find((evento) => evento.id === objetivo.eventoId) ?? null;
}

export const deshacerEventoMcp: AccionMcp<typeof argumentosDeshacerEvento> = {
  clave: "deshacer_evento",
  titulo: "Deshacer un evento",
  cuandoUsarla: "Cuando una persona quiere revertir un movimiento que la ficha permite deshacer.",
  argumentos: argumentosDeshacerEvento,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    evento_id: "00000000-0000-4000-8000-000000000001",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (argumentos) => [{ id: argumentos.deal_id, eventoId: argumentos.evento_id, motivo: argumentos.motivo }],
  async revisar(db, actor, objetivoBase) {
    const objetivo = objetivoBase as ObjetivoDeshacer;
    const estado = await estadoParaAccionDeal(db, objetivo.id);
    const evento = await eventoDelObjetivo(db, actor, objetivo);
    const razon = !evento ? "No existe ese evento en el deal." : !evento.puedeDeshacer ? "Este evento no se puede deshacer." : null;
    return {
      antes: estado ? { etapa: estado.etapa, pendiente: estado.pendiente } : null,
      despues: evento ? { cambios: evento.resumen.map((fila) => ({ campo: fila.campo, valor: fila.quedaria })) } : null,
      sePuedeAplicar: razon == null,
      razon,
      detalle: evento ? { resumen: evento.resumen, evento_id: evento.id } : undefined,
    };
  },
  huella: (db, objetivo) => huellaDeAccionDeal(db, objetivo.id),
  async aplicar(db, actor, objetivoBase, opciones) {
    const objetivo = objetivoBase as ObjetivoDeshacer;
    const evento = await eventoDelObjetivo(db, actor, objetivo);
    if (!evento || !evento.puedeDeshacer) throw new ErrorDeApp("Este evento no se puede deshacer.", 409);
    await deshacerEventoComo(db, actor, {
      dealId: objetivo.id,
      evento: entradaDeEventoDeshacible(evento),
      motivo: objetivo.motivo,
    }, opciones);
  },
  seDeshace: false,
  efectoExterno: false,
};
