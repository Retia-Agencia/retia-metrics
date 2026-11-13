import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import {
  asignarLlamadaSueltaSinCalendly,
} from "@/lib/calendly/colgar-llamada";
import { cancelarCitasReemplazadas } from "@/lib/calendly/una-cita-activa";
import type { Db } from "@/lib/db/tipos";
import {
  estadoParaAccionDeal,
  estadoParaAccionLlamada,
  huellaDeAccionLlamadaSuelta,
} from "@/lib/deals/estado-para-accion";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const AVISO_CALENDLY = "También cancelará la cita en Calendly, y deshacer no la restaura.";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  llamada_id: z.string().uuid("Llamada inválida."),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  llamadaId: string;
}

function escribir(
  db: Parameters<typeof asignarLlamadaSueltaSinCalendly>[0],
  actor: Parameters<typeof asignarLlamadaSueltaSinCalendly>[1],
  objetivo: Objetivo,
) {
  return asignarLlamadaSueltaSinCalendly(
    db,
    actor,
    { callId: objetivo.llamadaId, dealId: objetivo.id },
    { origen: "mcp" },
  );
}

export const asignarLlamadaSueltaMcp: AccionMcp<typeof argumentos> = {
  clave: "asignar_llamada_suelta",
  titulo: "Asignar llamada suelta",
  cuandoUsarla: "Cuando una cita de Calendly debe colgarse de un deal concreto.",
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
      resultado: await escribir(tx, actor, objetivo),
      deal: await estadoParaAccionDeal(tx, objetivo.id),
      llamada: await estadoParaAccionLlamada(tx, objetivo.llamadaId),
    }));
    const tocaCalendly = prueba.ok && prueba.resultado.resultado.citasACancelar.length > 0;
    return {
      antes: deal && llamada ? {
        etapa: deal.etapa,
        pendiente: deal.pendiente,
        deal_id_llamada: llamada.dealId,
        resultado: llamada.resultado,
      } : null,
      despues: prueba.ok ? {
        etapa: prueba.resultado.deal?.etapa,
        pendiente: prueba.resultado.deal?.pendiente,
        deal_id_llamada: prueba.resultado.llamada?.dealId,
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
  huella: (db, objetivo, opciones) => huellaDeAccionLlamadaSuelta(
    db,
    objetivo.id,
    (objetivo as Objetivo).llamadaId,
    opciones,
  ),
  async aplicar(db, actor, base) {
    const resultado = await escribir(db, actor, base as Objetivo);
    return {
      diferido: (dbEfecto: Db) => cancelarCitasReemplazadas(
        dbEfecto,
        resultado.citasACancelar,
        { origen: "mcp" },
      )
        .then((pendiente) => ({ pendiente })),
    };
  },
  seDeshace: false,
  efectoExterno: true,
};
