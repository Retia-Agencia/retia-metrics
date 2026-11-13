import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirLlamadaVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionDeal,
  estadoParaAccionLlamada,
  huellaDeAccionLlamada,
} from "@/lib/deals/estado-para-accion";
import { corregirResultado, RESULTADOS_CORREGIBLES } from "@/lib/deals/llamadas";
import { ErrorDeApp } from "@/lib/errors";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  llamada_id: z.string().uuid("Llamada inválida."),
  resultado: z.enum(RESULTADOS_CORREGIBLES),
  motivo: z.string().trim().min(3).max(500),
  motivo_reagenda_id: z.string().uuid().optional(),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  llamadaId: string;
  resultado: typeof RESULTADOS_CORREGIBLES[number];
  motivo: string;
  motivoReagendaId?: string;
}

async function ejecutar(
  db: Parameters<typeof corregirResultado>[0],
  actor: Parameters<typeof corregirResultado>[1],
  objetivo: Objetivo,
) {
  const llamada = await exigirLlamadaVisible(db, actor, objetivo.llamadaId);
  if (llamada.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe esa llamada en el deal.", 404);
  }
  return corregirResultado(db, actor, {
    callId: objetivo.llamadaId,
    resultado: objetivo.resultado,
    motivo: objetivo.motivo,
    motivoReagendaId: objetivo.motivoReagendaId,
  }, { origen: "mcp" });
}

export const corregirResultadoMcp: AccionMcp<typeof argumentos> = {
  clave: "corregir_resultado",
  titulo: "Corregir resultado",
  cuandoUsarla: "Cuando el resultado registrado de una llamada es incorrecto.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    llamada_id: "00000000-0000-4000-8000-000000000001",
    resultado: "no_show",
    motivo: "Se registró por error",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{
    id: entrada.deal_id,
    llamadaId: entrada.llamada_id,
    resultado: entrada.resultado,
    motivo: entrada.motivo,
    motivoReagendaId: entrada.motivo_reagenda_id,
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
      antes: deal && llamada
        ? { etapa: deal.etapa, pendiente: deal.pendiente, resultado: llamada.resultado }
        : null,
      despues: prueba.ok
        ? { etapa: prueba.resultado.resultado.etapa, resultado: prueba.resultado.llamada?.resultado }
        : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: {
        aviso: "No se deshace en un paso; si quedó mal, vuelve a corregir el resultado.",
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
