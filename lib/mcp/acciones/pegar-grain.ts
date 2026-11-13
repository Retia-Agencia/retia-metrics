import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirLlamadaVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionDeal,
  estadoParaAccionLlamada,
  huellaDeAccionLlamada,
} from "@/lib/deals/estado-para-accion";
import { pegarGrain } from "@/lib/deals/llamadas";
import { ErrorDeApp } from "@/lib/errors";
import { programarLecturaDeGrain } from "@/lib/grain/despues";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  llamada_id: z.string().uuid("Llamada inválida."),
  link_grain: z.string().url().max(2000),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  llamadaId: string;
  linkGrain: string;
}

async function ejecutar(
  db: Parameters<typeof pegarGrain>[0],
  actor: Parameters<typeof pegarGrain>[1],
  objetivo: Objetivo,
) {
  const llamada = await exigirLlamadaVisible(db, actor, objetivo.llamadaId);
  if (llamada.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe esa llamada en el deal.", 404);
  }
  const resultado = await pegarGrain(
    db,
    actor,
    { callId: objetivo.llamadaId, linkGrain: objetivo.linkGrain },
    { origen: "mcp" },
  );
  return resultado;
}

export const pegarGrainMcp: AccionMcp<typeof argumentos> = {
  clave: "pegar_grain",
  titulo: "Pegar Grain",
  cuandoUsarla: "Cuando se quiere guardar la grabación de una llamada que ocurrió.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    llamada_id: "00000000-0000-4000-8000-000000000001",
    link_grain: "https://grain.com/share/demo",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{
    id: entrada.deal_id,
    llamadaId: entrada.llamada_id,
    linkGrain: entrada.link_grain,
  }],
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
      antes: deal && llamada ? {
        etapa: deal.etapa,
        pendiente: deal.pendiente,
        resultado: llamada.resultado,
        link_grain: llamada.linkGrain,
      } : null,
      despues: prueba.ok ? {
        etapa: prueba.resultado.resultado.etapa,
        resultado: prueba.resultado.llamada?.resultado,
        link_grain: prueba.resultado.llamada?.linkGrain,
      } : null,
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
  async aplicar(db, actor, base) {
    const objetivo = base as Objetivo;
    await ejecutar(db, actor, objetivo);
    // Grain se programa solo tras el commit de la fila: un rollback no deja una lectura agendada.
    return {
      diferido: async () => {
        programarLecturaDeGrain(objetivo.llamadaId);
        return { pendiente: false };
      },
    };
  },
  seDeshace: false,
  efectoExterno: true,
};
