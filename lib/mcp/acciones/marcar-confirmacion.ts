import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirLlamadaVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionDeal,
  estadoParaAccionLlamada,
  huellaDeAccionLlamada,
} from "@/lib/deals/estado-para-accion";
import { marcarConfirmacion } from "@/lib/deals/llamadas";
import { ErrorDeApp } from "@/lib/errors";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  llamada_id: z.string().uuid("Llamada inválida."),
  confirmacion: z.enum(["confirmada"]).nullable(),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  llamadaId: string;
  confirmacion: "confirmada" | null;
}

async function ejecutar(
  db: Parameters<typeof marcarConfirmacion>[0],
  actor: Parameters<typeof marcarConfirmacion>[1],
  objetivo: Objetivo,
) {
  const llamada = await exigirLlamadaVisible(db, actor, objetivo.llamadaId);
  if (llamada.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe esa llamada en el deal.", 404);
  }
  await marcarConfirmacion(db, actor, {
    callId: objetivo.llamadaId,
    confirmacion: objetivo.confirmacion,
  }, { origen: "mcp" });
  return estadoParaAccionLlamada(db, objetivo.llamadaId);
}

export const marcarConfirmacionMcp: AccionMcp<typeof argumentos> = {
  clave: "marcar_confirmacion",
  titulo: "Marcar confirmación de cita",
  cuandoUsarla: "Cuando el lead confirma que asistirá a una llamada próxima, o para quitar esa confirmación.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    llamada_id: "00000000-0000-4000-8000-000000000001",
    confirmacion: "confirmada",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{
    id: entrada.deal_id,
    llamadaId: entrada.llamada_id,
    confirmacion: entrada.confirmacion,
  }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const [deal, llamada] = await Promise.all([
      estadoParaAccionDeal(db, objetivo.id),
      estadoParaAccionLlamada(db, objetivo.llamadaId),
    ]);
    const prueba = await ensayar(db, (tx) => ejecutar(tx, actor, objetivo));
    return {
      antes: deal && llamada ? { confirmacion: llamada.confirmacion } : null,
      despues: prueba.ok ? { confirmacion: prueba.resultado?.confirmacion ?? null } : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: {
        cita_en: llamada?.fechaAgenda?.toISOString() ?? null,
        lead: deal?.nombreLead ?? null,
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
  eventoDeshacer: (nuevos) => nuevos.find((evento) =>
    evento.tabla === "calls" && evento.resumen.some((campo) => campo.campo === "confirmacion")
  ),
  seDeshace: true,
  efectoExterno: false,
};
