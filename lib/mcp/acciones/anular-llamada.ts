import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirLlamadaVisible } from "@/lib/deals/alcance";
import { anularLlamadaComo } from "@/lib/deals/anular";
import {
  estadoParaAccionDeal,
  estadoParaAccionLlamada,
  huellaDeAccionLlamada,
} from "@/lib/deals/estado-para-accion";
import { ErrorDeApp } from "@/lib/errors";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  llamada_id: z.string().uuid("Llamada inválida."),
  motivo: z.string().trim().min(1).max(500),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  llamadaId: string;
  motivo: string;
}

async function ejecutar(
  db: Parameters<typeof anularLlamadaComo>[0],
  actor: Parameters<typeof anularLlamadaComo>[1],
  objetivo: Objetivo,
) {
  const llamada = await exigirLlamadaVisible(db, actor, objetivo.llamadaId);
  if (llamada.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe esa llamada en el deal.", 404);
  }
  await anularLlamadaComo(
    db,
    actor,
    { callId: objetivo.llamadaId, motivo: objetivo.motivo },
    { origen: "mcp" },
  );
  return estadoParaAccionLlamada(db, objetivo.llamadaId);
}

export const anularLlamadaMcp: AccionMcp<typeof argumentos> = {
  clave: "anular_llamada",
  titulo: "Anular llamada",
  cuandoUsarla: "Cuando una llamada del CRM se registró por error y debe dejar de contar.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    llamada_id: "00000000-0000-4000-8000-000000000001",
    motivo: "Se registró por error",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{
    id: entrada.deal_id,
    llamadaId: entrada.llamada_id,
    motivo: entrada.motivo,
  }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const [deal, llamada] = await Promise.all([
      estadoParaAccionDeal(db, objetivo.id),
      estadoParaAccionLlamada(db, objetivo.llamadaId),
    ]);
    const prueba = await ensayar(db, async (tx) => ({
      llamada: await ejecutar(tx, actor, objetivo),
      deal: await estadoParaAccionDeal(tx, objetivo.id),
    }));
    return {
      antes: deal && llamada ? {
        etapa: deal.etapa,
        pendiente: deal.pendiente,
        resultado: llamada.resultado,
        anulado: llamada.anuladoEn != null,
      } : null,
      despues: prueba.ok ? {
        etapa: prueba.resultado.deal?.etapa,
        pendiente: prueba.resultado.deal?.pendiente,
        resultado: prueba.resultado.llamada?.resultado,
        anulado: prueba.resultado.llamada?.anuladoEn != null,
      } : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: { aviso: "Una anulación no se puede deshacer." },
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
