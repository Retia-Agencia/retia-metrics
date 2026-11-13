import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { cambiarPlataformaDeAbono } from "@/lib/deals/abonos";
import { exigirAbonoVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionAbono,
  estadoParaAccionDeal,
  huellaDeAccionAbono,
} from "@/lib/deals/estado-para-accion";
import { ErrorDeApp } from "@/lib/errors";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  abono_id: z.string().uuid("Abono inválido."),
  plataforma_id: z.string().uuid("Plataforma inválida."),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  abonoId: string;
  plataformaId: string;
}

async function ejecutar(
  db: Parameters<typeof cambiarPlataformaDeAbono>[0],
  actor: Parameters<typeof cambiarPlataformaDeAbono>[1],
  objetivo: Objetivo,
) {
  const abono = await exigirAbonoVisible(db, actor, objetivo.abonoId);
  if (abono.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe ese abono en el deal.", 404);
  }
  await cambiarPlataformaDeAbono(db, actor, {
    abonoId: objetivo.abonoId,
    plataformaId: objetivo.plataformaId,
  }, { origen: "mcp" });
  return estadoParaAccionAbono(db, objetivo.abonoId);
}

export const cambiarPlataformaDeAbonoMcp: AccionMcp<typeof argumentos> = {
  clave: "cambiar_plataforma_de_abono",
  titulo: "Cambiar plataforma de abono",
  cuandoUsarla: "Cuando un abono quedó asociado a la plataforma equivocada.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    abono_id: "00000000-0000-4000-8000-000000000001",
    plataforma_id: "00000000-0000-4000-8000-000000000002",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{
    id: entrada.deal_id,
    abonoId: entrada.abono_id,
    plataformaId: entrada.plataforma_id,
  }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const [deal, abono] = await Promise.all([
      estadoParaAccionDeal(db, objetivo.id),
      estadoParaAccionAbono(db, objetivo.abonoId),
    ]);
    const prueba = await ensayar(db, async (tx) => ({
      abono: await ejecutar(tx, actor, objetivo),
      deal: await estadoParaAccionDeal(tx, objetivo.id),
    }));
    return {
      antes: deal && abono ? {
        etapa: deal.etapa,
        pendiente: deal.pendiente,
        plataforma_id: abono.plataformaId,
      } : null,
      despues: prueba.ok ? {
        etapa: prueba.resultado.deal?.etapa,
        pendiente: prueba.resultado.deal?.pendiente,
        plataforma_id: prueba.resultado.abono?.plataformaId,
      } : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: {
        aviso: "No se deshace en un paso; si la plataforma quedó mal, vuelve a cambiarla.",
      },
    };
  },
  huella: (db, objetivo, opciones) => huellaDeAccionAbono(
    db,
    objetivo.id,
    (objetivo as Objetivo).abonoId,
    opciones,
  ),
  aplicar: (db, actor, objetivo) => ejecutar(db, actor, objetivo as Objetivo),
  seDeshace: false,
  efectoExterno: false,
};
