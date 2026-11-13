import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { anularDealComo } from "@/lib/deals/anular";
import { estadoParaAccionDeal, huellaDeAccionDeal } from "@/lib/deals/estado-para-accion";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  motivo: z.string().trim().min(1).max(500),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  motivo: string;
}

async function ejecutar(
  db: Parameters<typeof anularDealComo>[0],
  actor: Parameters<typeof anularDealComo>[1],
  objetivo: Objetivo,
) {
  await anularDealComo(
    db,
    actor,
    { dealId: objetivo.id, motivo: objetivo.motivo },
    { origen: "mcp" },
  );
  return estadoParaAccionDeal(db, objetivo.id);
}

export const anularDealMcp: AccionMcp<typeof argumentos> = {
  clave: "anular_deal",
  titulo: "Anular deal",
  cuandoUsarla: "Cuando el deal se registró por error y debe dejar de contar.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    motivo: "Se registró por error",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{ id: entrada.deal_id, motivo: entrada.motivo }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const antes = await estadoParaAccionDeal(db, objetivo.id);
    const prueba = await ensayar(db, (tx) => ejecutar(tx, actor, objetivo));
    return {
      antes: antes ? {
        etapa: antes.etapa,
        pendiente: antes.pendiente,
        anulado: antes.anuladoEn != null,
      } : null,
      despues: prueba.ok ? {
        etapa: prueba.resultado?.etapa,
        pendiente: prueba.resultado?.pendiente,
        anulado: prueba.resultado?.anuladoEn != null,
      } : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: { aviso: "Una anulación no se puede deshacer." },
    };
  },
  huella: (db, objetivo, opciones) => huellaDeAccionDeal(db, objetivo.id, opciones),
  aplicar: (db, actor, objetivo) => ejecutar(db, actor, objetivo as Objetivo),
  seDeshace: false,
  efectoExterno: false,
};
