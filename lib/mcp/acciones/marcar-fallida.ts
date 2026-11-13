import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirLlamadaVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionDeal,
  estadoParaAccionLlamada,
  huellaDeAccionLlamada,
} from "@/lib/deals/estado-para-accion";
import {
  ejecutarCancelacionDeCita,
  marcarFallidaSinCalendly,
  RESULTADOS_FALLIDOS,
} from "@/lib/deals/llamadas";
import { ErrorDeApp } from "@/lib/errors";
import type { Db } from "@/lib/db/tipos";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const AVISO_CALENDLY = "También cancelará la cita en Calendly, y deshacer no la restaura.";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  llamada_id: z.string().uuid("Llamada inválida."),
  resultado: z.enum(RESULTADOS_FALLIDOS),
  motivo_id: z.string().uuid().optional(),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  llamadaId: string;
  resultado: typeof RESULTADOS_FALLIDOS[number];
  motivoId?: string;
}

async function escribir(
  db: Parameters<typeof marcarFallidaSinCalendly>[0],
  actor: Parameters<typeof marcarFallidaSinCalendly>[1],
  objetivo: Objetivo,
) {
  const llamada = await exigirLlamadaVisible(db, actor, objetivo.llamadaId);
  if (llamada.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe esa llamada en el deal.", 404);
  }
  return marcarFallidaSinCalendly(db, actor, {
    callId: objetivo.llamadaId,
    resultado: objetivo.resultado,
    motivoId: objetivo.motivoId,
  }, { origen: "mcp" });
}

export const marcarFallidaMcp: AccionMcp<typeof argumentos> = {
  clave: "marcar_fallida",
  titulo: "Marcar llamada fallida",
  cuandoUsarla: "Cuando una llamada terminó en no show o fue cancelada.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    llamada_id: "00000000-0000-4000-8000-000000000001",
    resultado: "no_show",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{
    id: entrada.deal_id,
    llamadaId: entrada.llamada_id,
    resultado: entrada.resultado,
    motivoId: entrada.motivo_id,
  }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const [deal, llamada] = await Promise.all([
      estadoParaAccionDeal(db, objetivo.id),
      estadoParaAccionLlamada(db, objetivo.llamadaId),
    ]);
    const prueba = await ensayar(db, async (tx) => ({
      resultado: await escribir(tx, actor, objetivo),
      llamada: await estadoParaAccionLlamada(tx, objetivo.llamadaId),
      deal: await estadoParaAccionDeal(tx, objetivo.id),
    }));
    const tocaCalendly = prueba.ok && prueba.resultado.resultado.cancelacion != null;
    return {
      antes: deal && llamada
        ? { etapa: deal.etapa, pendiente: deal.pendiente, resultado: llamada.resultado }
        : null,
      despues: prueba.ok ? {
        etapa: prueba.resultado.resultado.etapa,
        pendiente: prueba.resultado.deal?.pendiente ?? null,
        resultado: prueba.resultado.llamada?.resultado,
      } : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: {
        aviso: "No se deshace en un paso; si el resultado quedó mal, corrígelo con corregir resultado.",
      },
      efectoExterno: tocaCalendly,
      ...(tocaCalendly ? { aviso: AVISO_CALENDLY } : {}),
    };
  },
  huella: (db, objetivo, opciones) => huellaDeAccionLlamada(
    db,
    objetivo.id,
    (objetivo as Objetivo).llamadaId,
    opciones,
  ),
  async aplicar(db, actor, base) {
    const resultado = await escribir(db, actor, base as Objetivo);
    return {
      diferido: (dbEfecto: Db) => ejecutarCancelacionDeCita(
        dbEfecto,
        resultado.cancelacion,
        { origen: "mcp" },
      )
        .then((pendiente) => ({ pendiente })),
    };
  },
  seDeshace: false,
  efectoExterno: true,
};
