import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirLlamadaVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionDeal,
  estadoParaAccionLlamada,
  huellaDeAccionLlamada,
} from "@/lib/deals/estado-para-accion";
import { marcarShow } from "@/lib/deals/llamadas";
import { ErrorDeApp } from "@/lib/errors";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  llamada_id: z.string().uuid("Llamada inválida."),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  llamadaId: string;
}

async function ejecutar(
  db: Parameters<typeof marcarShow>[0],
  actor: Parameters<typeof marcarShow>[1],
  objetivo: Objetivo,
) {
  const llamada = await exigirLlamadaVisible(db, actor, objetivo.llamadaId);
  if (llamada.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe esa llamada en el deal.", 404);
  }
  return marcarShow(db, actor, { callId: objetivo.llamadaId }, { origen: "mcp" });
}

export const marcarShowMcp: AccionMcp<typeof argumentos> = {
  clave: "marcar_show",
  titulo: "Marcar show",
  cuandoUsarla: "Cuando una llamada agendada ya ocurrió.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    llamada_id: "00000000-0000-4000-8000-000000000001",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{ id: entrada.deal_id, llamadaId: entrada.llamada_id }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const [deal, llamada] = await Promise.all([
      estadoParaAccionDeal(db, objetivo.id),
      estadoParaAccionLlamada(db, objetivo.llamadaId),
    ]);
    const prueba = await ensayar(db, async (tx) => ({
      resultado: await ejecutar(tx, actor, objetivo),
      llamada: await estadoParaAccionLlamada(tx, objetivo.llamadaId),
    }));
    return {
      antes: deal && llamada
        ? { etapa: deal.etapa, pendiente: deal.pendiente, resultado: llamada.resultado }
        : null,
      despues: prueba.ok
        ? { etapa: prueba.resultado.resultado.etapa, resultado: prueba.resultado.llamada?.resultado }
        : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: {
        aviso: "No se deshace en un paso; si el resultado quedó mal, corrígelo con corregir resultado.",
      },
    };
  },
  huella: (db, objetivo, opciones) => huellaDeAccionLlamada(
    db,
    objetivo.id,
    (objetivo as Objetivo).llamadaId,
    opciones,
  ),
  aplicar: (db, actor, objetivo) => ejecutar(db, actor, objetivo as Objetivo),
  seDeshace: false,
  efectoExterno: false,
};
